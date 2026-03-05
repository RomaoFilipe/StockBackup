import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const classSchema = z.object({
  kind: z.literal("class"),
  key: z.string().min(2).max(80),
  name: z.string().min(2).max(120),
  description: z.string().max(800).optional().nullable(),
  requiresSerialNumber: z.boolean().optional(),
  defaultUsefulLifeMonths: z.number().int().positive().optional().nullable(),
  defaultDepreciationMethod: z.enum(["NONE", "STRAIGHT_LINE"]).optional().nullable(),
});

const modelSchema = z.object({
  kind: z.literal("model"),
  brand: z.string().min(2).max(120),
  model: z.string().min(1).max(120),
  description: z.string().max(800).optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
});

const locationSchema = z.object({
  kind: z.literal("location"),
  code: z.string().max(80).optional().nullable(),
  name: z.string().min(2).max(200),
  parentId: z.string().uuid().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

const categoryMapSchema = z.object({
  kind: z.literal("categoryMap"),
  categoryId: z.string().uuid(),
  classId: z.string().uuid(),
});

const policySchema = z.object({
  kind: z.literal("policy"),
  requireTransferApproval: z.boolean().optional(),
  requireDisposalApproval: z.boolean().optional(),
  transferApproverRoleKey: z.string().max(120).optional().nullable(),
  disposalApproverRoleKey: z.string().max(120).optional().nullable(),
});

const createSchema = z.discriminatedUnion("kind", [classSchema, modelSchema, locationSchema, categoryMapSchema, policySchema]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = session.tenantId;
  const grants = await getUserPermissionGrants(prisma, { id: session.id, tenantId, role: session.role });
  const canManage = session.role === "ADMIN" || hasPermission(grants, "assets.manage");
  const canView = canManage || hasPermission(grants, "assets.view") || hasPermission(grants, "assets.audit_view");

  if (req.method === "GET") {
    if (!canView) return res.status(403).json({ error: "Forbidden" });

    const [classes, models, locations, categoryMaps, policy] = await Promise.all([
      db.municipalAssetClass.findMany({ where: { tenantId }, orderBy: [{ name: "asc" }] }),
      db.municipalAssetModel.findMany({ where: { tenantId }, orderBy: [{ brand: "asc" }, { model: "asc" }] }),
      db.municipalAssetLocation.findMany({ where: { tenantId }, orderBy: [{ level: "asc" }, { name: "asc" }] }),
      db.assetCategoryClassMap.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }],
        include: {
          category: { select: { id: true, name: true } },
          class: { select: { id: true, key: true, name: true } },
        },
      }),
      db.assetPolicy.findFirst({ where: { tenantId } }),
    ]);

    return res.status(200).json({
      classes: classes.map((c: any) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() })),
      models: models.map((m: any) => ({ ...m, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })),
      locations: locations.map((l: any) => ({ ...l, createdAt: l.createdAt.toISOString(), updatedAt: l.updatedAt.toISOString() })),
      categoryMaps: categoryMaps.map((m: any) => ({ ...m, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() })),
      policy: policy
        ? { ...policy, createdAt: policy.createdAt.toISOString(), updatedAt: policy.updatedAt.toISOString() }
        : null,
    });
  }

  if (req.method === "POST") {
    if (!canManage) return res.status(403).json({ error: "Forbidden" });

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

    try {
      const payload = parsed.data;
      if (payload.kind === "class") {
        const row = await db.municipalAssetClass.create({
          data: {
            tenantId,
            key: payload.key.trim().toUpperCase(),
            name: payload.name.trim(),
            description: payload.description?.trim() || null,
            requiresSerialNumber: payload.requiresSerialNumber ?? false,
            defaultUsefulLifeMonths: payload.defaultUsefulLifeMonths ?? null,
            defaultDepreciationMethod: payload.defaultDepreciationMethod ?? null,
          },
        });
        return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
      }

      if (payload.kind === "model") {
        if (payload.classId) {
          const cls = await db.municipalAssetClass.findFirst({ where: { id: payload.classId, tenantId }, select: { id: true } });
          if (!cls) return res.status(400).json({ error: "Invalid classId" });
        }
        const row = await db.municipalAssetModel.create({
          data: {
            tenantId,
            brand: payload.brand.trim(),
            model: payload.model.trim(),
            description: payload.description?.trim() || null,
            classId: payload.classId ?? null,
          },
        });
        return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
      }

      if (payload.kind === "categoryMap") {
        const [category, cls] = await Promise.all([
          db.category.findFirst({ where: { id: payload.categoryId, tenantId }, select: { id: true, name: true } }),
          db.municipalAssetClass.findFirst({ where: { id: payload.classId, tenantId }, select: { id: true, name: true } }),
        ]);
        if (!category) return res.status(400).json({ error: "Invalid categoryId" });
        if (!cls) return res.status(400).json({ error: "Invalid classId" });

        const row = await db.assetCategoryClassMap.upsert({
          where: { tenantId_categoryId: { tenantId, categoryId: payload.categoryId } },
          create: {
            tenantId,
            categoryId: payload.categoryId,
            classId: payload.classId,
          },
          update: { classId: payload.classId },
        });
        return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
      }

      if (payload.kind === "policy") {
        const row = await db.assetPolicy.upsert({
          where: { tenantId },
          create: {
            tenantId,
            requireTransferApproval: payload.requireTransferApproval ?? true,
            requireDisposalApproval: payload.requireDisposalApproval ?? true,
            transferApproverRoleKey: payload.transferApproverRoleKey?.trim() || null,
            disposalApproverRoleKey: payload.disposalApproverRoleKey?.trim() || null,
          },
          update: {
            ...(Object.prototype.hasOwnProperty.call(payload, "requireTransferApproval")
              ? { requireTransferApproval: payload.requireTransferApproval }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "requireDisposalApproval")
              ? { requireDisposalApproval: payload.requireDisposalApproval }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "transferApproverRoleKey")
              ? { transferApproverRoleKey: payload.transferApproverRoleKey?.trim() || null }
              : {}),
            ...(Object.prototype.hasOwnProperty.call(payload, "disposalApproverRoleKey")
              ? { disposalApproverRoleKey: payload.disposalApproverRoleKey?.trim() || null }
              : {}),
          },
        });
        return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
      }

      let level = 0;
      if (payload.parentId) {
        const parent = await db.municipalAssetLocation.findFirst({
          where: { id: payload.parentId, tenantId },
          select: { id: true, level: true },
        });
        if (!parent) return res.status(400).json({ error: "Invalid parentId" });
        level = parent.level + 1;
      }

      const row = await db.municipalAssetLocation.create({
        data: {
          tenantId,
          code: payload.code?.trim() || null,
          name: payload.name.trim(),
          parentId: payload.parentId ?? null,
          note: payload.note?.trim() || null,
          level,
        },
      });
      return res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || "Failed to create catalog item" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
