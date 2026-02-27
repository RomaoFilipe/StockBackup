import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const updateSchema = z.object({
  code: z.string().min(2).max(60).optional(),
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  status: z
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
    .optional(),
  criticality: z.enum(["OPERATIONAL", "SECURITY", "ESSENTIAL"]).optional(),
  usefulLifeMonths: z.number().int().positive().optional().nullable(),
  depreciationMethod: z.enum(["NONE", "STRAIGHT_LINE"]).optional(),
  serialNumber: z.string().max(160).optional().nullable(),
  assetTag: z.string().max(160).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  requestingServiceId: z.number().int().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  modelId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  productUnitId: z.string().uuid().optional().nullable(),
  acquisitionDate: z.string().datetime().optional().nullable(),
  acquisitionValue: z.number().nonnegative().optional().nullable(),
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
  const canView = canManage || hasPermission(grants, "assets.view") || hasPermission(grants, "assets.audit_view");
  const canMove = canManage || hasPermission(grants, "assets.move");
  const canDispose = canManage || hasPermission(grants, "assets.dispose");

  if (req.method === "GET") {
    if (!canView) return res.status(403).json({ error: "Forbidden" });
    const row = await db.municipalAsset.findFirst({
      where: { id, tenantId },
      include: {
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, key: true, name: true, requiresSerialNumber: true } },
        model: { select: { id: true, brand: true, model: true } },
        locationRef: { select: { id: true, code: true, name: true, parentId: true } },
        product: { select: { id: true, sku: true, name: true } },
        productUnit: { select: { id: true, code: true, status: true, serialNumber: true, assetTag: true } },
        events: {
          orderBy: [{ createdAt: "desc" }],
          include: { actor: { select: { id: true, name: true, email: true } } },
        },
        assignments: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            user: { select: { id: true, name: true, email: true } },
            requestingService: { select: { id: true, codigo: true, designacao: true } },
          },
        },
        movements: {
          orderBy: [{ movementAt: "desc" }],
          include: {
            actor: { select: { id: true, name: true, email: true } },
            fromRequestingService: { select: { id: true, codigo: true, designacao: true } },
            toRequestingService: { select: { id: true, codigo: true, designacao: true } },
            fromLocation: { select: { id: true, name: true, code: true } },
            toLocation: { select: { id: true, name: true, code: true } },
            fromCustodian: { select: { id: true, name: true, email: true } },
            toCustodian: { select: { id: true, name: true, email: true } },
          },
        },
        disposalProcesses: {
          orderBy: [{ openedAt: "desc" }],
          include: {
            openedBy: { select: { id: true, name: true, email: true } },
            decidedBy: { select: { id: true, name: true, email: true } },
          },
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
      assignments: row.assignments.map((assignment: any) => ({
        ...assignment,
        startAt: assignment.startAt.toISOString(),
        endAt: assignment.endAt ? assignment.endAt.toISOString() : null,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
      })),
      movements: row.movements.map((movement: any) => ({
        ...movement,
        movementAt: movement.movementAt.toISOString(),
        expectedReturnAt: movement.expectedReturnAt ? movement.expectedReturnAt.toISOString() : null,
        returnedAt: movement.returnedAt ? movement.returnedAt.toISOString() : null,
        createdAt: movement.createdAt.toISOString(),
        updatedAt: movement.updatedAt.toISOString(),
      })),
      disposalProcesses: row.disposalProcesses.map((process: any) => ({
        ...process,
        openedAt: process.openedAt.toISOString(),
        closedAt: process.closedAt ? process.closedAt.toISOString() : null,
        createdAt: process.createdAt.toISOString(),
        updatedAt: process.updatedAt.toISOString(),
      })),
    });
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    const current = await db.municipalAsset.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        requestingServiceId: true,
        assignedToUserId: true,
        locationId: true,
        location: true,
      },
    });
    if (!current) return res.status(404).json({ error: "Not found" });

    const payload = parsed.data;
    const metadataChange =
      Object.prototype.hasOwnProperty.call(payload, "code") ||
      Object.prototype.hasOwnProperty.call(payload, "name") ||
      Object.prototype.hasOwnProperty.call(payload, "description") ||
      Object.prototype.hasOwnProperty.call(payload, "category") ||
      Object.prototype.hasOwnProperty.call(payload, "criticality") ||
      Object.prototype.hasOwnProperty.call(payload, "usefulLifeMonths") ||
      Object.prototype.hasOwnProperty.call(payload, "depreciationMethod") ||
      Object.prototype.hasOwnProperty.call(payload, "serialNumber") ||
      Object.prototype.hasOwnProperty.call(payload, "assetTag") ||
      Object.prototype.hasOwnProperty.call(payload, "classId") ||
      Object.prototype.hasOwnProperty.call(payload, "modelId") ||
      Object.prototype.hasOwnProperty.call(payload, "productId") ||
      Object.prototype.hasOwnProperty.call(payload, "productUnitId") ||
      Object.prototype.hasOwnProperty.call(payload, "acquisitionDate") ||
      Object.prototype.hasOwnProperty.call(payload, "acquisitionValue");

    const movementLikeChange =
      Object.prototype.hasOwnProperty.call(payload, "status") ||
      Object.prototype.hasOwnProperty.call(payload, "location") ||
      Object.prototype.hasOwnProperty.call(payload, "locationId") ||
      Object.prototype.hasOwnProperty.call(payload, "assignedToUserId") ||
      Object.prototype.hasOwnProperty.call(payload, "requestingServiceId");

    if ((metadataChange && !canManage) || (movementLikeChange && !(canMove || canManage))) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (payload.status && (payload.status === "TO_DISPOSE" || payload.status === "DISPOSED") && !(canDispose || canManage)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        if (payload.assignedToUserId) {
          const assignedUser = await txAny.user.findFirst({ where: { id: payload.assignedToUserId, tenantId }, select: { id: true } });
          if (!assignedUser) throw new Error("Assigned user not found");
        }
        if (payload.requestingServiceId != null) {
          const svc = await txAny.requestingService.findUnique({ where: { id: payload.requestingServiceId }, select: { id: true } });
          if (!svc) throw new Error("Requesting service not found");
        }
        if (payload.classId) {
          const cls = await txAny.municipalAssetClass.findFirst({ where: { id: payload.classId, tenantId }, select: { id: true, requiresSerialNumber: true } });
          if (!cls) throw new Error("Class not found");
          if (cls.requiresSerialNumber && !payload.serialNumber?.trim()) {
            throw new Error("Serial number is mandatory for the selected class");
          }
        }

        const row = await txAny.municipalAsset.update({
          where: { id },
          data: {
            ...(Object.prototype.hasOwnProperty.call(payload, "code") ? { code: payload.code?.trim() } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "name") ? { name: payload.name?.trim() } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "description") ? { description: payload.description?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "category") ? { category: payload.category?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "status") ? { status: payload.status } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "criticality") ? { criticality: payload.criticality } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "usefulLifeMonths") ? { usefulLifeMonths: payload.usefulLifeMonths ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "depreciationMethod") ? { depreciationMethod: payload.depreciationMethod } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "serialNumber") ? { serialNumber: payload.serialNumber?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "assetTag") ? { assetTag: payload.assetTag?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "location") ? { location: payload.location?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "locationId") ? { locationId: payload.locationId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "notes") ? { notes: payload.notes?.trim() || null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "assignedToUserId") ? { assignedToUserId: payload.assignedToUserId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "requestingServiceId") ? { requestingServiceId: payload.requestingServiceId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "classId") ? { classId: payload.classId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "modelId") ? { modelId: payload.modelId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "productId") ? { productId: payload.productId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "productUnitId") ? { productUnitId: payload.productUnitId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "acquisitionDate") ? { acquisitionDate: payload.acquisitionDate ? new Date(payload.acquisitionDate) : null } : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "acquisitionValue") ? { acquisitionValue: payload.acquisitionValue ?? null } : {}),
          },
        });

        if (payload.status && payload.status !== current.status) {
          await txAny.municipalAssetEvent.create({
            data: {
              tenantId,
              assetId: id,
              fromStatus: current.status,
              toStatus: payload.status,
              note: payload.note?.trim() || null,
              actorUserId: session.id,
            },
          });

          await txAny.municipalAssetMovement.create({
            data: {
              tenantId,
              assetId: id,
              type: "STATUS_CHANGE",
              statusFrom: current.status,
              statusTo: payload.status,
              note: payload.note?.trim() || "Alteração de estado",
              actorUserId: session.id,
              fromRequestingServiceId: current.requestingServiceId,
              toRequestingServiceId: row.requestingServiceId,
              fromLocationId: current.locationId,
              toLocationId: row.locationId,
              fromCustodianUserId: current.assignedToUserId,
              toCustodianUserId: row.assignedToUserId,
            },
          });
        }

        const assignmentChanged =
          Object.prototype.hasOwnProperty.call(payload, "assignedToUserId") ||
          Object.prototype.hasOwnProperty.call(payload, "requestingServiceId") ||
          Object.prototype.hasOwnProperty.call(payload, "locationId") ||
          Object.prototype.hasOwnProperty.call(payload, "location");

        if (assignmentChanged) {
          await txAny.municipalAssetAssignment.create({
            data: {
              tenantId,
              assetId: id,
              userId: row.assignedToUserId ?? null,
              requestingServiceId: row.requestingServiceId ?? null,
              note: payload.note?.trim() || "Atualização de afetação/custódia",
            },
          });

          await txAny.municipalAssetMovement.create({
            data: {
              tenantId,
              assetId: id,
              type: "TRANSFER",
              statusFrom: row.status,
              statusTo: row.status,
              note: payload.note?.trim() || "Transferência/afetação administrativa",
              actorUserId: session.id,
              fromRequestingServiceId: current.requestingServiceId,
              toRequestingServiceId: row.requestingServiceId,
              fromLocationId: current.locationId,
              toLocationId: row.locationId,
              fromCustodianUserId: current.assignedToUserId,
              toCustodianUserId: row.assignedToUserId,
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
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Failed to update asset" });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
