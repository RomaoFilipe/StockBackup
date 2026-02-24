import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const updateSchema = z.object({
  status: z.enum(["REGISTERED", "ACTIVE", "ASSIGNED", "MAINTENANCE", "SCRAPPED", "DISPOSED"]).optional(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  requestingServiceId: z.number().int().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid asset id" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");

  if (req.method === "GET") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });
    const row = await db.municipalAsset.findFirst({
      where: { id, tenantId },
      include: {
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
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
      acquisitionDate: row.acquisitionDate ? row.acquisitionDate.toISOString() : null,
      events: row.events.map((event: any) => ({ ...event, createdAt: event.createdAt.toISOString() })),
    });
  }

  if (req.method === "PATCH") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const current = await db.municipalAsset.findFirst({ where: { id, tenantId }, select: { status: true } });
    if (!current) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const row = await txAny.municipalAsset.update({
        where: { id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "status") ? { status: parsed.data.status } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "location") ? { location: parsed.data.location?.trim() || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "notes") ? { notes: parsed.data.notes?.trim() || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "assignedToUserId") ? { assignedToUserId: parsed.data.assignedToUserId ?? null } : {}),
          ...(Object.prototype.hasOwnProperty.call(parsed.data, "requestingServiceId") ? { requestingServiceId: parsed.data.requestingServiceId ?? null } : {}),
        },
      });

      if (parsed.data.status && parsed.data.status !== current.status) {
        await txAny.municipalAssetEvent.create({
          data: {
            tenantId,
            assetId: id,
            fromStatus: current.status,
            toStatus: parsed.data.status,
            note: parsed.data.note?.trim() || null,
            actorUserId: session.id,
          },
        });
      }

      if (
        Object.prototype.hasOwnProperty.call(parsed.data, "assignedToUserId") ||
        Object.prototype.hasOwnProperty.call(parsed.data, "requestingServiceId")
      ) {
        await txAny.municipalAssetAssignment.create({
          data: {
            tenantId,
            assetId: id,
            userId: parsed.data.assignedToUserId ?? null,
            requestingServiceId: parsed.data.requestingServiceId ?? null,
            note: parsed.data.note?.trim() || null,
          },
        });
      }

      return row;
    });

    return res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      acquisitionDate: updated.acquisitionDate ? updated.acquisitionDate.toISOString() : null,
    });
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
