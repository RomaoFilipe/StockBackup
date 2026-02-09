import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const parsed = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(parsed) ? parsed : 20;
    })
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(["RECEIVED", "ACCEPTED", "REJECTED"]).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 20;
  const status = parsed.success ? parsed.data.status : undefined;

  try {
    const rows = await prisma.publicRequest.findMany({
      where: {
        tenantId: session.tenantId,
        ...(status ? { status } : { status: "RECEIVED" }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        createdAt: true,
        requesterName: true,
        deliveryLocation: true as any,
        requestingService: { select: { id: true, codigo: true, designacao: true } },
        items: { select: { id: true } },
      },
    });

    return res.status(200).json(
      rows.map((r: any) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        requesterName: r.requesterName ?? null,
        deliveryLocation: r.deliveryLocation ?? null,
        requestingService: r.requestingService,
        itemsCount: Array.isArray(r.items) ? r.items.length : 0,
      }))
    );
  } catch (error) {
    console.error("GET /api/admin/public-requests/notifications error:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
}
