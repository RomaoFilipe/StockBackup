import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

const requireAdmin = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getSessionServer(req, res);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (session.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  if (!session.tenantId) {
    res.status(500).json({ error: "Session missing tenant" });
    return null;
  }

  return session;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid user id" });
  }

  if (req.method === "PATCH") {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Avoid locking yourself out accidentally
    if (id === session.id && parsed.data.role && parsed.data.role !== "ADMIN") {
      return res.status(400).json({ error: "You cannot remove your own admin role" });
    }

    if (id === session.id && parsed.data.isActive === false) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    try {
      const updateResult = await prisma.user.updateMany({
        where: { id, tenantId: session.tenantId },
        data: {
          ...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.role ? { role: parsed.data.role } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
        },
      });

      if (updateResult.count === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const user = await prisma.user.findUnique({
        where: { id },
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

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PATCH /api/users/[id] error:", error);
      return res.status(500).json({ error: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    if (id === session.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    try {
      const updated = await prisma.user.updateMany({
        where: { id, tenantId: session.tenantId },
        data: { isActive: false },
      });

      if (updated.count === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      return res.status(204).end();
    } catch (error) {
      console.error("DELETE /api/users/[id] error:", error);
      return res.status(500).json({ error: "Failed to deactivate user" });
    }
  }

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
