import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const createSchema = z.object({
  code: z.string().min(2).max(60),
  requestId: z.string().uuid().optional().nullable(),
  requestingServiceId: z.number().int().optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(10).optional(),
  budgetLine: z.string().max(120).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "finance.manage");

  if (req.method === "GET") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });
    const rows = await db.financeProcess.findMany({
      where: { tenantId },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        request: { select: { id: true, gtmiNumber: true, status: true, title: true } },
        requestingService: { select: { id: true, codigo: true, designacao: true } },
      },
    });

    return res.status(200).json(rows.map((row: any) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })));
  }

  if (req.method === "POST") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const created = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const row = await txAny.financeProcess.create({
        data: {
          tenantId,
          code: parsed.data.code.trim(),
          requestId: parsed.data.requestId ?? null,
          requestingServiceId: parsed.data.requestingServiceId ?? null,
          amount: parsed.data.amount,
          currency: parsed.data.currency?.trim() || "EUR",
          budgetLine: parsed.data.budgetLine?.trim() || null,
          note: parsed.data.note?.trim() || null,
          status: "DRAFT",
        },
      });

      await txAny.financeProcessEvent.create({
        data: {
          tenantId,
          financeProcessId: row.id,
          fromStatus: null,
          toStatus: "DRAFT",
          note: "Processo financeiro criado",
          actorUserId: session.id,
        },
      });

      return row;
    });

    return res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
