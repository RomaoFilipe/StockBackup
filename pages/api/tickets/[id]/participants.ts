import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { canAccessTicketWithParticipants, createTicketAudit, getTicketPermissionGrants, isTicketManager } from "../_utils";

const addSchema = z.object({
  userId: z.string().uuid(),
});

const removeSchema = z.object({
  userId: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const ticketId = typeof req.query.id === "string" ? req.query.id : "";
  if (!ticketId) return res.status(400).json({ error: "Invalid ticket id" });

  const tenantId = session.tenantId;
  const grants = await getTicketPermissionGrants(session as any);
  const manager = isTicketManager(grants);

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId },
    select: {
      id: true,
      code: true,
      createdByUserId: true,
      assignedToUserId: true,
      participants: { select: { userId: true } },
    },
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const participantUserIds = ticket.participants.map((p) => p.userId);
  const canAccess = canAccessTicketWithParticipants(session, ticket, participantUserIds, { isManager: manager });
  if (!canAccess) return res.status(403).json({ error: "Forbidden" });

  const canManageParticipants = manager || ticket.createdByUserId === session.id || ticket.assignedToUserId === session.id;

  if (req.method === "GET") {
    const participants = await prisma.ticketParticipant.findMany({
      where: { tenantId, ticketId },
      orderBy: [{ createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true, email: true, username: true, role: true, requestingServiceId: true } },
        addedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(
      participants.map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        user: p.user,
        addedBy: p.addedBy ?? null,
      }))
    );
  }

  if (req.method === "POST") {
    if (!canManageParticipants) return res.status(403).json({ error: "Forbidden" });

    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

    if (!manager) {
      const myServiceId = (session as any).requestingServiceId ?? null;
      if (myServiceId == null) return res.status(403).json({ error: "Forbidden" });

      const target = await prisma.user.findFirst({
        where: { id: parsed.data.userId, tenantId, isActive: true },
        select: { id: true, requestingServiceId: true },
      });
      if (!target) return res.status(400).json({ error: "User not found" });
      if (target.requestingServiceId !== myServiceId) {
        return res.status(403).json({ error: "Só podes adicionar pessoas do teu departamento." });
      }
    }

    await prisma.ticketParticipant.upsert({
      where: { ticketId_userId: { ticketId, userId: parsed.data.userId } },
      create: { tenantId, ticketId, userId: parsed.data.userId, addedByUserId: session.id },
      update: {},
    });

    await createTicketAudit({
      tenantId,
      ticketId,
      actorUserId: session.id,
      action: "PARTICIPANT_ADDED",
      data: { userId: parsed.data.userId },
      note: `Participante adicionado ao ticket ${ticket.code}`,
    });

    return res.status(201).json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!canManageParticipants) return res.status(403).json({ error: "Forbidden" });

    const parsed = removeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

    // Keep creator as an implicit participant (can't remove).
    if (parsed.data.userId === ticket.createdByUserId) {
      return res.status(409).json({ error: "Não é possível remover o criador do ticket." });
    }

    await prisma.ticketParticipant.deleteMany({
      where: { tenantId, ticketId, userId: parsed.data.userId },
    });

    await createTicketAudit({
      tenantId,
      ticketId,
      actorUserId: session.id,
      action: "PARTICIPANT_REMOVED",
      data: { userId: parsed.data.userId },
      note: `Participante removido do ticket ${ticket.code}`,
    });

    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

