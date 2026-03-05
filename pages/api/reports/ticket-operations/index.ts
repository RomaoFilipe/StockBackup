import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"]).optional(),
  level: z.enum(["L1", "L2", "L3"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  assignedToUserId: z.string().uuid().optional(),
  includeClosed: z
    .string()
    .optional()
    .transform((v) => v !== "0" && v !== "false"),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v || 200);
      return Number.isFinite(n) ? Math.max(1, Math.min(1000, Math.floor(n))) : 200;
    }),
});

function toDateOrNull(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", issues: parsed.error.flatten() });
  }

  const from = toDateOrNull(parsed.data.from);
  const to = toDateOrNull(parsed.data.to);
  if (parsed.data.from && !from) return res.status(400).json({ error: "Invalid from date" });
  if (parsed.data.to && !to) return res.status(400).json({ error: "Invalid to date" });

  const where: any = {
    tenantId: session.tenantId,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(parsed.data.level ? { level: parsed.data.level } : {}),
    ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
    ...(parsed.data.assignedToUserId ? { assignedToUserId: parsed.data.assignedToUserId } : {}),
    ...(!parsed.data.includeClosed ? { status: { not: "CLOSED" } } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  try {
    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: parsed.data.limit,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        requestLinks: {
          orderBy: { createdAt: "desc" },
          include: {
            request: {
              select: {
                id: true,
                gtmiNumber: true,
                status: true,
                title: true,
                requestedAt: true,
                requesterName: true,
                requestingService: true,
              },
            },
            linkedBy: { select: { id: true, name: true, email: true } },
          },
        },
        audits: {
          orderBy: { createdAt: "desc" },
          include: {
            actor: { select: { id: true, name: true, email: true } },
          },
        },
        _count: {
          select: {
            messages: true,
            audits: true,
            requestLinks: true,
          },
        },
      },
    });

    const byStatus: Record<string, number> = {};
    const byLevel: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const auditActions: Record<string, number> = {};

    let closedCount = 0;
    let resolvedCount = 0;
    let escalatedCount = 0;
    let breachedCount = 0;
    let withLinkedRequestsCount = 0;

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      byLevel[t.level] = (byLevel[t.level] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;

      if (t.status === "CLOSED") closedCount += 1;
      if (t.status === "RESOLVED") resolvedCount += 1;
      if (t.status === "ESCALATED") escalatedCount += 1;
      if (t.slaBreachedAt) breachedCount += 1;
      if (t.requestLinks.length > 0) withLinkedRequestsCount += 1;

      for (const a of t.audits) {
        auditActions[a.action] = (auditActions[a.action] || 0) + 1;
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      tenantId: session.tenantId,
      filters: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        status: parsed.data.status ?? null,
        level: parsed.data.level ?? null,
        priority: parsed.data.priority ?? null,
        assignedToUserId: parsed.data.assignedToUserId ?? null,
        includeClosed: parsed.data.includeClosed,
        limit: parsed.data.limit,
      },
      summary: {
        totalTickets: tickets.length,
        closedCount,
        resolvedCount,
        escalatedCount,
        breachedCount,
        withLinkedRequestsCount,
      },
      breakdowns: {
        byStatus,
        byLevel,
        byPriority,
        auditActions,
      },
      items: tickets.map((t) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        type: t.type,
        level: t.level,
        escalationReason: t.escalationReason,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        firstResponseDueAt: t.firstResponseDueAt ? t.firstResponseDueAt.toISOString() : null,
        resolutionDueAt: t.resolutionDueAt ? t.resolutionDueAt.toISOString() : null,
        firstResponseAt: t.firstResponseAt ? t.firstResponseAt.toISOString() : null,
        resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        closedAt: t.closedAt ? t.closedAt.toISOString() : null,
        slaBreachedAt: t.slaBreachedAt ? t.slaBreachedAt.toISOString() : null,
        lastEscalatedAt: t.lastEscalatedAt ? t.lastEscalatedAt.toISOString() : null,
        slaEscalationCount: t.slaEscalationCount,
        createdBy: t.createdBy,
        assignedTo: t.assignedTo,
        counts: {
          messages: t._count.messages,
          audits: t._count.audits,
          linkedRequests: t._count.requestLinks,
        },
        linkedRequests: t.requestLinks.map((link) => ({
          linkedAt: link.createdAt.toISOString(),
          linkedBy: link.linkedBy,
          request: {
            ...link.request,
            requestedAt: link.request.requestedAt.toISOString(),
          },
        })),
        interventions: t.audits.map((a) => ({
          id: a.id,
          action: a.action,
          note: a.note,
          data: a.data,
          createdAt: a.createdAt.toISOString(),
          actor: a.actor,
        })),
      })),
    };

    return res.status(200).json(report);
  } catch (error) {
    console.error("GET /api/reports/ticket-operations error", error);
    return res.status(500).json({ error: "Failed to build ticket operations report" });
  }
}
