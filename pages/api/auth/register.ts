import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.error("[REGISTER] User already exists:", email);
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate a best-effort unique username based on email.
    const baseUsername = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 20) || "user";

    let createdUser:
      | { id: string; name: string; email: string; username: string | null }
      | null = null;

    // Retry a few times if we collide on username uniqueness.
    for (let attempt = 0; attempt < 20; attempt++) {
      const username = attempt === 0 ? baseUsername : `${baseUsername}${attempt}`;

      try {
        createdUser = await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            username,
            createdAt: new Date(),
          },
          select: { id: true, name: true, email: true, username: true },
        });
        break;
      } catch (err) {
        console.error("[REGISTER] Error creating user:", err);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const target = (err.meta?.target ?? []) as unknown;
          const targets = Array.isArray(target) ? target : [target];
          const normalizedTargets = targets.map((t) => String(t));

          // If email is unique and somehow raced, return a friendly error.
          if (normalizedTargets.includes("email")) {
            return res.status(400).json({ error: "User already exists" });
          }

          // Username collision: try the next suffix.
          if (normalizedTargets.includes("username")) {
            continue;
          }
        }

        throw err;
      }
    }

    if (!createdUser) {
      console.error("[REGISTER] Failed to create user after attempts");
      return res.status(500).json({ error: "Failed to create user" });
    }

    res.status(201).json({ id: createdUser.id, name: createdUser.name, email: createdUser.email });
  } catch (error) {
    console.error("[REGISTER] Uncaught error:", error);
    // Zod validation error => 400
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.flatten() });
    }

    // Common DB connectivity failures (Mongo not running / wrong URL)
    const message = error instanceof Error ? error.message : "";
    if (
      message.includes("ECONNREFUSED") ||
      message.toLowerCase().includes("server selection") ||
      message.toLowerCase().includes("timed out")
    ) {
      return res.status(503).json({ error: "Database unavailable" });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}
