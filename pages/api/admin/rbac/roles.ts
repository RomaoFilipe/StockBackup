import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { ensureTenantRbacBootstrap } from "@/utils/rbac";
import { requireAdminOrPermission } from "@/pages/api/admin/_admin";

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[A-Z0-9_]+$/, "Use apenas A-Z, 0-9 e _"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  cloneFromRoleKey: z.string().trim().min(2).max(120).optional().nullable(),
});

const querySchema = z.object({
  includeSystem: z.enum(["1", "0"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await requireAdminOrPermission(req, res, "users.manage");
  if (!session) return;

  const tenantId = session.tenantId;
  await ensureTenantRbacBootstrap(prisma, tenantId);

  if (req.method === "GET") {
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: "Invalid query", details: parsedQuery.error.flatten() });
    }
    const includeSystem = parsedQuery.data.includeSystem !== "0";

    const roles = await prisma.accessRole.findMany({
      where: { tenantId, ...(includeSystem ? {} : { isSystem: false }) },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: {
        permissions: {
          include: { permission: { select: { key: true, name: true } } },
        },
      },
    });

    return res.status(200).json(
      roles.map((role: any) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.permissions.map((rp: any) => ({
          key: rp.permission.key,
          name: rp.permission.name,
        })),
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const { key, name, description, cloneFromRoleKey } = parsed.data;

    const existing = await prisma.accessRole.findFirst({
      where: { tenantId, key },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: "Role key already exists" });

    let cloneFrom: any = null;
    if (cloneFromRoleKey) {
      cloneFrom = await prisma.accessRole.findFirst({
        where: { tenantId, key: cloneFromRoleKey },
        select: {
          id: true,
          key: true,
          permissions: { select: { permissionId: true } },
        },
      });
      if (!cloneFrom) return res.status(400).json({ error: "cloneFromRoleKey inválido" });
    }

    const created = await prisma.$transaction(async (tx) => {
      const role = await tx.accessRole.create({
        data: {
          tenantId,
          key,
          name,
          description: description ?? null,
          isSystem: false,
        },
        select: { id: true, key: true, name: true, description: true, isSystem: true },
      });

      if (cloneFrom?.permissions?.length) {
        await tx.accessRolePermission.createMany({
          data: cloneFrom.permissions.map((p: any) => ({
            tenantId,
            roleId: role.id,
            permissionId: p.permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return role;
    });

    await db.rbacAudit.create({
      data: {
        tenantId,
        actorUserId: session.id,
        action: "ROLE_CREATED",
        note: `Role ${created.key} criado`,
        payload: { roleKey: created.key, cloneFromRoleKey: cloneFromRoleKey ?? null },
      },
    });

    return res.status(201).json(created);
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

