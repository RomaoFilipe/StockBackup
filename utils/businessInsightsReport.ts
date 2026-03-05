import crypto from "crypto";
import { prisma } from "@/prisma/client";

type Period = "7d" | "30d" | "90d" | "12m" | "custom";

export type BusinessInsightsReportFilters = {
  period: Period;
  startDate?: string;
  endDate?: string;
  serviceId?: number;
  categoryId?: string;
};

type DateRange = {
  from: Date;
  to: Date;
  days: number;
  label: string;
};

export type BusinessInsightsReportData = {
  meta: {
    tenantId: string;
    tenantName: string;
    generatedAt: string;
    generatedBy: { id: string; name: string; email: string };
    period: DateRange;
    previousPeriod: DateRange;
    filters: { serviceId?: number; categoryId?: string };
    documentHash: string;
  };
  executive: {
    stockLow: number;
    outOfStock: number;
    pendingRequests: number;
    lossesScrap: number;
    slaCompliancePct: number;
    warehouseHealthScore: number;
  };
  inventory: {
    categoryDistribution: Array<{ name: string; value: number }>;
    inactive90Days: Array<{ productId: string; name: string; sku: string; daysSinceMove: number | null }>;
    neverMoved: Array<{ productId: string; name: string; sku: string }>;
    suggestedReplenishment: Array<{ productId: string; name: string; sku: string; currentQty: number; suggestedQty: number }>;
  };
  requests: {
    byStatus: Array<{ status: string; count: number }>;
    topRequestedProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    pendingSignatures: Array<{ id: string; gtmiNumber: string; title: string | null; status: string; missing: "approval" | "pickup"; requestedAt: string }>;
    pendingRequests: Array<{ id: string; gtmiNumber: string; title: string | null; status: string; requestedAt: string; requestingService: string | null }>;
  };
  movements: {
    byType: Array<{ type: string; count: number; quantity: number }>;
    topConsumption: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    trend: {
      currentOut: number;
      previousOut: number;
      outDiffPct: number;
      currentLosses: number;
      previousLosses: number;
      lossesDiffPct: number;
    };
  };
  units: {
    byStatus: Array<{ status: string; count: number }>;
    repairRatePct: number;
    lossScrapLast30Days: number;
  };
  risk: {
    stockRuptureRiskPct: number;
    stockRuptureRiskPrevPct: number;
    stockRuptureRiskDiffPct: number;
    quarantineItems: number;
    criticalAlerts: string[];
    narrative: string[];
    allAlerts: string[];
  };
  annex: {
    top20Consumption: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    pendingRequests: Array<{ id: string; gtmiNumber: string; title: string | null; status: string; requestedAt: string; requestingService: string | null }>;
  };
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pctDiff(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(2));
}

function round2(n: number) {
  return Number(n.toFixed(2));
}

function toNumberBigint(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDatePt(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function resolvePeriodRange(filters: BusinessInsightsReportFilters): DateRange {
  const now = new Date();

  if (filters.period === "custom") {
    if (!filters.startDate || !filters.endDate) {
      throw new Error("Custom period requires startDate and endDate");
    }
    const from = new Date(filters.startDate);
    const to = new Date(filters.endDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Invalid custom period dates");
    }
    if (from > to) {
      throw new Error("startDate must be before endDate");
    }
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    return {
      from,
      to,
      days,
      label: `${formatDatePt(from)} - ${formatDatePt(to)}`,
    };
  }

  const daysByPeriod: Record<Exclude<Period, "custom">, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "12m": 365,
  };

  const days = daysByPeriod[filters.period as Exclude<Period, "custom">] ?? 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from,
    to: now,
    days,
    label: `${filters.period} (${formatDatePt(from)} - ${formatDatePt(now)})`,
  };
}

function previousRange(period: DateRange): DateRange {
  const durationMs = period.to.getTime() - period.from.getTime();
  const prevTo = new Date(period.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  const days = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)));
  return {
    from: prevFrom,
    to: prevTo,
    days,
    label: `${formatDatePt(prevFrom)} - ${formatDatePt(prevTo)}`,
  };
}

