import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
  role: z.enum(["USER", "ADMIN"]).optional(),
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
      console.error("GET /api/users error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  }

  if (req.method === "POST") {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { name, email, password, role } = parsed.data;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const created = await prisma.user.create({
        data: {
          tenantId: session.tenantId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: hashedPassword,
          role: role ?? "USER",
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
        return res.status(400).json({ error: "Email (or username) already exists" });
      }
      console.error("POST /api/users error:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
