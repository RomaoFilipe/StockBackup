import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { canAccessTicket, createTicketAudit } from "../_utils";
import { applyTicketSlaEscalations } from "../_sla";
import { publishRealtimeEvent } from "@/utils/realtime";

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  await applyTicketSlaEscalations(session.tenantId);

  const ticketId = typeof req.query.id === "string" ? req.query.id : "";
  if (!ticketId) return res.status(400).json({ error: "Invalid ticket id" });

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: session.tenantId },
    select: { id: true, code: true, status: true, createdByUserId: true, assignedToUserId: true, firstResponseAt: true },
  });

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (!canAccessTicket(session, ticket)) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    try {
      const messages = await prisma.ticketMessage.findMany({
        where: { ticketId, tenantId: session.tenantId },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
        },
      });

      return res.status(200).json(
        messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("GET /api/tickets/[id]/messages error", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  }

  if (req.method === "POST") {
    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }
    if (ticket.status === "CLOSED") {
      return res.status(409).json({ error: "Ticket fechado não permite novas mensagens." });
    }

    try {
      const message = await prisma.$transaction(async (tx) => {
        const current = await tx.ticket.findFirst({
          where: { id: ticket.id, tenantId: session.tenantId },
          select: { status: true },
        });
        if (!current) {
          throw new Error("TICKET_NOT_FOUND");
        }
        if (current.status === "CLOSED") {
          throw new Error("TICKET_CLOSED");
        }

        const created = await tx.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            tenantId: session.tenantId,
            authorUserId: session.id,
            body: parsed.data.body,
          },
          include: {
            author: { select: { id: true, name: true, email: true, role: true } },
          },
        });

        if (!ticket.firstResponseAt && session.id !== ticket.createdByUserId) {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { firstResponseAt: new Date(), status: "IN_PROGRESS" },
          });
        }

        return created;
      });

      await createTicketAudit({
        tenantId: session.tenantId,
        ticketId: ticket.id,
        actorUserId: session.id,
        action: "MESSAGE_CREATED",
      });

      const notifyUserIds = Array.from(new Set([ticket.createdByUserId, ticket.assignedToUserId].filter(Boolean) as string[]));
      publishRealtimeEvent({
        type: "ticket.message_created",
        tenantId: session.tenantId,
        audience: "ADMIN",
        payload: { ticketId: ticket.id, messageId: message.id, code: ticket.code, authorUserId: session.id },
      });
      for (const uid of notifyUserIds) {
        publishRealtimeEvent({
          type: "ticket.message_created",
          tenantId: session.tenantId,
          audience: "USER",
          userId: uid,
          payload: { ticketId: ticket.id, messageId: message.id, code: ticket.code, authorUserId: session.id },
        });
      }

      return res.status(201).json({
        ...message,
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TICKET_CLOSED") {
        return res.status(409).json({ error: "Ticket fechado não permite novas mensagens." });
      }
      console.error("POST /api/tickets/[id]/messages error", error);
      return res.status(500).json({ error: "Failed to create message" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
