import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const createSchema = z.object({
  code: z.string().min(2).max(60),
  name: z.string().min(2).max(160),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  acquisitionDate: z.string().datetime().optional().nullable(),
  acquisitionValue: z.number().nonnegative().optional().nullable(),
  requestingServiceId: z.number().int().optional().nullable(),
  requestId: z.string().uuid().optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");

  if (req.method === "GET") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const rows = await db.municipalAsset.findMany({
      where: {
        tenantId,
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { location: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(
      rows.map((row: any) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        acquisitionDate: row.acquisitionDate ? row.acquisitionDate.toISOString() : null,
      }))
    );
  }

  if (req.method === "POST") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const created = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const asset = await txAny.municipalAsset.create({
        data: {
          tenantId,
          code: parsed.data.code.trim(),
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          category: parsed.data.category?.trim() || null,
          location: parsed.data.location?.trim() || null,
          notes: parsed.data.notes?.trim() || null,
          acquisitionDate: parsed.data.acquisitionDate ? new Date(parsed.data.acquisitionDate) : null,
          acquisitionValue: parsed.data.acquisitionValue ?? null,
          requestingServiceId: parsed.data.requestingServiceId ?? null,
          requestId: parsed.data.requestId ?? null,
          status: "REGISTERED",
        },
      });

      await txAny.municipalAssetEvent.create({
        data: {
          tenantId,
          assetId: asset.id,
          fromStatus: null,
          toStatus: "REGISTERED",
          note: "Ativo registado",
          actorUserId: session.id,
        },
      });

      return asset;
    });

    return res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      acquisitionDate: created.acquisitionDate ? created.acquisitionDate.toISOString() : null,
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
