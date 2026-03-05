import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const createSchema = z.object({
  assetId: z.string().uuid(),
  type: z.enum([
    "REGISTER",
    "ASSIGN",
    "TRANSFER",
    "STOCK_IN",
    "STOCK_OUT",
    "LOAN_OUT",
    "LOAN_RETURN",
    "REPAIR_OUT",
    "REPAIR_IN",
    "STATUS_CHANGE",
    "DISPOSAL_INIT",
    "DISPOSAL_APPROVED",
    "DISPOSED",
    "NOTE",
  ]),
  statusTo: z
    .enum([
      "REGISTERED",
      "IN_SERVICE",
      "IN_REPAIR",
      "LOANED",
      "LOST",
      "STOLEN",
      "TO_DISPOSE",
      "TRANSFERRED_OUT",
      "DONATED",
      "ACTIVE",
      "ASSIGNED",
      "MAINTENANCE",
      "SCRAPPED",
      "DISPOSED",
    ])
    .optional()
    .nullable(),
  movementAt: z.string().datetime().optional().nullable(),
  expectedReturnAt: z.string().datetime().optional().nullable(),
  returnedAt: z.string().datetime().optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  vendorName: z.string().max(200).optional().nullable(),
  cost: z.number().nonnegative().optional().nullable(),
  documentRef: z.string().max(500).optional().nullable(),
  attachments: z.array(z.string().max(500)).max(20).optional().nullable(),
  fromRequestingServiceId: z.number().int().optional().nullable(),
  toRequestingServiceId: z.number().int().optional().nullable(),
  fromLocationId: z.string().uuid().optional().nullable(),
  toLocationId: z.string().uuid().optional().nullable(),
  fromCustodianUserId: z.string().uuid().optional().nullable(),
  toCustodianUserId: z.string().uuid().optional().nullable(),
});

function impliedStatus(type: z.infer<typeof createSchema>["type"]) {
  if (type === "LOAN_OUT") return "LOANED";
  if (type === "LOAN_RETURN") return "IN_SERVICE";
  if (type === "REPAIR_OUT") return "IN_REPAIR";
  if (type === "REPAIR_IN") return "IN_SERVICE";
  if (type === "DISPOSED") return "DISPOSED";
  return null;
}

