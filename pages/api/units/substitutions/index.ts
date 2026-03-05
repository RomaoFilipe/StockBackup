import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { toSubstitutionEventRow } from "@/utils/substitutionEvents";

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const take = parsed.data.limit ?? 50;
  const q = parsed.data.q?.toLowerCase().trim();

  try {
    const rows = await prisma.userAdminAudit.findMany({
      where: {
        tenantId: session.tenantId,
        action: "UNIT_SUBSTITUTE",
        ...(parsed.data.from || parsed.data.to
          ? {
              createdAt: {
                ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
                ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        note: true,
        payload: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    const items = rows
      .map((r) => toSubstitutionEventRow(r))
      .filter((it) => {
        if (!q) return true;
        const haystack = `${it.id} ${it.oldCode} ${it.newCode} ${it.linkedRequestGtmiNumber || ""} ${it.reason || ""} ${it.costCenter || ""} ${it.ticketNumber || ""} ${it.actor?.name || ""} ${it.actor?.email || ""}`.toLowerCase();
        return haystack.includes(q);
      });

    return res.status(200).json({ items });
  } catch (error) {
    console.error("GET /api/units/substitutions error:", error);
    return res.status(500).json({ error: "Failed to list substitutions" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
