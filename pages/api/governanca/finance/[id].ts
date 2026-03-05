import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "CABIMENTO", "COMPROMISSO", "APPROVED", "PAYMENT_AUTHORIZED", "PAID", "REJECTED"]).optional(),
  note: z.string().max(1000).optional().nullable(),
  budgetLine: z.string().max(120).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "finance.manage");

  if (req.method === "GET") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });
    const row = await db.financeProcess.findFirst({
      where: { id, tenantId },
      include: {
        request: { select: { id: true, gtmiNumber: true, status: true, title: true } },
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        events: {
          orderBy: [{ createdAt: "desc" }],
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!row) return res.status(404).json({ error: "Not found" });

    return res.status(200).json({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      events: row.events.map((event: any) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    });
  }

  if (req.method === "PATCH") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const current = await db.financeProcess.findFirst({ where: { id, tenantId }, select: { status: true } });
    if (!current) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const row = await txAny.financeProcess.update({
        where: { id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "status") ? { status: parsed.data.status } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "budgetLine") ? { budgetLine: parsed.data.budgetLine?.trim() || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "note") ? { note: parsed.data.note?.trim() || null } : {}),
        },
      });

      if (parsed.data.status && parsed.data.status !== current.status) {
        await txAny.financeProcessEvent.create({
          data: {
            tenantId,
            financeProcessId: row.id,
            fromStatus: current.status,
            toStatus: parsed.data.status,
            note: parsed.data.note?.trim() || null,
            actorUserId: session.id,
          },
        });
      }

      return row;
    });

    return res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
