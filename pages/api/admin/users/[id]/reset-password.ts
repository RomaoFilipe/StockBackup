import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";
import { publishRealtimeEvent } from "@/utils/realtime";

const bodySchema = z.object({
  password: z.string().min(8).max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 60,
    keyPrefix: "admin-users-reset-password",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });

    publishRealtimeEvent({
      type: "auth.force_logout",
      tenantId: session.tenantId,
      audience: "USER",
      userId: id,
      payload: {
        reason: "password_reset",
        changedByUserId: session.id,
      },
    });

    await logUserAdminAction({
      tenantId: session.tenantId,
      actorUserId: session.id,
      targetUserId: id,
      action: "USER_RESET_PASSWORD",
      note: "Password reset by admin",
    });

    return res.status(204).end();
  } catch (error) {
    console.error("POST /api/admin/users/[id]/reset-password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
}