export async function buildBusinessInsightsReportData(args: {
  tenantId: string;
  generatedBy: { id: string; name: string; email: string };
  filters: BusinessInsightsReportFilters;
}): Promise<BusinessInsightsReportData> {
  const period = resolvePeriodRange(args.filters);
  const previousPeriod = previousRange(period);
  const tenantId = args.tenantId;

  const categoryProductWhere = {
    tenantId,
    ...(args.filters.categoryId ? { categoryId: args.filters.categoryId } : {}),
  };

  const requestWhereCurrent = {
    tenantId,
    requestedAt: { gte: period.from, lte: period.to },
    ...(typeof args.filters.serviceId === "number" ? { requestingServiceId: args.filters.serviceId } : {}),
  };

  const requestWherePrev = {
    tenantId,
    requestedAt: { gte: previousPeriod.from, lte: previousPeriod.to },
    ...(typeof args.filters.serviceId === "number" ? { requestingServiceId: args.filters.serviceId } : {}),
  };

  const movementWhereCurrent: any = {
    tenantId,
    createdAt: { gte: period.from, lte: period.to },
    ...(args.filters.categoryId ? { product: { is: { categoryId: args.filters.categoryId } } } : {}),
  };
  const movementWherePrev: any = {
    tenantId,
    createdAt: { gte: previousPeriod.from, lte: previousPeriod.to },
    ...(args.filters.categoryId ? { product: { is: { categoryId: args.filters.categoryId } } } : {}),
  };

  if (typeof args.filters.serviceId === "number") {
    movementWhereCurrent.OR = [
      { request: { is: { requestingServiceId: args.filters.serviceId } } },
      { invoice: { is: { requestingServiceId: args.filters.serviceId } } },
    ];
    movementWherePrev.OR = [
      { request: { is: { requestingServiceId: args.filters.serviceId } } },
      { invoice: { is: { requestingServiceId: args.filters.serviceId } } },
    ];
  }

  const [tenant, totalProducts, outOfStock, lowStock, quantityAgg] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } }),
    prisma.product.count({ where: categoryProductWhere }),
    prisma.product.count({ where: { ...categoryProductWhere, quantity: { equals: BigInt(0) } } }),
    prisma.product.count({ where: { ...categoryProductWhere, quantity: { gt: BigInt(0), lte: BigInt(20) } } }),
    prisma.product.aggregate({ where: categoryProductWhere, _sum: { quantity: true } }),
  ]);

  const totalQuantity = toNumberBigint(quantityAgg._sum.quantity ?? BigInt(0));

  const [requestsPending, requestsByStatusRows, topRequestItemRows, pendingApproval, pendingPickup] = await Promise.all([
    prisma.request.count({ where: { ...requestWhereCurrent, status: { in: ["SUBMITTED", "APPROVED"] } } }),
    prisma.request.groupBy({
      by: ["status"],
      where: requestWhereCurrent,
      _count: { status: true },
      orderBy: { _count: { status: "desc" } },
    }),
    prisma.requestItem.groupBy({
      by: ["productId"],
      where: {
        request: requestWhereCurrent,
        ...(args.filters.categoryId ? { product: { is: { categoryId: args.filters.categoryId } } } : {}),
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 20,
    }),
    prisma.request.findMany({
      where: {
        tenantId,
        status: { in: ["APPROVED", "FULFILLED"] },
        signedAt: null,
        signedVoidedAt: null,
        ...(typeof args.filters.serviceId === "number" ? { requestingServiceId: args.filters.serviceId } : {}),
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
      select: { id: true, gtmiNumber: true, title: true, status: true, requestedAt: true },
    }),
    prisma.request.findMany({
      where: {
        tenantId,
        status: { in: ["APPROVED", "FULFILLED"] },
        pickupSignedAt: null,
        pickupVoidedAt: null,
        ...(typeof args.filters.serviceId === "number" ? { requestingServiceId: args.filters.serviceId } : {}),
      },
      orderBy: { requestedAt: "desc" },
      take: 100,
      select: { id: true, gtmiNumber: true, title: true, status: true, requestedAt: true },
    }),
  ]);

  const topProductIds = topRequestItemRows.map((r) => r.productId);
  const productsMeta = topProductIds.length
    ? await prisma.product.findMany({ where: { tenantId, id: { in: topProductIds } }, select: { id: true, name: true, sku: true } })
    : [];
  const productsMetaById = new Map(productsMeta.map((p) => [p.id, p] as const));

  const topRequestedProducts = topRequestItemRows.map((row) => ({
    productId: row.productId,
    name: productsMetaById.get(row.productId)?.name ?? "Produto",
    sku: productsMetaById.get(row.productId)?.sku ?? "",
    quantity: toNumberBigint(row._sum.quantity ?? BigInt(0)),
  }));

  const [movementsByTypeRows, lossesCurrentAgg, lossesPrevAgg, outCurrentAgg, outPrevAgg, topOutRows] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["type"],
      where: movementWhereCurrent,
      _count: { type: true },
      _sum: { quantity: true },
      orderBy: { _count: { type: "desc" } },
    }),
    prisma.stockMovement.aggregate({ where: { ...movementWhereCurrent, type: { in: ["SCRAP", "LOST"] } }, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: { ...movementWherePrev, type: { in: ["SCRAP", "LOST"] } }, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: { ...movementWhereCurrent, type: "OUT" }, _sum: { quantity: true } }),
    prisma.stockMovement.aggregate({ where: { ...movementWherePrev, type: "OUT" }, _sum: { quantity: true } }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: { ...movementWhereCurrent, type: "OUT" },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 20,
    }),
  ]);

  const outCurrent = toNumberBigint(outCurrentAgg._sum.quantity ?? BigInt(0));
  const outPrev = toNumberBigint(outPrevAgg._sum.quantity ?? BigInt(0));
  const lossesCurrent = toNumberBigint(lossesCurrentAgg._sum.quantity ?? BigInt(0));
  const lossesPrev = toNumberBigint(lossesPrevAgg._sum.quantity ?? BigInt(0));

  const topOutIds = topOutRows.map((r) => r.productId);
  const topOutMeta = topOutIds.length
    ? await prisma.product.findMany({ where: { tenantId, id: { in: topOutIds } }, select: { id: true, name: true, sku: true } })
    : [];
  const topOutMetaById = new Map(topOutMeta.map((p) => [p.id, p] as const));

  const topConsumption = topOutRows.map((r) => ({
    productId: r.productId,
    name: topOutMetaById.get(r.productId)?.name ?? "Produto",
    sku: topOutMetaById.get(r.productId)?.sku ?? "",
    quantity: toNumberBigint(r._sum.quantity ?? BigInt(0)),
  }));

  const unitWhere: any = {
    tenantId,
    ...(args.filters.categoryId ? { product: { is: { categoryId: args.filters.categoryId } } } : {}),
  };
  if (typeof args.filters.serviceId === "number") {
    unitWhere.assignedTo = { is: { requestingServiceId: args.filters.serviceId } };
  }

  const [unitsTotal, unitsByStatusRows, lossScrapLast30] = await Promise.all([
    prisma.productUnit.count({ where: unitWhere }),
    prisma.productUnit.groupBy({ by: ["status"], where: unitWhere, _count: { status: true }, orderBy: { _count: { status: "desc" } } }),
    prisma.stockMovement.count({
      where: {
        ...movementWhereCurrent,
        type: { in: ["SCRAP", "LOST"] },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), lte: period.to },
      },
    }),
  ]);

  const requestsWithSla = await prisma.request.count({
    where: {
      ...requestWhereCurrent,
      dueAt: { not: null },
    },
  });
  const breachedSla = await prisma.request.count({
    where: {
      ...requestWhereCurrent,
      dueAt: { not: null, lt: new Date() },
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
  });
  const slaCompliancePct = requestsWithSla > 0 ? round2(((requestsWithSla - breachedSla) / requestsWithSla) * 100) : 100;

  const stockOutRate = totalProducts > 0 ? outOfStock / totalProducts : 0;
  const lowStockRate = totalProducts > 0 ? lowStock / totalProducts : 0;
  const pendingRate = totalProducts > 0 ? requestsPending / totalProducts : 0;
  const lossRate = totalQuantity > 0 ? lossesCurrent / Math.max(totalQuantity, 1) : 0;
  const warehouseHealthScore = clamp(
    Math.round(100 - stockOutRate * 35 - lowStockRate * 25 - pendingRate * 20 - lossRate * 20),
    0,
    100
  );

  const categoriesAgg = await prisma.product.groupBy({
    by: ["categoryId"],
    where: categoryProductWhere,
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
  });
  const categoryIds = categoriesAgg.map((r) => r.categoryId);
  const categoriesMeta = categoryIds.length
    ? await prisma.category.findMany({ where: { tenantId, id: { in: categoryIds } }, select: { id: true, name: true } })
    : [];
  const categoryNameById = new Map(categoriesMeta.map((c) => [c.id, c.name] as const));
  const categoryDistribution = categoriesAgg.map((r) => ({
    name: categoryNameById.get(r.categoryId) ?? r.categoryId,
    value: toNumberBigint(r._sum.quantity ?? BigInt(0)),
  }));

  const productsForInactivity = await prisma.product.findMany({
    where: categoryProductWhere,
    select: { id: true, name: true, sku: true, quantity: true },
  });
  const productIdsForInactivity = productsForInactivity.map((p) => p.id);

  const lastMoves = productIdsForInactivity.length
    ? await prisma.stockMovement.groupBy({
        by: ["productId"],
        where: {
          tenantId,
          productId: { in: productIdsForInactivity },
          ...(typeof args.filters.serviceId === "number"
            ? {
                OR: [
                  { request: { is: { requestingServiceId: args.filters.serviceId } } },
                  { invoice: { is: { requestingServiceId: args.filters.serviceId } } },
                ],
              }
            : {}),
        },
        _max: { createdAt: true },
      })
    : [];
  const lastMoveByProductId = new Map(lastMoves.map((r) => [r.productId, r._max.createdAt ?? null] as const));

  const inactiveThreshold = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const inactive90Days = productsForInactivity
    .map((p) => {
      const last = lastMoveByProductId.get(p.id) ?? null;
      const daysSinceMove = last ? Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000)) : null;
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        last,
        daysSinceMove,
      };
    })
    .filter((p) => !p.last || p.last < inactiveThreshold)
    .sort((a, b) => {
      if (!a.last && b.last) return -1;
      if (a.last && !b.last) return 1;
      return (a.last?.getTime() ?? 0) - (b.last?.getTime() ?? 0);
    })
    .slice(0, 50)
    .map((p) => ({ productId: p.productId, name: p.name, sku: p.sku, daysSinceMove: p.daysSinceMove }));

  const neverMoved = productsForInactivity
    .filter((p) => !lastMoveByProductId.get(p.id))
    .slice(0, 50)
    .map((p) => ({ productId: p.id, name: p.name, sku: p.sku }));

  const suggestedReplenishment = productsForInactivity
    .map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      currentQty: toNumberBigint(p.quantity),
    }))
    .filter((p) => p.currentQty <= 20)
    .sort((a, b) => a.currentQty - b.currentQty)
    .slice(0, 20)
    .map((p) => ({
      ...p,
      suggestedQty: Math.max(0, 30 - p.currentQty),
    }));

  const byStatus = requestsByStatusRows.map((r) => ({ status: String(r.status), count: r._count.status }));

  const pendingRequests = await prisma.request.findMany({
    where: {
      ...requestWhereCurrent,
      status: { in: ["SUBMITTED", "APPROVED"] },
    },
    orderBy: { requestedAt: "desc" },
    take: 200,
    select: { id: true, gtmiNumber: true, title: true, status: true, requestedAt: true, requestingService: true },
  });

  const pendingSignatures = [
    ...pendingApproval.map((r) => ({
      id: r.id,
      gtmiNumber: r.gtmiNumber,
      title: r.title,
      status: String(r.status),
      missing: "approval" as const,
      requestedAt: r.requestedAt.toISOString(),
    })),
    ...pendingPickup.map((r) => ({
      id: r.id,
      gtmiNumber: r.gtmiNumber,
      title: r.title,
      status: String(r.status),
      missing: "pickup" as const,
      requestedAt: r.requestedAt.toISOString(),
    })),
  ].slice(0, 200);

  const movementsByType = movementsByTypeRows.map((r) => ({
    type: String(r.type),
    count: r._count.type,
    quantity: toNumberBigint(r._sum.quantity ?? BigInt(0)),
  }));

  const unitsByStatus = unitsByStatusRows.map((r) => ({ status: String(r.status), count: r._count.status }));
  const repairCount = unitsByStatus.find((r) => r.status === "IN_REPAIR")?.count ?? 0;
  const repairRatePct = unitsTotal > 0 ? round2((repairCount / unitsTotal) * 100) : 0;

  const stockRuptureRiskPct = clamp(round2((outCurrent + lossesCurrent * 2) / Math.max(totalQuantity, 1) * 100), 0, 100);
  const stockRuptureRiskPrevPct = clamp(round2((outPrev + lossesPrev * 2) / Math.max(totalQuantity, 1) * 100), 0, 100);
  const stockRuptureRiskDiffPct = pctDiff(stockRuptureRiskPct, stockRuptureRiskPrevPct);

  const criticalAlerts: string[] = [];
  if (outOfStock > 0) criticalAlerts.push(`${outOfStock} produtos sem stock.`);
  if (lowStock > 0) criticalAlerts.push(`${lowStock} produtos em stock baixo.`);
  if (requestsPending > 0) criticalAlerts.push(`${requestsPending} requisições pendentes.`);
  if (repairRatePct >= 20) criticalAlerts.push(`Taxa de reparação elevada (${repairRatePct}%).`);
  if (lossesCurrent > 0) criticalAlerts.push(`Perdas/Sucata no período: ${lossesCurrent} unidades.`);

  const narrative = [
    `Risco de rutura ${stockRuptureRiskDiffPct >= 0 ? "aumentou" : "reduziu"} ${Math.abs(stockRuptureRiskDiffPct).toFixed(2)}% face ao período anterior.`,
    `Consumo (OUT) ${pctDiff(outCurrent, outPrev) >= 0 ? "subiu" : "desceu"} ${Math.abs(pctDiff(outCurrent, outPrev)).toFixed(2)}% face ao período anterior.`,
    `Perdas/Sucata ${pctDiff(lossesCurrent, lossesPrev) >= 0 ? "subiu" : "desceu"} ${Math.abs(pctDiff(lossesCurrent, lossesPrev)).toFixed(2)}% face ao período anterior.`,
  ];

  const allAlerts = [...criticalAlerts, ...narrative];

  const rawForHash = JSON.stringify({
    tenantId,
    period,
    previousPeriod,
    filters: args.filters,
    executive: {
      lowStock,
      outOfStock,
      requestsPending,
      lossesCurrent,
      slaCompliancePct,
      warehouseHealthScore,
    },
    generatedById: args.generatedBy.id,
  });
  const documentHash = crypto.createHash("sha256").update(rawForHash).digest("hex");

  return {
    meta: {
      tenantId,
      tenantName: tenant?.name ?? "Tenant",
      generatedAt: new Date().toISOString(),
      generatedBy: args.generatedBy,
      period,
      previousPeriod,
      filters: {
        ...(typeof args.filters.serviceId === "number" ? { serviceId: args.filters.serviceId } : {}),
        ...(args.filters.categoryId ? { categoryId: args.filters.categoryId } : {}),
      },
      documentHash,
    },
    executive: {
      stockLow: lowStock,
      outOfStock,
      pendingRequests: requestsPending,
      lossesScrap: lossesCurrent,
      slaCompliancePct,
      warehouseHealthScore,
    },
    inventory: {
      categoryDistribution,
      inactive90Days,
      neverMoved,
      suggestedReplenishment,
    },
    requests: {
      byStatus,
      topRequestedProducts,
      pendingSignatures,
      pendingRequests: pendingRequests.map((r) => ({
        id: r.id,
        gtmiNumber: r.gtmiNumber,
        title: r.title,
        status: String(r.status),
        requestedAt: r.requestedAt.toISOString(),
        requestingService: r.requestingService ?? null,
      })),
    },
    movements: {
      byType: movementsByType,
      topConsumption,
      trend: {
        currentOut: outCurrent,
        previousOut: outPrev,
        outDiffPct: pctDiff(outCurrent, outPrev),
        currentLosses: lossesCurrent,
        previousLosses: lossesPrev,
        lossesDiffPct: pctDiff(lossesCurrent, lossesPrev),
      },
    },
    units: {
      byStatus: unitsByStatus,
      repairRatePct,
      lossScrapLast30Days: lossScrapLast30,
    },
    risk: {
      stockRuptureRiskPct,
      stockRuptureRiskPrevPct,
      stockRuptureRiskDiffPct,
      quarantineItems: 0,
      criticalAlerts,
      narrative,
      allAlerts,
    },
    annex: {
      top20Consumption: topConsumption.slice(0, 20),
      pendingRequests: pendingRequests.map((r) => ({
        id: r.id,
        gtmiNumber: r.gtmiNumber,
        title: r.title,
        status: String(r.status),
        requestedAt: r.requestedAt.toISOString(),
        requestingService: r.requestingService ?? null,
      })),
    },
  };
}
