import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";

const createSchema = z.object({
  ipOrCidr: z.string().min(1).max(100),
  note: z.string().max(300).optional(),
  expiresAt: z
    .string()
    .optional()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Invalid date"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 80,
    keyPrefix: "admin-allowed-ips",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (req.method === "GET") {
    try {
      const rows = await prisma.allowedIp.findMany({
        where: { tenantId: session.tenantId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          ipOrCidr: true,
          isActive: true,
          note: true,
          expiresAt: true,
          createdAt: true,
          createdByUserId: true,
        },
      });

      return res.status(200).json(
        rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        }))
      );
    } catch (error) {
      console.error("GET /api/admin/allowed-ips error:", error);
      return res.status(500).json({ error: "Failed to fetch allowed IPs" });
    }
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const created = await prisma.allowedIp.create({
        data: {
          tenantId: session.tenantId,
          ipOrCidr: parsed.data.ipOrCidr.trim(),
          isActive: true,
          note: parsed.data.note?.trim() || null,
          expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
          createdByUserId: session.id,
        },
        select: {
          id: true,
          ipOrCidr: true,
          isActive: true,
          note: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      await logUserAdminAction({
        tenantId: session.tenantId,
        actorUserId: session.id,
        action: "ALLOWLIST_CREATE",
        note: `Allowlist created for ${created.ipOrCidr}`,
        payload: { allowedIpId: created.id, ipOrCidr: created.ipOrCidr, expiresAt: created.expiresAt },
      });

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
      });
    } catch (error) {
      console.error("POST /api/admin/allowed-ips error:", error);
      return res.status(500).json({ error: "Failed to create allowed IP" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
