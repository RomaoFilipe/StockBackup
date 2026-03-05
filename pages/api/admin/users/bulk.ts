import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";
import { publishRealtimeEvent } from "@/utils/realtime";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["SET_ACTIVE", "SET_ROLE", "SET_MUST_CHANGE_PASSWORD"]),
  isActive: z.boolean().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  mustChangePassword: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 40,
    keyPrefix: "admin-users-bulk",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { ids, action } = parsed.data;

  if (action === "SET_ACTIVE" && parsed.data.isActive === false && ids.includes(session.id)) {
    return res.status(400).json({ error: "Cannot deactivate yourself" });
  }

  const users = await prisma.user.findMany({
    where: { tenantId: session.tenantId, id: { in: ids } },
    select: { id: true },
  });
  const existingIds = new Set(users.map((u) => u.id));
  if (existingIds.size === 0) {
    return res.status(404).json({ error: "No users found" });
  }

  const data: any = {};
  if (action === "SET_ACTIVE") {
    if (typeof parsed.data.isActive !== "boolean") return res.status(400).json({ error: "isActive is required" });
    data.isActive = parsed.data.isActive;
  } else if (action === "SET_ROLE") {
    if (!parsed.data.role) return res.status(400).json({ error: "role is required" });
    data.role = parsed.data.role;
  } else if (action === "SET_MUST_CHANGE_PASSWORD") {
    if (typeof parsed.data.mustChangePassword !== "boolean") {
      return res.status(400).json({ error: "mustChangePassword is required" });
    }
    data.mustChangePassword = parsed.data.mustChangePassword;
  }

  const updated = await prisma.user.updateMany({
    where: { tenantId: session.tenantId, id: { in: Array.from(existingIds) } },
    data,
  });

  await logUserAdminAction({
    tenantId: session.tenantId,
    actorUserId: session.id,
    action: "USER_BULK_UPDATE",
    note: `${action} on ${updated.count} users`,
    payload: { action, data, ids: Array.from(existingIds) },
  });

  if (action === "SET_ROLE" || (action === "SET_ACTIVE" && parsed.data.isActive === false)) {
    const reason = action === "SET_ROLE" ? "role_changed" : "deactivated";
    for (const userId of Array.from(existingIds)) {
      publishRealtimeEvent({
        type: "auth.force_logout",
        tenantId: session.tenantId,
        audience: "USER",
        userId,
        payload: {
          reason,
          changedByUserId: session.id,
        },
      });
    }
  }

  return res.status(200).json({ ok: true, count: updated.count });
}
