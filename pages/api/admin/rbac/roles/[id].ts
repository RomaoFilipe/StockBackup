import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { ensureTenantRbacBootstrap } from "@/utils/rbac";
import { requireAdminOrPermission } from "@/pages/api/admin/_admin";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await requireAdminOrPermission(req, res, "users.manage");
  if (!session) return;

  const tenantId = session.tenantId;
  await ensureTenantRbacBootstrap(prisma, tenantId);

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid role id" });

  const role = await prisma.accessRole.findFirst({
    where: { id, tenantId },
    select: { id: true, key: true, isSystem: true },
  });
  if (!role) return res.status(404).json({ error: "Role not found" });

  if (req.method === "PATCH") {
    if (role.isSystem) return res.status(409).json({ error: "System roles não são editáveis. Duplica o papel primeiro." });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const updated = await prisma.accessRole.update({
      where: { id: role.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      },
      select: { id: true, key: true, name: true, description: true, isSystem: true },
    });

    await db.rbacAudit.create({
      data: {
        tenantId,
        actorUserId: session.id,
        action: "ROLE_UPDATED",
        payload: { roleId: role.id, roleKey: role.key },
      },
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    if (role.isSystem) return res.status(409).json({ error: "System roles não podem ser removidos." });

    const assignments = await prisma.userRoleAssignment.count({
      where: { tenantId, roleId: role.id, isActive: true },
    });
    if (assignments > 0) {
      return res.status(409).json({ error: "Não é possível remover: existem utilizadores com este papel ativo." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.accessRolePermission.deleteMany({ where: { tenantId, roleId: role.id } });
      await tx.accessRole.delete({ where: { id: role.id } });
    });

    await db.rbacAudit.create({
      data: {
        tenantId,
        actorUserId: session.id,
        action: "ROLE_DELETED",
        payload: { roleId: role.id, roleKey: role.key },
      },
    });

    return res.status(204).end();
  }

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

