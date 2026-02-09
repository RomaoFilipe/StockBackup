import { prisma } from "@/prisma/client";
import type { RequestStatus } from "@prisma/client";

export type OperationsInsights = {
  meta: {
    generatedAt: string;
    days: number;
    from: string;
    to: string;
  };

  stock: {
    totalProducts: number;
    totalQuantity: number;
    lowStockCount: number;
    outOfStockCount: number;
    inactive90DaysCount: number;
    neverMovedCount: number;
    inactiveTop: Array<{
      productId: string;
      name: string;
      sku: string;
      lastMovedAt: string | null;
      daysSinceMove: number | null;
    }>;
  };

  requests: {
    totalRequests: number;
    pendingCount: number;
    byStatus: Array<{ status: string; count: number }>;
    signatureCompliance: {
      approvedOrFulfilledCount: number;
      approvalSignatureConsideredCount: number;
      approvedSignedCount: number;
      approvedMissingSignatureCount: number;
      pickupSignatureConsideredCount: number;
      pickupSignedCount: number;
      pickupMissingSignatureCount: number;
    };
    pendingApprovalSignature: Array<{
      id: string;
      gtmiNumber: string;
      title: string | null;
      status: string;
      requestedAt: string;
      requestingService: string | null;
    }>;
    pendingPickupSignature: Array<{
      id: string;
      gtmiNumber: string;
      title: string | null;
      status: string;
      requestedAt: string;
      requestingService: string | null;
    }>;
    topProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
  };

  movements: {
    totalMovements: number;
    byType: Array<{ type: string; count: number; quantity: number }>;
    lossesQuantity: number; // SCRAP + LOST
    outQuantity: number;
    topOutProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    recent: Array<{
      id: string;
      createdAt: string;
      type: string;
      quantity: number;
      productName: string;
      productSku: string;
      costCenter: string | null;
      reason: string | null;
      requestId: string | null;
      invoiceId: string | null;
    }>;
  };

  units: {
    totalUnits: number;
    byStatus: Array<{ status: string; count: number }>;
  };
};

