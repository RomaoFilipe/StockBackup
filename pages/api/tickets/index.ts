import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { createTicketAudit, inferLevelFromPriority, nextUniqueTicketCode } from "./_utils";
import { applyTicketSlaEscalations, computeSlaTargets } from "./_sla";
import { publishRealtimeEvent } from "@/utils/realtime";

const createTicketSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional(),
  type: z.enum(["INCIDENT", "REQUEST", "QUESTION", "CHANGE"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  level: z.enum(["L1", "L2", "L3"]).optional(),
  dueAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  assignedToUserId: z.string().uuid().optional(),
  initialMessage: z.string().trim().min(1).max(4000).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;

  if (req.method === "GET") {
    try {
      await applyTicketSlaEscalations(tenantId);

      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const level = typeof req.query.level === "string" ? req.query.level : undefined;
      const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

      const where: any = {
        tenantId,
        ...(status ? { status } : {}),
        ...(level ? { level } : {}),
        ...(priority ? { priority } : {}),
        ...(session.role !== "ADMIN"
          ? { OR: [{ createdByUserId: session.id }, { assignedToUserId: session.id }] }
          : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
                { description: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      };

      const tickets = await prisma.ticket.findMany({
        where,
        orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          requestLinks: {
            orderBy: { createdAt: "desc" },
            include: {
              request: { select: { id: true, gtmiNumber: true, status: true, title: true, requestedAt: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      });

      return res.status(200).json(
        tickets.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          dueAt: t.dueAt ? t.dueAt.toISOString() : null,
          firstResponseDueAt: t.firstResponseDueAt ? t.firstResponseDueAt.toISOString() : null,
          resolutionDueAt: t.resolutionDueAt ? t.resolutionDueAt.toISOString() : null,
          firstResponseAt: t.firstResponseAt ? t.firstResponseAt.toISOString() : null,
          resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
          closedAt: t.closedAt ? t.closedAt.toISOString() : null,
          slaBreachedAt: t.slaBreachedAt ? t.slaBreachedAt.toISOString() : null,
          lastEscalatedAt: t.lastEscalatedAt ? t.lastEscalatedAt.toISOString() : null,
          requests: (t.requestLinks || []).map((link) => ({
            ...link.request,
            requestedAt: link.request.requestedAt.toISOString(),
            linkedAt: link.createdAt.toISOString(),
          })),
        }))
      );
    } catch (error) {
      console.error("GET /api/tickets error", error);
      return res.status(500).json({ error: "Failed to fetch tickets" });
    }
  }

  if (req.method === "POST") {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const {
      title,
      description,
      type = "QUESTION",
      priority = "NORMAL",
      level,
      dueAt,
      assignedToUserId,
      initialMessage,
    } = parsed.data;

    try {
      if (assignedToUserId) {
        const assignee = await prisma.user.findFirst({
          where: { id: assignedToUserId, tenantId, isActive: true },
          select: { id: true },
        });
        if (!assignee) return res.status(400).json({ error: "Assigned user not found in tenant" });
      }

      const code = await nextUniqueTicketCode(tenantId);
      const finalLevel = level ?? inferLevelFromPriority(priority);
      const createdAt = new Date();
      const sla = computeSlaTargets(priority, createdAt);

      const ticket = await prisma.ticket.create({
        data: {
          tenantId,
          code,
          title,
          description: description || null,
          type,
          priority,
          level: finalLevel,
          dueAt: dueAt ?? null,
          firstResponseDueAt: sla.firstResponseDueAt,
          resolutionDueAt: sla.resolutionDueAt,
          createdByUserId: session.id,
          assignedToUserId: assignedToUserId ?? null,
          messages: initialMessage
            ? {
                create: {
                  tenantId,
                  authorUserId: session.id,
                  body: initialMessage,
                },
              }
            : undefined,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          requestLinks: {
            orderBy: { createdAt: "desc" },
            include: {
              request: { select: { id: true, gtmiNumber: true, status: true, title: true, requestedAt: true } },
            },
          },
          _count: { select: { messages: true } },
        },
      });

      await createTicketAudit({
        tenantId,
        ticketId: ticket.id,
        actorUserId: session.id,
        action: "TICKET_CREATED",
        note: `Ticket ${ticket.code} criado`,
      });

      const targetUserIds = Array.from(new Set([session.id, assignedToUserId].filter(Boolean) as string[]));
      publishRealtimeEvent({
        type: "ticket.created",
        tenantId,
        audience: "ADMIN",
        payload: { ticketId: ticket.id, code: ticket.code, createdByUserId: session.id, assignedToUserId: assignedToUserId ?? null },
      });
      for (const uid of targetUserIds) {
        publishRealtimeEvent({
          type: "ticket.created",
          tenantId,
          audience: "USER",
          userId: uid,
          payload: { ticketId: ticket.id, code: ticket.code, createdByUserId: session.id, assignedToUserId: assignedToUserId ?? null },
        });
      }

      return res.status(201).json({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        dueAt: ticket.dueAt ? ticket.dueAt.toISOString() : null,
        firstResponseDueAt: ticket.firstResponseDueAt ? ticket.firstResponseDueAt.toISOString() : null,
        resolutionDueAt: ticket.resolutionDueAt ? ticket.resolutionDueAt.toISOString() : null,
        firstResponseAt: ticket.firstResponseAt ? ticket.firstResponseAt.toISOString() : null,
        resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
        closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
        slaBreachedAt: ticket.slaBreachedAt ? ticket.slaBreachedAt.toISOString() : null,
        lastEscalatedAt: ticket.lastEscalatedAt ? ticket.lastEscalatedAt.toISOString() : null,
        requests: (ticket.requestLinks || []).map((link) => ({
          ...link.request,
          requestedAt: link.request.requestedAt.toISOString(),
          linkedAt: link.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("POST /api/tickets error", error);
      return res.status(500).json({ error: "Failed to create ticket" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
