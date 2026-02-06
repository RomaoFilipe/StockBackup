import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

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
        select: { id: true },
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
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

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
