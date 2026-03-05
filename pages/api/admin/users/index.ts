import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";

const createUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(255),
  role: z.enum(["USER", "ADMIN"]).optional(),
  password: z.string().min(8).max(200),
  requestingServiceId: z.number().int().optional(),
});

const querySchema = z.object({
  q: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  service: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
    }),
  pageSize: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.min(200, Math.trunc(n)) : 20;
    }),
  paged: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 120,
    keyPrefix: "admin-users",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (req.method === "GET") {
    try {
      const parsed = querySchema.safeParse(req.query);
      const q = parsed.success ? parsed.data.q?.trim() : undefined;
      const role = parsed.success ? parsed.data.role : undefined;
      const isActive = parsed.success ? parsed.data.isActive : undefined;
      const service = parsed.success ? parsed.data.service?.trim() : undefined;
      const serviceId = service && service !== "__none__" ? Number(service) : undefined;
      const paged = parsed.success ? parsed.data.paged : false;
      const page = parsed.success ? parsed.data.page : 1;
      const pageSize = parsed.success ? parsed.data.pageSize : 20;

      const where: any = {
        tenantId: session.tenantId,
        ...(role ? { role } : {}),
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        ...(service === "__none__"
          ? { requestingServiceId: null }
          : Number.isFinite(serviceId as number)
            ? { requestingServiceId: serviceId }
            : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { username: { contains: q, mode: "insensitive" as const } },
                { requestingService: { designacao: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            isActive: true,
            mustChangePassword: true,
            requestingServiceId: true,
            requestingService: { select: { id: true, codigo: true, designacao: true } },
            createdAt: true,
            updatedAt: true,
            createdByUserId: true,
          },
        }),
        paged ? prisma.user.count({ where }) : Promise.resolve(0),
      ]);

      const mapped = users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        }));

      if (paged) {
        return res.status(200).json({
          items: mapped,
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        });
      }

      return res.status(200).json(mapped);
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
          mustChangePassword: true,
          requestingServiceId: parsed.data.requestingServiceId ?? undefined,
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
          mustChangePassword: true,
          requestingServiceId: true,
          requestingService: { select: { id: true, codigo: true, designacao: true } },
        },
      });

      // Try to send temporary password via email (best-effort)
      try {
        const { sendEmail } = await import("@/utils/email");
        const subject = `A sua conta em ${process.env.DEFAULT_TENANT_SLUG || "Stock"}`;
        const text = `Foi criada uma conta para si. Email: ${email}\nPassword temporária: ${parsed.data.password}\nPor favor altere a password no primeiro login.`;
        await sendEmail({ to: email, subject, text });
      } catch (e) {
        console.warn("Failed to send temporary password email:", e);
      }

      await logUserAdminAction({
        tenantId: session.tenantId,
        actorUserId: session.id,
        targetUserId: created.id,
        action: "USER_CREATE",
        note: `User ${created.email} created`,
        payload: {
          role: created.role,
          requestingServiceId: created.requestingServiceId ?? null,
          mustChangePassword: created.mustChangePassword ?? false,
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
