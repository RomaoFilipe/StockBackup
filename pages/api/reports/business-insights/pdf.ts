import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { buildBusinessInsightsPdfBytes } from "@/utils/businessInsightsPdf";
import { getOperationsInsights } from "@/utils/operationsInsights";

function formatDatePt(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!session.tenantId) return res.status(500).json({ error: "Session missing tenant" });

  const tenantId = session.tenantId;
  const generatedAt = new Date();

  const ops = await getOperationsInsights({ tenantId, days: 30, topLimit: 10 });
  const unitsMap = new Map(ops.units.byStatus.map((r) => [r.status, r.count] as const));
  const unitsInRepair = unitsMap.get("IN_REPAIR") ?? 0;
  const unitsLost = unitsMap.get("LOST") ?? 0;
  const unitsScrapped = unitsMap.get("SCRAPPED") ?? 0;

  const [totalProducts, outOfStockItems, lowStockItems] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, quantity: { equals: BigInt(0) } } }),
    prisma.product.count({ where: { tenantId, quantity: { gt: BigInt(0), lte: BigInt(20) } } }),
  ]);

  const quantityAgg = await prisma.product.aggregate({
    where: { tenantId },
    _sum: { quantity: true },
  });
  const totalQuantity = Number(quantityAgg._sum.quantity ?? BigInt(0));

  const productsForValue = await prisma.product.findMany({
    where: { tenantId },
    select: { price: true, quantity: true },
  });

  const totalValue = productsForValue.reduce((sum, p) => sum + p.price * Number(p.quantity), 0);
  const averagePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  const totalRequests = await prisma.request.count({ where: { tenantId } });

  const itemsAgg = await prisma.requestItem.aggregate({
    where: { request: { tenantId } },
    _sum: { quantity: true },
  });
  const totalItemsRequested = Number(itemsAgg._sum.quantity ?? BigInt(0));

  const byStatusRows = await prisma.request.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: { status: true },
    orderBy: { _count: { status: "desc" } },
  });

  const topItemRows = await prisma.requestItem.groupBy({
    by: ["productId"],
    where: { request: { tenantId } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });

  const topProductIds = topItemRows.map((r) => r.productId);
  const topProductsLookup = await prisma.product.findMany({
    where: { tenantId, id: { in: topProductIds } },
    select: { id: true, name: true },
  });
  const topNameById = new Map(topProductsLookup.map((p) => [p.id, p.name] as const));

  const pdfBytes = await buildBusinessInsightsPdfBytes({
    generatedAt,
    periodLabel: `Total (até ${formatDatePt(generatedAt)})`,
    inventory: {
      totalProducts,
      totalValue: Number(totalValue.toFixed(2)),
      lowStockItems,
      outOfStockItems,
      averagePrice: Number(averagePrice.toFixed(2)),
      totalQuantity,
    },
    requests: {
      totalRequests,
      totalItemsRequested,
      byStatus: byStatusRows.map((r) => ({ status: r.status, count: r._count.status })),
      topProducts: topItemRows.map((r) => ({
        name: topNameById.get(r.productId) ?? r.productId,
        quantity: Number(r._sum.quantity ?? BigInt(0)),
      })),
    },
    operations: {
      windowLabel: `${ops.meta.days} dias (até ${formatDatePt(generatedAt)})`,
      requestsPending: ops.requests.pendingCount,
      movementsTotal: ops.movements.totalMovements,
      outQuantity: ops.movements.outQuantity,
      lossesQuantity: ops.movements.lossesQuantity,
      inactive90DaysCount: ops.stock.inactive90DaysCount,
      neverMovedCount: ops.stock.neverMovedCount,
      unitsTotal: ops.units.totalUnits,
      unitsInRepair,
      unitsLost,
      unitsScrapped,
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="insights-${generatedAt.toISOString().slice(0, 10)}.pdf"`);
  return res.status(200).send(Buffer.from(pdfBytes));
}
