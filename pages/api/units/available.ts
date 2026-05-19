import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getReservedUnitCodes, mergeExcludedUnitCodes } from "@/utils/unitReservations";

const querySchema = z.object({
  productId: z.string().uuid(),
  take: z.coerce.number().int().min(1).max(20).default(1),
  exclude: z
    .union([z.string().min(1), z.array(z.string().min(1))])
    .optional()
    .transform((v) => {
      if (!v) return [] as string[];
      const values = Array.isArray(v) ? v : [v];
      return values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);
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

  const normalizedQuery = {
    ...req.query,
    exclude: req.query.exclude ?? req.query["exclude[]"],
  };

  const parsed = querySchema.safeParse(normalizedQuery);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const tenantId = session.tenantId;
  const { productId, take, exclude } = parsed.data;

  try {
    const prismaAny = prisma as any;
    const reservedCodes = await getReservedUnitCodes(prismaAny, { tenantId, productId });
    const excludedCodes = mergeExcludedUnitCodes(exclude, reservedCodes);
    const reservedOnlyCodes = mergeExcludedUnitCodes([], reservedCodes);

    const [totalCount, availableCount, units] = await prisma.$transaction([
      prismaAny.productUnit.count({
        where: {
          tenantId,
          productId,
        },
      }),
      prismaAny.productUnit.count({
        where: {
          tenantId,
          productId,
          status: "IN_STOCK",
          ...(reservedOnlyCodes.length ? { code: { notIn: reservedOnlyCodes } } : {}),
        },
      }),
      prismaAny.productUnit.findMany({
        where: {
          tenantId,
          productId,
          status: "IN_STOCK",
          ...(excludedCodes.length ? { code: { notIn: excludedCodes } } : {}),
        },
        orderBy: { createdAt: "asc" },
        take,
        select: { id: true, code: true },
      }),
    ]);

    return res.status(200).json({
      totalCount,
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
