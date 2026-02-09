import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const parsed = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(parsed) ? parsed : 20;
    })
    .pipe(z.number().int().min(1).max(100)),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsedQuery = querySchema.safeParse(req.query);
  const limit = parsedQuery.success ? parsedQuery.data.limit : 20;

  try {
    const requests = await prisma.request.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        gtmiNumber: true,
        title: true,
        requesterName: true,
        deliveryLocation: true,
        createdAt: true,
        requestedAt: true,
        requestingServiceRef: {
          select: { id: true, codigo: true, designacao: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return res.status(200).json(
      requests.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        requestedAt: r.requestedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("GET /api/requests/notifications error:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
}
