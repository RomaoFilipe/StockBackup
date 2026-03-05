import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { derivePresenceStatus, getPresenceRecord, setManualPresence, touchPresence } from "@/utils/presenceStore";

const patchSchema = z.object({
  manualStatus: z.enum(["AUTO", "ONLINE", "BUSY", "MEETING"]),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const now = Date.now();

  if (req.method === "GET") {
    try {
      touchPresence({ tenantId, userId: session.id, active: false, now });

      const users = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: [{ role: "desc" }, { name: "asc" }],
      });

      const criticalWindow = new Date(now + 2 * 60 * 60 * 1000);
      const slaCritical = await prisma.ticket.groupBy({
        by: ["assignedToUserId"],
        where: {
          tenantId,
          assignedToUserId: { not: null },
          status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "ESCALATED"] },
          resolutionDueAt: { not: null, lte: criticalWindow },
        },
        _count: { _all: true },
      });
      const slaByUser = new Map<string, number>();
      for (const row of slaCritical) {
        if (row.assignedToUserId) slaByUser.set(row.assignedToUserId, row._count._all);
      }

      const list = users.map((u) => {
        const rec = getPresenceRecord(tenantId, u.id);
        const status = derivePresenceStatus(rec, now);
        const criticalCount = slaByUser.get(u.id) || 0;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status,
          slaCritical: criticalCount > 0,
          slaCriticalCount: criticalCount,
          lastSeenAt: rec ? new Date(rec.lastSeenAt).toISOString() : null,
        };
      });

      return res.status(200).json({
        me: {
          id: session.id,
          manualStatus: getPresenceRecord(tenantId, session.id)?.manualStatus ?? null,
        },
        users: list,
      });
    } catch (error) {
      console.error("GET /api/presence error:", error);
      return res.status(500).json({ error: "Failed to fetch presence" });
    }
  }

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });

    const manualStatus = parsed.data.manualStatus === "AUTO" ? null : parsed.data.manualStatus;
    setManualPresence({ tenantId, userId: session.id, manualStatus, now });
    touchPresence({ tenantId, userId: session.id, active: true, now });
    return res.status(200).json({ ok: true, manualStatus });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

