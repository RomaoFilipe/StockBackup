import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";

const updateSchema = z.object({
  ipOrCidr: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).optional().nullable(),
  expiresAt: z
    .string()
    .optional()
    .nullable()
    .refine((v) => v == null || !Number.isNaN(new Date(v).getTime()), "Invalid date"),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 120,
    keyPrefix: "admin-allowed-ips-id",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid allowed ip id" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const existing = await prisma.allowedIp.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true, ipOrCidr: true, isActive: true, note: true, expiresAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Allowed IP not found" });
    }

    const updated = await prisma.allowedIp.update({
      where: { id },
      data: {
        ...(parsed.data.ipOrCidr ? { ipOrCidr: parsed.data.ipOrCidr.trim() } : {}),
        ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.data, "note")
          ? { note: parsed.data.note === null ? null : parsed.data.note?.trim() || null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.data, "expiresAt")
          ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }
          : {}),
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
      action: "ALLOWLIST_UPDATE",
      note: `Allowlist updated for ${updated.ipOrCidr}`,
      payload: {
        allowedIpId: updated.id,
        before: {
          ipOrCidr: existing.ipOrCidr,
          isActive: existing.isActive,
          note: existing.note,
          expiresAt: existing.expiresAt,
        },
        after: {
          ipOrCidr: updated.ipOrCidr,
          isActive: updated.isActive,
          note: updated.note,
          expiresAt: updated.expiresAt,
        },
      },
    });

    return res.status(200).json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("PATCH /api/admin/allowed-ips/[id] error:", error);
    return res.status(500).json({ error: "Failed to update allowed IP" });
  }
}
