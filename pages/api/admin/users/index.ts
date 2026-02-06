import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  role: z.enum(["USER", "ADMIN"]).optional(),
  password: z.string().min(8).max(200),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method === "GET") {
    try {
      const users = await prisma.user.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          createdByUserId: true,
        },
      });

      return res.status(200).json(
        users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("GET /api/admin/users error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  if (req.method === "POST") {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const name = parsed.data.name.trim();
    const role = parsed.data.role ?? "USER";

    try {
      const passwordHash = await bcrypt.hash(parsed.data.password, 10);

      const created = await prisma.user.create({
        data: {
          tenantId: session.tenantId,
          name,
          email,
          passwordHash,
          role,
          isActive: true,
          createdByUserId: session.id,
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

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(400).json({ error: "Email already exists" });
      }
      console.error("POST /api/admin/users error:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
