import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { ensureTenantRbacBootstrap } from "@/utils/rbac";
import { requireAdminOrPermission } from "@/pages/api/admin/_admin";

const patchSchema = z.object({
  permissionKey: z.string().trim().min(2).max(120),
  enabled: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await requireAdminOrPermission(req, res, "users.manage");
  if (!session) return;

  const tenantId = session.tenantId;
  await ensureTenantRbacBootstrap(prisma, tenantId);

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid role id" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  const role = await prisma.accessRole.findFirst({
    where: { id, tenantId },
    select: { id: true, key: true, isSystem: true },
  });
  if (!role) return res.status(404).json({ error: "Role not found" });
  if (role.isSystem) return res.status(409).json({ error: "System roles não são editáveis. Duplica o papel primeiro." });

  const permission = await prisma.accessPermission.findFirst({
    where: { tenantId, key: parsed.data.permissionKey },
    select: { id: true, key: true },
  });
  if (!permission) return res.status(404).json({ error: "Permission not found" });

  if (parsed.data.enabled) {
    await prisma.accessRolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      create: { tenantId, roleId: role.id, permissionId: permission.id },
      update: {},
    });
  } else {
    await prisma.accessRolePermission.deleteMany({
      where: { tenantId, roleId: role.id, permissionId: permission.id },
    });
  }

  await db.rbacAudit.create({
    data: {
      tenantId,
      actorUserId: session.id,
      action: "ROLE_PERMISSION_CHANGED",
      payload: { roleId: role.id, roleKey: role.key, permissionKey: permission.key, enabled: parsed.data.enabled },
    },
  });

  return res.status(200).json({ ok: true });
}

