import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenantId = session.tenantId;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid product id" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const prismaAny = prisma as any;
    const [unitStatusRows, reservedUnitsCount] = await Promise.all([
      prismaAny.productUnit.groupBy({
        by: ["status"],
        where: { tenantId, productId: product.id },
        _count: { _all: true },
      }),
      prismaAny.requestItem.count({
        where: {
          productId: product.id,
          role: { not: "OLD" },
          OR: [{ reservedUnitId: { not: null } }, { destination: { not: null } }],
          request: {
            tenantId,
            status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
          },
        },
      }),
    ]);

    const unitStats = unitStatusRows.reduce(
      (acc: Record<string, number>, row: any) => {
        acc[row.status] = Number(row._count?._all ?? 0);
        return acc;
      },
      { IN_STOCK: 0, ACQUIRED: 0, IN_REPAIR: 0, SCRAPPED: 0, LOST: 0 }
    );

    return res.status(200).json({
      ...product,
      quantity: Number(product.quantity),
      effectiveQuantity: unitStatusRows.length ? Number(unitStats.IN_STOCK ?? 0) : Number(product.quantity),
      reservedUnitsCount,
      unitStats,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      category: product.category?.name || "Unknown",
      supplier: product.supplier?.name || "Unknown",
    });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
}
