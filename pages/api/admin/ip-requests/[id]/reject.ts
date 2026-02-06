import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";

const bodySchema = z.object({
  note: z.string().max(300).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

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
    const existing = await prisma.ipAccessRequest.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (existing.status !== "PENDING") {
      return res.status(409).json({ error: "Request already reviewed" });
    }

    await prisma.ipAccessRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedByUserId: session.id,
        note: parsed.data.note?.trim() || null,
      },
    });

    return res.status(204).end();
  } catch (error) {
    console.error("POST /api/admin/ip-requests/[id]/reject error:", error);
    return res.status(500).json({ error: "Failed to reject" });
  }
}
