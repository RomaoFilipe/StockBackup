import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { logUserAdminAction } from "@/utils/adminAudit";

const bodySchema = z.object({
  ipOrCidr: z.string().min(1).max(100).optional(),
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
    max: 120,
    keyPrefix: "admin-ip-approve",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid request id" });
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
    const result = await prisma.$transaction(async (tx) => {
      const request = await tx.ipAccessRequest.findFirst({
        where: { id, tenantId: session.tenantId },
        select: { id: true, ip: true, status: true },
      });

      if (!request) {
        return { kind: "not_found" as const };
      }

      if (request.status !== "PENDING") {
        return { kind: "not_pending" as const };
      }

      const ipOrCidr = (parsed.data.ipOrCidr?.trim() || request.ip).trim();
      const allowed = await tx.allowedIp.create({
        data: {
          tenantId: session.tenantId,
          ipOrCidr,
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

      await tx.ipAccessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedByUserId: session.id,
          note: parsed.data.note?.trim() || null,
        },
      });

      return { kind: "ok" as const, allowed };
    });

    if (result.kind === "not_found") {
      return res.status(404).json({ error: "Request not found" });
    }
    if (result.kind === "not_pending") {
      return res.status(409).json({ error: "Request already reviewed" });
    }

    await logUserAdminAction({
      tenantId: session.tenantId,
      actorUserId: session.id,
      action: "IP_REQUEST_APPROVE",
      note: `Approved IP request ${id}`,
      payload: {
        ipRequestId: id,
        allowedIpId: result.allowed.id,
        ipOrCidr: result.allowed.ipOrCidr,
        expiresAt: result.allowed.expiresAt,
      },
    });

    return res.status(200).json({
      ...result.allowed,
      createdAt: result.allowed.createdAt.toISOString(),
      expiresAt: result.allowed.expiresAt ? result.allowed.expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("POST /api/admin/ip-requests/[id]/approve error:", error);
    return res.status(500).json({ error: "Failed to approve" });
  }
}
