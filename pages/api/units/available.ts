import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  productId: z.string().uuid(),
  take: z.coerce.number().int().min(1).max(20).default(1),
  exclude: z
    .union([z.string().min(1), z.array(z.string().min(1))])
    .optional()
    .transform((v) => {
      if (!v) return [] as string[];
      return Array.isArray(v) ? v : [v];
    }),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const tenantId = session.tenantId;
  const { productId, take, exclude } = parsed.data;

  try {
    const prismaAny = prisma as any;

    const [availableCount, units] = await prisma.$transaction([
      prismaAny.productUnit.count({
        where: {
          tenantId,
          productId,
          status: "IN_STOCK",
          ...(exclude.length ? { code: { notIn: exclude } } : {}),
        },
      }),
      prismaAny.productUnit.findMany({
        where: {
          tenantId,
          productId,
          status: "IN_STOCK",
          ...(exclude.length ? { code: { notIn: exclude } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take,
        select: { id: true, code: true },
      }),
    ]);

    return res.status(200).json({
      availableCount,
      items: units.map((u: any) => ({ id: u.id, code: u.code })),
    });
  } catch (error) {
    console.error("GET /api/units/available error:", error);
    return res.status(500).json({ error: "Failed to fetch available units" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
