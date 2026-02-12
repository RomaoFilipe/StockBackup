import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { publishRealtimeEvent } from "@/utils/realtime";

const bodySchema = z.object({
  password: z.string().min(8).max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const user = await getSessionServer(req, res);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });

    publishRealtimeEvent({
      type: "auth.force_logout",
      tenantId: user.tenantId,
      audience: "USER",
      userId: user.id,
      payload: {
        reason: "password_changed",
        changedByUserId: user.id,
      },
    });

    return res.status(204).end();
  } catch (error) {
    console.error("POST /api/users/change-password error:", error);
    return res.status(500).json({ error: "Failed to change password" });
  }
}
