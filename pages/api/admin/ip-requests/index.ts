import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const querySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const status = parsed.data.status ?? "PENDING";

  try {
    const rows = await prisma.ipAccessRequest.findMany({
      where: { tenantId: session.tenantId, status },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        ip: true,
        userAgent: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        note: true,
      },
    });

    return res.status(200).json(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      }))
    );
  } catch (error) {
    console.error("GET /api/admin/ip-requests error:", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
}
