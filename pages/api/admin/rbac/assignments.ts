import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { requireAdmin } from "@/pages/api/admin/_admin";
import { ensureTenantRbacBootstrap } from "@/utils/rbac";

const createSchema = z.object({
  userId: z.string().uuid(),
  roleKey: z.string().min(2).max(120),
  requestingServiceId: z.number().int().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  assignmentId: z.string().uuid(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

const querySchema = z.object({
  q: z.string().optional(),
  userId: z.string().uuid().optional(),
  roleKey: z.string().max(120).optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await requireAdmin(req, res);
  if (!session) return;

  const tenantId = session.tenantId;
  await ensureTenantRbacBootstrap(prisma, tenantId);

  if (req.method === "GET") {
    const parsedQuery = querySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: "Invalid query", details: parsedQuery.error.flatten() });
    }

    const q = parsedQuery.data.q?.trim();
    const [roles, users, requestingServices, assignments, audits] = await Promise.all([
      prisma.accessRole.findMany({
        where: { tenantId },
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
        include: {
          permissions: {
            include: {
              permission: {
                select: { key: true, name: true },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { tenantId, isActive: true },
        orderBy: [{ role: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          requestingServiceId: true,
          requestingService: { select: { id: true, codigo: true, designacao: true } },
        },
      }),
      prisma.requestingService.findMany({
        where: { ativo: true },
        orderBy: [{ codigo: "asc" }, { designacao: "asc" }],
        select: { id: true, codigo: true, designacao: true, ativo: true },
      }),
      prisma.userRoleAssignment.findMany({
        where: {
          tenantId,
          ...(parsedQuery.data.userId ? { userId: parsedQuery.data.userId } : {}),
          ...(parsedQuery.data.roleKey
            ? {
                role: { key: parsedQuery.data.roleKey },
              }
            : {}),
          ...(parsedQuery.data.isActive ? { isActive: parsedQuery.data.isActive === "true" } : {}),
          ...(q
            ? {
                OR: [
                  { note: { contains: q, mode: "insensitive" } },
                  { role: { name: { contains: q, mode: "insensitive" } } },
                  { role: { key: { contains: q, mode: "insensitive" } } },
                  { user: { name: { contains: q, mode: "insensitive" } } },
                  { user: { email: { contains: q, mode: "insensitive" } } },
                  { requestingService: { designacao: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          role: { select: { id: true, key: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
          requestingService: { select: { id: true, codigo: true, designacao: true } },
          assignedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      db.rbacAudit.findMany({
        where: { tenantId },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return res.status(200).json({
      roles: roles.map((role: any) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        permissions: role.permissions.map((rp: any) => ({
          key: rp.permission.key,
          name: rp.permission.name,
        })),
      })),
      users,
      requestingServices,
      assignments: assignments.map((assignment: any) => ({
        id: assignment.id,
        isActive: assignment.isActive,
        note: assignment.note,
        startsAt: assignment.startsAt ? assignment.startsAt.toISOString() : null,
        endsAt: assignment.endsAt ? assignment.endsAt.toISOString() : null,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
        role: assignment.role,
        user: assignment.user,
        requestingService: assignment.requestingService,
        assignedBy: assignment.assignedBy,
      })),
      audits: audits.map((audit: any) => ({
        id: audit.id,
        action: audit.action,
        note: audit.note,
        payload: audit.payload,
        createdAt: audit.createdAt.toISOString(),
        actor: audit.actor,
      })),
    });
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const { userId, roleKey, requestingServiceId, startsAt, endsAt, note, isActive } = parsed.data;
    const startsAtDate = startsAt ? new Date(startsAt) : null;
    const endsAtDate = endsAt ? new Date(endsAt) : null;

    if (startsAtDate && endsAtDate && startsAtDate >= endsAtDate) {
      return res.status(400).json({ error: "endsAt must be after startsAt" });
    }

    const [user, role] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } }),
      prisma.accessRole.findFirst({ where: { tenantId, key: roleKey }, select: { id: true, key: true } }),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!role) return res.status(404).json({ error: "Role not found" });

    if (requestingServiceId != null) {
      const svc = await prisma.requestingService.findUnique({ where: { id: requestingServiceId }, select: { id: true } });
      if (!svc) return res.status(400).json({ error: "Invalid requestingServiceId" });
    }

    const created = await prisma.userRoleAssignment.create({
      data: {
        tenantId,
        userId,
        roleId: role.id,
        requestingServiceId: requestingServiceId ?? null,
        startsAt: startsAtDate,
        endsAt: endsAtDate,
        note: note?.trim() || null,
        isActive: isActive ?? true,
        assignedByUserId: session.id,
      },
      include: {
        role: { select: { id: true, key: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        requestingService: { select: { id: true, codigo: true, designacao: true } },
      },
    });

    await db.rbacAudit.create({
      data: {
        tenantId,
        actorUserId: session.id,
        action: "ASSIGNMENT_CREATED",
        note: note?.trim() || null,
        payload: {
          assignmentId: created.id,
          userId,
          roleKey,
          requestingServiceId: requestingServiceId ?? null,
          startsAt: startsAtDate ? startsAtDate.toISOString() : null,
          endsAt: endsAtDate ? endsAtDate.toISOString() : null,
          isActive: isActive ?? true,
        },
      },
    });

    return res.status(201).json({
      id: created.id,
      isActive: created.isActive,
      note: created.note,
      startsAt: created.startsAt ? created.startsAt.toISOString() : null,
      endsAt: created.endsAt ? created.endsAt.toISOString() : null,
      createdAt: created.createdAt.toISOString(),
      role: created.role,
      user: created.user,
      requestingService: created.requestingService,
    });
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    }

    const current = await prisma.userRoleAssignment.findFirst({
      where: {
        id: parsed.data.assignmentId,
        tenantId,
      },
      select: { id: true, startsAt: true, endsAt: true },
    });
    if (!current) return res.status(404).json({ error: "Assignment not found" });

    const data: {
      isActive?: boolean;
      startsAt?: Date | null;
      endsAt?: Date | null;
      note?: string | null;
    } = {};

    let nextStartsAt: Date | null | undefined;
    let nextEndsAt: Date | null | undefined;

    if (Object.prototype.hasOwnProperty.call(parsed.data, "isActive")) {
      data.isActive = parsed.data.isActive;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "startsAt")) {
      nextStartsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
      data.startsAt = nextStartsAt;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "endsAt")) {
      nextEndsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
      data.endsAt = nextEndsAt;
    }
    if (Object.prototype.hasOwnProperty.call(parsed.data, "note")) {
      data.note = parsed.data.note?.trim() || null;
    }

    const finalStartsAt = nextStartsAt === undefined ? current.startsAt : nextStartsAt;
    const finalEndsAt = nextEndsAt === undefined ? current.endsAt : nextEndsAt;

    if (finalStartsAt && finalEndsAt && finalStartsAt >= finalEndsAt) {
      return res.status(400).json({ error: "endsAt must be after startsAt" });
    }

    const updated = await prisma.userRoleAssignment.update({
      where: { id: parsed.data.assignmentId },
      data,
      include: {
        role: { select: { id: true, key: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        assignedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await db.rbacAudit.create({
      data: {
        tenantId,
        actorUserId: session.id,
        action: "ASSIGNMENT_UPDATED",
        note: data.note ?? null,
        payload: {
          assignmentId: updated.id,
          isActive: updated.isActive,
          startsAt: updated.startsAt ? updated.startsAt.toISOString() : null,
          endsAt: updated.endsAt ? updated.endsAt.toISOString() : null,
        },
      },
    });

    return res.status(200).json({
      id: updated.id,
      isActive: updated.isActive,
      note: updated.note,
      startsAt: updated.startsAt ? updated.startsAt.toISOString() : null,
      endsAt: updated.endsAt ? updated.endsAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      role: updated.role,
      user: updated.user,
      requestingService: updated.requestingService,
      assignedBy: updated.assignedBy,
    });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