async function userHasActiveRoleKey(db: any, tenantId: string, userId: string, roleKey: string) {
  const now = new Date();
  const assignment = await db.userRoleAssignment.findFirst({
    where: {
      tenantId,
      userId,
      isActive: true,
      role: { key: roleKey },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");
  const canView = canManage || hasPermission(grants, "assets.view") || hasPermission(grants, "assets.audit_view");
  const canMove = canManage || hasPermission(grants, "assets.move");

  if (req.method === "GET") {
    if (!canView) return res.status(403).json({ error: "Forbidden" });

    const assetId = typeof req.query.assetId === "string" ? req.query.assetId : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const rows = await db.municipalAssetMovement.findMany({
      where: {
        tenantId,
        ...(assetId ? { assetId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: [{ movementAt: "desc" }],
      take: limit,
      include: {
        asset: { select: { id: true, code: true, name: true, status: true } },
        actor: { select: { id: true, name: true, email: true } },
        fromRequestingService: { select: { id: true, codigo: true, designacao: true } },
        toRequestingService: { select: { id: true, codigo: true, designacao: true } },
        fromLocation: { select: { id: true, code: true, name: true } },
        toLocation: { select: { id: true, code: true, name: true } },
        fromCustodian: { select: { id: true, name: true, email: true } },
        toCustodian: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json({
      items: rows.map((row: any) => ({
        ...row,
        movementAt: row.movementAt.toISOString(),
        expectedReturnAt: row.expectedReturnAt ? row.expectedReturnAt.toISOString() : null,
        returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  }

  if (req.method === "POST") {
    if (!canMove) return res.status(403).json({ error: "Forbidden" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    try {
      const payload = parsed.data;
      const requiresDocument = ["TRANSFER", "REPAIR_OUT", "REPAIR_IN", "DISPOSAL_INIT", "DISPOSAL_APPROVED", "DISPOSED"].includes(
        payload.type
      );
      if (requiresDocument && !payload.documentRef?.trim()) {
        return res.status(400).json({ error: "documentRef is required for this movement type" });
      }

      const policy = await db.assetPolicy.findFirst({ where: { tenantId } });
      if (payload.type === "TRANSFER" && policy?.requireTransferApproval && !canManage) {
        if (!policy.transferApproverRoleKey) {
          return res.status(403).json({ error: "Transfer policy requires approval role configuration" });
        }
        const canApproveTransfer = await userHasActiveRoleKey(db, tenantId, session.id, policy.transferApproverRoleKey);
        if (!canApproveTransfer) {
          return res.status(403).json({ error: "Transfer requires approver role" });
        }
      }

      const row = await prisma.$transaction(async (tx) => {
        const txAny = tx as any;
        const asset = await txAny.municipalAsset.findFirst({
          where: { id: payload.assetId, tenantId },
          select: {
            id: true,
            status: true,
            requestingServiceId: true,
            locationId: true,
            assignedToUserId: true,
          },
        });
        if (!asset) throw new Error("Asset not found");

        const nextStatus = payload.statusTo || impliedStatus(payload.type) || asset.status;

        const movement = await txAny.municipalAssetMovement.create({
          data: {
            tenantId,
            assetId: payload.assetId,
            type: payload.type,
            statusFrom: asset.status,
            statusTo: nextStatus,
            movementAt: payload.movementAt ? new Date(payload.movementAt) : undefined,
            expectedReturnAt: payload.expectedReturnAt ? new Date(payload.expectedReturnAt) : null,
            returnedAt: payload.returnedAt ? new Date(payload.returnedAt) : null,
            reason: payload.reason?.trim() || null,
            note: payload.note?.trim() || null,
            vendorName: payload.vendorName?.trim() || null,
            cost: payload.cost ?? null,
            documentRef: payload.documentRef?.trim() || null,
            attachments: payload.attachments?.length ? payload.attachments : null,
            actorUserId: session.id,
            fromRequestingServiceId: payload.fromRequestingServiceId ?? asset.requestingServiceId,
            toRequestingServiceId: payload.toRequestingServiceId ?? asset.requestingServiceId,
            fromLocationId: payload.fromLocationId ?? asset.locationId,
            toLocationId: payload.toLocationId ?? asset.locationId,
            fromCustodianUserId: payload.fromCustodianUserId ?? asset.assignedToUserId,
            toCustodianUserId: payload.toCustodianUserId ?? asset.assignedToUserId,
          },
        });

        await txAny.municipalAsset.update({
          where: { id: payload.assetId },
          data: {
            status: nextStatus,
            requestingServiceId: payload.toRequestingServiceId ?? asset.requestingServiceId,
            locationId: payload.toLocationId ?? asset.locationId,
            assignedToUserId: payload.toCustodianUserId ?? asset.assignedToUserId,
          },
        });

        if (nextStatus !== asset.status) {
          await txAny.municipalAssetEvent.create({
            data: {
              tenantId,
              assetId: payload.assetId,
              fromStatus: asset.status,
              toStatus: nextStatus,
              note: payload.note?.trim() || payload.reason?.trim() || `Movimento ${payload.type}`,
              actorUserId: session.id,
            },
          });
        }

        if (
          payload.toRequestingServiceId != null ||
          payload.toCustodianUserId != null ||
          payload.toLocationId != null
        ) {
          await txAny.municipalAssetAssignment.create({
            data: {
              tenantId,
              assetId: payload.assetId,
              userId: payload.toCustodianUserId ?? asset.assignedToUserId,
              requestingServiceId: payload.toRequestingServiceId ?? asset.requestingServiceId,
              note: payload.note?.trim() || `Atribuição via movimento ${payload.type}`,
            },
          });
        }

        return movement;
      });

      return res.status(201).json({
        ...row,
        movementAt: row.movementAt.toISOString(),
        expectedReturnAt: row.expectedReturnAt ? row.expectedReturnAt.toISOString() : null,
        returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Failed to create movement" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
