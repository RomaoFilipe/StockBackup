import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const createSchema = z.object({
  code: z.string().min(2).max(60).optional(),
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
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
  acquisitionDate: z.string().datetime().optional().nullable(),
  acquisitionValue: z.number().nonnegative().optional().nullable(),
  requestingServiceId: z.number().int().optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
  modelId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  productUnitId: z.string().uuid().optional().nullable(),
  requestId: z.string().uuid().optional().nullable(),
});

async function generateAssetCode(tx: any, tenantId: string) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = String(Date.now()).slice(-6);
    const code = `AST-${year}-${suffix}${attempt ? `-${attempt}` : ""}`;
    const exists = await tx.municipalAsset.findFirst({ where: { tenantId, code }, select: { id: true } });
    if (!exists) return code;
  }
  return `AST-${year}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");
  const canView = canManage || hasPermission(grants, "assets.view") || hasPermission(grants, "assets.audit_view");
  const canCreate = canManage || hasPermission(grants, "assets.create");

  if (req.method === "GET") {
    if (!canView) return res.status(403).json({ error: "Forbidden" });

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const classId = typeof req.query.classId === "string" ? req.query.classId : undefined;
    const locationId = typeof req.query.locationId === "string" ? req.query.locationId : undefined;
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const includeMeta = String(req.query.includeMeta || "").toLowerCase() === "true";

    const rows = await db.municipalAsset.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
        ...(classId ? { classId } : {}),
        ...(locationId ? { locationId } : {}),
        ...(productId ? { productId } : {}),
        ...(q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { location: { contains: q, mode: "insensitive" } },
                { serialNumber: { contains: q, mode: "insensitive" } },
                { assetTag: { contains: q, mode: "insensitive" } },
                { product: { name: { contains: q, mode: "insensitive" } } },
                { product: { sku: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      include: {
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, key: true, name: true, requiresSerialNumber: true } },
        model: { select: { id: true, brand: true, model: true } },
        locationRef: { select: { id: true, code: true, name: true, parentId: true } },
        product: { select: { id: true, sku: true, name: true } },
        productUnit: { select: { id: true, code: true, status: true, serialNumber: true, assetTag: true } },
        movements: {
          orderBy: [{ movementAt: "desc" }],
          take: 1,
          select: { id: true, type: true, movementAt: true, statusTo: true },
        },
      },
    });

    if (!includeMeta) {
      return res.status(200).json({
        items: rows.map((row: any) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          acquisitionDate: row.acquisitionDate ? row.acquisitionDate.toISOString() : null,
          movements: row.movements.map((m: any) => ({ ...m, movementAt: m.movementAt.toISOString() })),
        })),
      });
    }

    const [classes, models, locations, products, units, users, services] = await Promise.all([
      db.municipalAssetClass.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, key: true, name: true, requiresSerialNumber: true, defaultUsefulLifeMonths: true, defaultDepreciationMethod: true },
      }),
      db.municipalAssetModel.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ brand: "asc" }, { model: "asc" }],
        select: { id: true, brand: true, model: true, classId: true },
      }),
      db.municipalAssetLocation.findMany({
        where: { tenantId },
        orderBy: [{ level: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, parentId: true, level: true },
      }),
      db.product.findMany({
        where: { tenantId },
        orderBy: [{ name: "asc" }],
        take: 300,
        select: { id: true, sku: true, name: true, categoryId: true, isPatrimonializable: true },
      }),
      db.productUnit.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: { id: true, code: true, status: true, serialNumber: true, productId: true },
      }),
      db.user.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, email: true },
      }),
      db.requestingService.findMany({
        where: { ativo: true },
        orderBy: [{ codigo: "asc" }, { designacao: "asc" }],
        select: { id: true, codigo: true, designacao: true },
      }),
    ]);
    const [categories, categoryMaps, policy] = await Promise.all([
      db.category.findMany({
        where: { tenantId },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true },
      }),
      db.assetCategoryClassMap.findMany({
        where: { tenantId },
        select: { id: true, categoryId: true, classId: true },
      }),
      db.assetPolicy.findFirst({
        where: { tenantId },
        select: {
          id: true,
          requireTransferApproval: true,
          requireDisposalApproval: true,
          transferApproverRoleKey: true,
          disposalApproverRoleKey: true,
        },
      }),
    ]);

    return res.status(200).json({
      items: rows.map((row: any) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        acquisitionDate: row.acquisitionDate ? row.acquisitionDate.toISOString() : null,
        movements: row.movements.map((m: any) => ({ ...m, movementAt: m.movementAt.toISOString() })),
      })),
      meta: {
        classes,
        models,
        locations,
        products,
        units,
        users,
        requestingServices: services,
        categories,
        categoryMaps,
        policy,
      },
    });
  }

  if (req.method === "POST") {
    if (!canCreate) return res.status(403).json({ error: "Forbidden" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    try {
      const payload = parsed.data;
      if (!payload.name?.trim() && !payload.productId) {
        return res.status(400).json({ error: "name or productId is required" });
      }

      const created = await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        const [linkedClass, linkedModel, linkedLocation, linkedProduct, linkedUnit] = await Promise.all([
          payload.classId
            ? txAny.municipalAssetClass.findFirst({ where: { id: payload.classId, tenantId }, select: { id: true, requiresSerialNumber: true, name: true, defaultUsefulLifeMonths: true, defaultDepreciationMethod: true } })
            : null,
          payload.modelId
            ? txAny.municipalAssetModel.findFirst({ where: { id: payload.modelId, tenantId }, select: { id: true, brand: true, model: true } })
            : null,
          payload.locationId
            ? txAny.municipalAssetLocation.findFirst({ where: { id: payload.locationId, tenantId }, select: { id: true, name: true } })
            : null,
          payload.productId
            ? txAny.product.findFirst({ where: { id: payload.productId, tenantId }, select: { id: true, name: true, categoryId: true } })
            : null,
          payload.productUnitId
            ? txAny.productUnit.findFirst({ where: { id: payload.productUnitId, tenantId }, select: { id: true, productId: true, serialNumber: true, assetTag: true } })
            : null,
        ]);

        if (payload.classId && !linkedClass) throw new Error("Class not found");
        if (payload.modelId && !linkedModel) throw new Error("Model not found");
        if (payload.locationId && !linkedLocation) throw new Error("Location not found");
        if (payload.productId && !linkedProduct) throw new Error("Product not found");
        if (payload.productUnitId && !linkedUnit) throw new Error("Product unit not found");

        if (linkedUnit?.productId && payload.productId && linkedUnit.productId !== payload.productId) {
          throw new Error("Product unit does not belong to the selected product");
        }

        const serial = payload.serialNumber?.trim() || linkedUnit?.serialNumber || null;
        if (linkedClass?.requiresSerialNumber && !serial) {
          throw new Error("Serial number is mandatory for the selected class");
        }

        if (payload.assignedToUserId) {
          const assignedUser = await txAny.user.findFirst({ where: { id: payload.assignedToUserId, tenantId }, select: { id: true } });
          if (!assignedUser) throw new Error("Assigned user not found");
        }

        if (payload.requestingServiceId != null) {
          const svc = await txAny.requestingService.findUnique({ where: { id: payload.requestingServiceId }, select: { id: true } });
          if (!svc) throw new Error("Requesting service not found");
        }

        const mappedClassId =
          !payload.classId && linkedProduct?.categoryId
            ? (
                await txAny.assetCategoryClassMap.findFirst({
                  where: { tenantId, categoryId: linkedProduct.categoryId },
                  select: { classId: true },
                })
              )?.classId ?? null
            : null;

        const status = payload.status ?? "REGISTERED";
        const code = payload.code?.trim() || (await generateAssetCode(txAny, tenantId));
        const name = payload.name?.trim() || linkedProduct?.name;
        if (!name) throw new Error("Could not resolve asset name");

        const asset = await txAny.municipalAsset.create({
          data: {
            tenantId,
            code,
            name,
            description: payload.description?.trim() || null,
            category: payload.category?.trim() || linkedClass?.name || null,
            status,
            location: payload.location?.trim() || linkedLocation?.name || null,
            serialNumber: serial,
            assetTag: payload.assetTag?.trim() || linkedUnit?.assetTag || null,
            criticality: payload.criticality ?? "OPERATIONAL",
            usefulLifeMonths: payload.usefulLifeMonths ?? linkedClass?.defaultUsefulLifeMonths ?? null,
            depreciationMethod: payload.depreciationMethod ?? linkedClass?.defaultDepreciationMethod ?? "NONE",
            notes: payload.notes?.trim() || null,
            acquisitionDate: payload.acquisitionDate ? new Date(payload.acquisitionDate) : null,
            acquisitionValue: payload.acquisitionValue ?? null,
            requestingServiceId: payload.requestingServiceId ?? null,
            requestId: payload.requestId ?? null,
            assignedToUserId: payload.assignedToUserId ?? null,
            classId: payload.classId ?? mappedClassId ?? null,
            modelId: payload.modelId ?? null,
            locationId: payload.locationId ?? null,
            productId: payload.productId ?? linkedUnit?.productId ?? null,
            productUnitId: payload.productUnitId ?? null,
          },
        });

        await txAny.municipalAssetEvent.create({
          data: {
            tenantId,
            assetId: asset.id,
            fromStatus: null,
            toStatus: status,
            note: "Ativo registado",
            actorUserId: session.id,
          },
        });

        await txAny.municipalAssetMovement.create({
          data: {
            tenantId,
            assetId: asset.id,
            type: "REGISTER",
            statusFrom: null,
            statusTo: status,
            actorUserId: session.id,
            note: payload.notes?.trim() || "Registo inicial do ativo",
            toRequestingServiceId: payload.requestingServiceId ?? null,
            toLocationId: payload.locationId ?? null,
            toCustodianUserId: payload.assignedToUserId ?? null,
          },
        });

        if (payload.assignedToUserId || payload.requestingServiceId) {
          await txAny.municipalAssetAssignment.create({
            data: {
              tenantId,
              assetId: asset.id,
              userId: payload.assignedToUserId ?? null,
              requestingServiceId: payload.requestingServiceId ?? null,
              note: "Atribuição inicial",
            },
          });
        }

        return asset;
      });

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        acquisitionDate: created.acquisitionDate ? created.acquisitionDate.toISOString() : null,
      });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Failed to create asset" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