function toNumberBigint(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getOperationsInsights(args: {
  tenantId: string;
  days?: number;
  topLimit?: number;
}): Promise<OperationsInsights> {
  const days = Math.min(365, Math.max(1, args.days ?? 30));
  const topLimit = Math.min(50, Math.max(1, args.topLimit ?? 10));

  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const inactiveThresholdDays = 90;
  const inactiveThreshold = new Date(now.getTime() - inactiveThresholdDays * 24 * 60 * 60 * 1000);

  const tenantId = args.tenantId;

  const [
    totalProducts,
    outOfStockCount,
    lowStockCount,
    quantityAgg,
    unitsTotal,
    unitsByStatus,
  ] = await Promise.all([
    prisma.product.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId, quantity: { equals: BigInt(0) } } }),
    prisma.product.count({ where: { tenantId, quantity: { gt: BigInt(0), lte: BigInt(20) } } }),
    prisma.product.aggregate({ where: { tenantId }, _sum: { quantity: true } }),
    prisma.productUnit.count({ where: { tenantId } }),
    prisma.productUnit.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { status: true },
      orderBy: { _count: { status: "desc" } },
    }),
  ]);

  const totalQuantity = toNumberBigint(quantityAgg._sum.quantity ?? BigInt(0));

  // Requests (window)
  const [requestsTotal, requestsByStatusRows, pendingCount] = await Promise.all([
    prisma.request.count({ where: { tenantId, requestedAt: { gte: from } } }),
    prisma.request.groupBy({
      by: ["status"],
      where: { tenantId, requestedAt: { gte: from } },
      _count: { status: true },
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.request.count({
      where: {
        tenantId,
        requestedAt: { gte: from },
        status: { in: ["SUBMITTED", "APPROVED"] },
      },
    }),
  ]);

  // Signature compliance (all-time, so it doesn't show 0/0 just because the window has no data)
  const approvedOrFulfilledStatuses = ["APPROVED", "FULFILLED"] as RequestStatus[];
  const baseApprovedWhere = {
    tenantId,
    status: { in: approvedOrFulfilledStatuses },
  };

  const [
    approvedOrFulfilledCount,
    approvalSignatureConsideredCount,
    approvedSignedCount,
    approvedMissingSignatureCount,
    pickupSignatureConsideredCount,
    pickupSignedCount,
    pickupMissingSignatureCount,
    pendingApprovalSignatureRows,
    pendingPickupSignatureRows,
  ] = await Promise.all([
    prisma.request.count({ where: baseApprovedWhere }),
    prisma.request.count({ where: { ...baseApprovedWhere, signedVoidedAt: null } }),
    prisma.request.count({
      where: {
        ...baseApprovedWhere,
        signedAt: { not: null },
        signedVoidedAt: null,
      },
    }),
    prisma.request.count({
      where: {
        ...baseApprovedWhere,
        signedAt: null,
        signedVoidedAt: null,
      },
    }),
    prisma.request.count({ where: { ...baseApprovedWhere, pickupVoidedAt: null } }),
    prisma.request.count({
      where: {
        ...baseApprovedWhere,
        pickupSignedAt: { not: null },
        pickupVoidedAt: null,
      },
    }),
    prisma.request.count({
      where: {
        ...baseApprovedWhere,
        pickupSignedAt: null,
        pickupVoidedAt: null,
      },
    }),
    prisma.request.findMany({
      where: {
        ...baseApprovedWhere,
        signedAt: null,
        signedVoidedAt: null,
      },
      orderBy: { requestedAt: "desc" },
      take: topLimit,
      select: {
        id: true,
        gtmiNumber: true,
        title: true,
        status: true,
        requestedAt: true,
        requestingService: true,
      },
    }),
    prisma.request.findMany({
      where: {
        ...baseApprovedWhere,
        pickupSignedAt: null,
        pickupVoidedAt: null,
      },
      orderBy: { requestedAt: "desc" },
      take: topLimit,
      select: {
        id: true,
        gtmiNumber: true,
        title: true,
        status: true,
        requestedAt: true,
        requestingService: true,
      },
    }),
  ]);

  const topRequestItemRows = await prisma.requestItem.groupBy({
    by: ["productId"],
    where: {
      request: {
        tenantId,
        requestedAt: { gte: from },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: topLimit,
  });

  const topRequestProductIds = topRequestItemRows.map((r) => r.productId);
  const topRequestProductsLookup = topRequestProductIds.length
    ? await prisma.product.findMany({
        where: { tenantId, id: { in: topRequestProductIds } },
        select: { id: true, name: true, sku: true },
      })
    : [];
  const productMetaById = new Map(topRequestProductsLookup.map((p) => [p.id, p] as const));

  const topRequestedProducts = topRequestItemRows.map((r) => {
    const meta = productMetaById.get(r.productId);
    return {
      productId: r.productId,
      name: meta?.name ?? "Produto",
      sku: meta?.sku ?? "",
      quantity: toNumberBigint(r._sum.quantity ?? BigInt(0)),
    };
  });

  // Movements (window)
  const [movementsTotal, movementsByTypeRows, lossesAgg, outAgg, topOutRows, recentMovements] =
    await Promise.all([
      prisma.stockMovement.count({ where: { tenantId, createdAt: { gte: from } } }),
      prisma.stockMovement.groupBy({
        by: ["type"],
        where: { tenantId, createdAt: { gte: from } },
        _count: { type: true },
        _sum: { quantity: true },
        orderBy: { _count: { type: "desc" } },
      }),
      prisma.stockMovement.aggregate({
        where: { tenantId, createdAt: { gte: from }, type: { in: ["SCRAP", "LOST"] } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.aggregate({
        where: { tenantId, createdAt: { gte: from }, type: { equals: "OUT" } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.groupBy({
        by: ["productId"],
        where: { tenantId, createdAt: { gte: from }, type: { equals: "OUT" } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: topLimit,
      }),
      prisma.stockMovement.findMany({
        where: { tenantId, createdAt: { gte: from } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          createdAt: true,
          type: true,
          quantity: true,
          costCenter: true,
          reason: true,
          requestId: true,
          invoiceId: true,
          product: { select: { name: true, sku: true } },
        },
      }),
    ]);

  const lossesQuantity = toNumberBigint(lossesAgg._sum.quantity ?? BigInt(0));
  const outQuantity = toNumberBigint(outAgg._sum.quantity ?? BigInt(0));

  const topOutProductIds = topOutRows.map((r) => r.productId);
  const topOutProductsLookup = topOutProductIds.length
    ? await prisma.product.findMany({
        where: { tenantId, id: { in: topOutProductIds } },
        select: { id: true, name: true, sku: true },
      })
    : [];
  const topOutMetaById = new Map(topOutProductsLookup.map((p) => [p.id, p] as const));

  const topOutProducts = topOutRows.map((r) => {
    const meta = topOutMetaById.get(r.productId);
    return {
      productId: r.productId,
      name: meta?.name ?? "Produto",
      sku: meta?.sku ?? "",
      quantity: toNumberBigint(r._sum.quantity ?? BigInt(0)),
    };
  });

  const movementsByType = movementsByTypeRows.map((r) => ({
    type: String(r.type),
    count: r._count.type,
    quantity: toNumberBigint(r._sum.quantity ?? BigInt(0)),
  }));

  const recent = recentMovements.map((m) => ({
    id: m.id,
    createdAt: m.createdAt.toISOString(),
    type: String(m.type),
    quantity: toNumberBigint(m.quantity),
    productName: m.product?.name ?? "",
    productSku: m.product?.sku ?? "",
    costCenter: m.costCenter ?? null,
    reason: m.reason ?? null,
    requestId: m.requestId ?? null,
    invoiceId: m.invoiceId ?? null,
  }));

  // Inactivity (global, not window)
  const [allProducts, lastMovements] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: { tenantId },
      _max: { createdAt: true },
    }),
  ]);

  const lastMoveByProductId = new Map<string, Date>();
  for (const row of lastMovements) {
    const d = row._max.createdAt;
    if (d) lastMoveByProductId.set(row.productId, d);
  }

  let neverMovedCount = 0;
  const inactiveRows: Array<{
    productId: string;
    name: string;
    sku: string;
    lastMovedAt: Date | null;
    daysSinceMove: number | null;
    isInactive: boolean;
  }> = [];

  for (const p of allProducts) {
    const last = lastMoveByProductId.get(p.id) ?? null;
    if (!last) {
      neverMovedCount += 1;
      inactiveRows.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        lastMovedAt: null,
        daysSinceMove: null,
        isInactive: true,
      });
      continue;
    }

    const isInactive = last < inactiveThreshold;
    const daysSinceMove = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));
    inactiveRows.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      lastMovedAt: last,
      daysSinceMove,
      isInactive,
    });
  }

  const inactiveOnly = inactiveRows.filter((r) => r.isInactive);
  const inactive90DaysCount = inactiveOnly.length;

  const inactiveTop = inactiveOnly
    .sort((a, b) => {
      const aScore = a.lastMovedAt ? a.lastMovedAt.getTime() : -Infinity;
      const bScore = b.lastMovedAt ? b.lastMovedAt.getTime() : -Infinity;
      // null lastMovedAt first
      if (!a.lastMovedAt && b.lastMovedAt) return -1;
      if (a.lastMovedAt && !b.lastMovedAt) return 1;
      return aScore - bScore;
    })
    .slice(0, topLimit)
    .map((r) => ({
      productId: r.productId,
      name: r.name,
      sku: r.sku,
      lastMovedAt: r.lastMovedAt ? r.lastMovedAt.toISOString() : null,
      daysSinceMove: r.daysSinceMove,
    }));

  return {
    meta: {
      generatedAt: now.toISOString(),
      days,
      from: from.toISOString(),
      to: now.toISOString(),
    },
    stock: {
      totalProducts,
      totalQuantity,
      lowStockCount,
      outOfStockCount,
      inactive90DaysCount,
      neverMovedCount,
      inactiveTop,
    },
    requests: {
      totalRequests: requestsTotal,
      pendingCount,
      byStatus: requestsByStatusRows.map((r) => ({ status: String(r.status), count: r._count.status })),
      signatureCompliance: {
        approvedOrFulfilledCount,
        approvalSignatureConsideredCount,
        approvedSignedCount,
        approvedMissingSignatureCount,
        pickupSignatureConsideredCount,
        pickupSignedCount,
        pickupMissingSignatureCount,
      },
      pendingApprovalSignature: pendingApprovalSignatureRows.map((r) => ({
        id: r.id,
        gtmiNumber: r.gtmiNumber,
        title: r.title ?? null,
        status: String(r.status),
        requestedAt: r.requestedAt.toISOString(),
        requestingService: r.requestingService ?? null,
      })),
      pendingPickupSignature: pendingPickupSignatureRows.map((r) => ({
        id: r.id,
        gtmiNumber: r.gtmiNumber,
        title: r.title ?? null,
        status: String(r.status),
        requestedAt: r.requestedAt.toISOString(),
        requestingService: r.requestingService ?? null,
      })),
      topProducts: topRequestedProducts,
    },
    movements: {
      totalMovements: movementsTotal,
      byType: movementsByType,
      lossesQuantity,
      outQuantity,
      topOutProducts,
      recent,
    },
    units: {
      totalUnits: unitsTotal,
      byStatus: unitsByStatus.map((r) => ({ status: String(r.status), count: r._count.status })),
    },
  };
}
