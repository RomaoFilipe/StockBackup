import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";
import { publishRealtimeEvent } from "@/utils/realtime";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
  requestingServiceId: z.number().int().optional(),
  mustChangePassword: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 150,
    keyPrefix: "admin-users-id",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    if (id === session.id && parsed.data.isActive === false) {
      return res.status(400).json({ error: "Cannot deactivate yourself" });
    }

    try {
      const existing = await prisma.user.findFirst({
        where: { id, tenantId: session.tenantId },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          requestingServiceId: true,
          mustChangePassword: true,
          email: true,
        },
      });
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.role ? { role: parsed.data.role } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
          ...(typeof parsed.data.requestingServiceId === "number" ? { requestingServiceId: parsed.data.requestingServiceId } : {}),
          ...(typeof parsed.data.mustChangePassword === "boolean" ? { mustChangePassword: parsed.data.mustChangePassword } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          requestingServiceId: true,
          requestingService: { select: { id: true, codigo: true, designacao: true } },
        },
      });

      await logUserAdminAction({
        tenantId: session.tenantId,
        actorUserId: session.id,
        targetUserId: id,
        action: "USER_UPDATE",
        note: `User ${existing.email} updated`,
        payload: {
          before: {
            name: existing.name,
            role: existing.role,
            isActive: existing.isActive,
            requestingServiceId: existing.requestingServiceId,
            mustChangePassword: existing.mustChangePassword,
          },
          after: {
            name: updated.name,
            role: updated.role,
            isActive: updated.isActive,
            requestingServiceId: updated.requestingServiceId,
            mustChangePassword: updated.mustChangePassword,
          },
        },
      });

      const roleChanged = existing.role !== updated.role;
      const deactivated = existing.isActive && !updated.isActive;
      if (roleChanged || deactivated) {
        publishRealtimeEvent({
          type: "auth.force_logout",
          tenantId: session.tenantId,
          audience: "USER",
          userId: updated.id,
          payload: {
            reason: roleChanged ? "role_changed" : "deactivated",
            changedByUserId: session.id,
          },
        });
      }

      return res.status(200).json({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PATCH /api/admin/users/[id] error:", error);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  res.setHeader("Allow", ["PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
