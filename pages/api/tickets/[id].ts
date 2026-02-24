import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { canAccessTicket, createTicketAudit, inferLevelFromPriority } from "./_utils";
import { applyTicketSlaEscalations, computeSlaTargets } from "./_sla";
import { publishRealtimeEvent } from "@/utils/realtime";

const updateTicketSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["INCIDENT", "REQUEST", "QUESTION", "CHANGE"]).optional(),
  level: z.enum(["L1", "L2", "L3"]).optional(),
  escalationReason: z.string().trim().max(500).nullable().optional(),
  dueAt: z
    .union([z.string().datetime(), z.null()])
    .optional()
    .transform((v) => (typeof v === "string" ? new Date(v) : v)),
  assignedToUserId: z.union([z.string().uuid(), z.null()]).optional(),
  linkRequestId: z.string().uuid().optional(),
  unlinkRequestId: z.string().uuid().optional(),
  closeNote: z.string().trim().max(1000).optional(),
});

function serializeTicket(t: any) {
  return {
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
    requests: (t.requestLinks || []).map((link: any) => ({
      ...link.request,
      requestedAt: link.request.requestedAt ? link.request.requestedAt.toISOString() : null,
      linkedAt: link.createdAt ? link.createdAt.toISOString() : null,
      linkedBy: link.linkedBy
        ? { id: link.linkedBy.id, name: link.linkedBy.name, email: link.linkedBy.email }
        : null,
    })),
    audits: Array.isArray(t.audits)
      ? t.audits.map((a: any) => ({
          ...a,
          createdAt: a.createdAt.toISOString(),
        }))
      : undefined,
    messages: Array.isArray(t.messages)
      ? t.messages.map((m: any) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          updatedAt: m.updatedAt.toISOString(),
        }))
      : undefined,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid ticket id" });

  if (req.method === "GET") {
    try {
      await applyTicketSlaEscalations(session.tenantId);

      const ticket = await prisma.ticket.findFirst({
        where: { id, tenantId: session.tenantId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          requestLinks: {
            orderBy: { createdAt: "desc" },
            include: {
              request: { select: { id: true, gtmiNumber: true, status: true, title: true, requestedAt: true } },
              linkedBy: { select: { id: true, name: true, email: true } },
            },
          },
          audits: {
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              actor: { select: { id: true, name: true, email: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, email: true, role: true } },
            },
          },
        },
      });

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!canAccessTicket(session, ticket)) return res.status(403).json({ error: "Forbidden" });

      return res.status(200).json(serializeTicket(ticket));
    } catch (error) {
      console.error("GET /api/tickets/[id] error", error);
      return res.status(500).json({ error: "Failed to fetch ticket" });
    }
  }

  if (req.method === "PATCH") {
    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    try {
      const isAdmin = session.role === "ADMIN";
      const hasAdminOnlyChanges = [
        parsed.data.title,
        parsed.data.description,
        parsed.data.status,
        parsed.data.priority,
        parsed.data.type,
        parsed.data.level,
        parsed.data.escalationReason,
        parsed.data.dueAt,
        parsed.data.assignedToUserId,
        parsed.data.unlinkRequestId,
        parsed.data.closeNote,
      ].some((value) => value !== undefined);
      const isUserLinkOnly = !hasAdminOnlyChanges && Boolean(parsed.data.linkRequestId);

      if (!isAdmin && !isUserLinkOnly) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const current = await prisma.ticket.findFirst({
        where: { id, tenantId: session.tenantId },
        select: {
          id: true,
          code: true,
          status: true,
          priority: true,
          createdAt: true,
          createdByUserId: true,
          assignedToUserId: true,
        },
      });
      if (!current) return res.status(404).json({ error: "Ticket not found" });
      if (!canAccessTicket(session, current)) return res.status(403).json({ error: "Forbidden" });

      if (parsed.data.assignedToUserId) {
        const assignee = await prisma.user.findFirst({
          where: { id: parsed.data.assignedToUserId, tenantId: session.tenantId, isActive: true },
          select: { id: true },
        });
        if (!assignee) return res.status(400).json({ error: "Assigned user not found in tenant" });
      }

      if (parsed.data.linkRequestId) {
        const linkedRequest = await prisma.request.findFirst({
          where: {
            id: parsed.data.linkRequestId,
            tenantId: session.tenantId,
            ...(isAdmin ? {} : { userId: session.id }),
          },
          select: { id: true, gtmiNumber: true },
        });
        if (!linkedRequest) return res.status(400).json({ error: "Request not found or not owned by user" });

        await prisma.ticketRequestLink.upsert({
          where: {
            ticketId_requestId: {
              ticketId: current.id,
              requestId: linkedRequest.id,
            },
          },
          create: {
            tenantId: session.tenantId,
            ticketId: current.id,
            requestId: linkedRequest.id,
            linkedByUserId: session.id,
          },
          update: {},
        });

        await prisma.ticketMessage.create({
          data: {
            tenantId: session.tenantId,
            ticketId: current.id,
            authorUserId: session.id,
            body: `Requisição associada manualmente: ${linkedRequest.gtmiNumber}.`,
          },
        });

        await createTicketAudit({
          tenantId: session.tenantId,
          ticketId: current.id,
          actorUserId: session.id,
          action: "REQUEST_LINKED",
          note: `Requisição ${linkedRequest.gtmiNumber} associada ao ticket`,
          data: { requestId: linkedRequest.id, gtmiNumber: linkedRequest.gtmiNumber },
        });
      }

      if (parsed.data.unlinkRequestId) {
        const existingLink = await prisma.ticketRequestLink.findFirst({
          where: {
            tenantId: session.tenantId,
            ticketId: current.id,
            requestId: parsed.data.unlinkRequestId,
          },
          include: { request: { select: { id: true, gtmiNumber: true } } },
        });

        if (existingLink) {
          await prisma.ticketRequestLink.delete({ where: { id: existingLink.id } });
          await prisma.ticketMessage.create({
            data: {
              tenantId: session.tenantId,
              ticketId: current.id,
              authorUserId: session.id,
              body: `Requisição removida do ticket: ${existingLink.request.gtmiNumber}.`,
            },
          });
          await createTicketAudit({
            tenantId: session.tenantId,
            ticketId: current.id,
            actorUserId: session.id,
            action: "REQUEST_UNLINKED",
            note: `Requisição ${existingLink.request.gtmiNumber} removida do ticket`,
            data: { requestId: existingLink.request.id, gtmiNumber: existingLink.request.gtmiNumber },
          });
        }
      }

      const nextPriority = parsed.data.priority ?? current.priority;
      const data: any = {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        priority: parsed.data.priority,
        type: parsed.data.type,
        level: parsed.data.level,
        escalationReason: parsed.data.escalationReason,
        dueAt: parsed.data.dueAt,
        assignedToUserId: parsed.data.assignedToUserId,
      };

      Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

      if (!parsed.data.level && parsed.data.priority) {
        data.level = inferLevelFromPriority(nextPriority);
      }

      if (parsed.data.priority) {
        const sla = computeSlaTargets(nextPriority, current.createdAt);
        data.firstResponseDueAt = sla.firstResponseDueAt;
        data.resolutionDueAt = sla.resolutionDueAt;
      }

      if (parsed.data.status && parsed.data.status !== current.status) {
        if (parsed.data.status === "RESOLVED") {
          data.resolvedAt = new Date();
          data.closedAt = null;
        } else if (parsed.data.status === "CLOSED") {
          data.closedAt = new Date();
          if (!data.resolvedAt) data.resolvedAt = new Date();
        } else {
          data.resolvedAt = null;
          data.closedAt = null;
        }
      }

      const updated = await prisma.ticket.update({
        where: { id: current.id },
        data,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          requestLinks: {
            orderBy: { createdAt: "desc" },
            include: {
              request: { select: { id: true, gtmiNumber: true, status: true, title: true, requestedAt: true } },
              linkedBy: { select: { id: true, name: true, email: true } },
            },
          },
          audits: {
            orderBy: { createdAt: "desc" },
            take: 100,
            include: { actor: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { messages: true } },
        },
      });

      if (Object.keys(data).length > 0) {
        await createTicketAudit({
          tenantId: session.tenantId,
          ticketId: current.id,
          actorUserId: session.id,
          action: parsed.data.status === "CLOSED" ? "TICKET_CLOSED" : "TICKET_UPDATED",
          note: parsed.data.closeNote?.trim() || null,
          data: {
            changed: Object.keys(data),
            fromStatus: current.status,
            toStatus: parsed.data.status ?? current.status,
          },
        });
      }

      const notifyUserIds = Array.from(new Set([updated.createdBy?.id, updated.assignedTo?.id].filter(Boolean) as string[]));
      publishRealtimeEvent({
        type: "ticket.updated",
        tenantId: session.tenantId,
        audience: "ADMIN",
        payload: { ticketId: updated.id, code: current.code },
      });
      for (const uid of notifyUserIds) {
        publishRealtimeEvent({
          type: "ticket.updated",
          tenantId: session.tenantId,
          audience: "USER",
          userId: uid,
          payload: { ticketId: updated.id, code: current.code },
        });
      }

      return res.status(200).json(serializeTicket(updated));
    } catch (error) {
      console.error("PATCH /api/tickets/[id] error", error);
      return res.status(500).json({ error: "Failed to update ticket" });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
