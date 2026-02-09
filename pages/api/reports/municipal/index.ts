import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import {
  municipalReportQuerySchema,
  toIsoRange,
  type MunicipalReportData,
} from "@/utils/municipalReports";

function toNumberBigint(value: any): number {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clampTop<T>(rows: T[], max = 10): T[] {
  return rows.slice(0, Math.max(0, max));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = municipalReportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const { fromDate, toDate } = toIsoRange(parsed.data.from, parsed.data.to);
  const tenantId = session.tenantId;

  const dateWhere =
    fromDate || toDate
      ? {
          gte: fromDate ?? undefined,
          lte: toDate ?? undefined,
        }
      : null;

  try {
    // Stock position
    const products = await prisma.product.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        quantity: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });

    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const byCategoryMap = new Map<string, { quantity: number; value: number }>();
    const bySupplierMap = new Map<string, { quantity: number; value: number }>();

    const stockRows = products.map((p) => {
      const qty = toNumberBigint(p.quantity);
      const value = qty * Number(p.price || 0);

      totalQuantity += qty;
      totalValue += value;

      if (qty === 0) outOfStockCount += 1;
      if (qty > 0 && qty <= 20) lowStockCount += 1;

      const cat = p.category?.name ?? "Sem categoria";
      const sup = p.supplier?.name ?? "Sem fornecedor";

      const catAgg = byCategoryMap.get(cat) || { quantity: 0, value: 0 };
      byCategoryMap.set(cat, { quantity: catAgg.quantity + qty, value: catAgg.value + value });

      const supAgg = bySupplierMap.get(sup) || { quantity: 0, value: 0 };
      bySupplierMap.set(sup, { quantity: supAgg.quantity + qty, value: supAgg.value + value });

      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        quantity: qty,
        unitPrice: Number(p.price || 0),
        value,
      };
    });

    const topByValue = clampTop(
      [...stockRows].sort((a, b) => b.value - a.value),
      10
    );

    const lowStock = clampTop(
      stockRows
        .filter((r) => r.quantity > 0 && r.quantity <= 20)
        .sort((a, b) => a.quantity - b.quantity)
        .map((r) => ({ productId: r.productId, name: r.name, sku: r.sku, quantity: r.quantity })),
      10
    );

    const byCategory = [...byCategoryMap.entries()]
      .map(([category, agg]) => ({ category, quantity: agg.quantity, value: agg.value }))
      .sort((a, b) => b.value - a.value);

    const bySupplier = [...bySupplierMap.entries()]
      .map(([supplier, agg]) => ({ supplier, quantity: agg.quantity, value: agg.value }))
      .sort((a, b) => b.value - a.value);

    // Purchases/Entries (Invoices)
    const invoices = await prisma.productInvoice.findMany({
      where: {
        tenantId,
        ...(dateWhere ? { issuedAt: dateWhere } : {}),
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        productId: true,
        product: { select: { name: true, sku: true, supplier: { select: { name: true } } } },
      },
    });

    let invoicesCount = invoices.length;
    let invoicesTotalQty = 0;
    let invoicesTotalSpend = 0;

    const purchasesBySupplier = new Map<string, { spend: number; quantity: number; invoices: number }>();
    const purchasesByProduct = new Map<string, { productId: string; name: string; sku: string; quantity: number; spend: number }>();

    for (const inv of invoices) {
      const qty = toNumberBigint(inv.quantity);
      const unitPrice = Number(inv.unitPrice || 0);
      const spend = qty * unitPrice;
      invoicesTotalQty += qty;
      invoicesTotalSpend += spend;

      const supplier = inv.product?.supplier?.name ?? "Sem fornecedor";
      const supAgg = purchasesBySupplier.get(supplier) || { spend: 0, quantity: 0, invoices: 0 };
      purchasesBySupplier.set(supplier, {
        spend: supAgg.spend + spend,
        quantity: supAgg.quantity + qty,
        invoices: supAgg.invoices + 1,
      });

      const prodKey = inv.productId;
      const prodAgg = purchasesByProduct.get(prodKey) || {
        productId: inv.productId,
        name: inv.product?.name ?? "Produto",
        sku: inv.product?.sku ?? "",
        quantity: 0,
        spend: 0,
      };
      purchasesByProduct.set(prodKey, {
        ...prodAgg,
        quantity: prodAgg.quantity + qty,
        spend: prodAgg.spend + spend,
      });
    }

    const purchasesBySupplierRows = [...purchasesBySupplier.entries()]
      .map(([supplier, agg]) => ({ supplier, ...agg }))
      .sort((a, b) => b.spend - a.spend);

    const purchasesTopProducts = [...purchasesByProduct.values()]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10);

    // Requests/Consumption
    const requests = await prisma.request.findMany({
      where: {
        tenantId,
        ...(dateWhere ? { requestedAt: dateWhere } : {}),
      },
      select: {
        id: true,
        status: true,
        requestingService: true,
        requestedAt: true,
        signedAt: true,
        pickupSignedAt: true,
        items: {
          select: {
            quantity: true,
            productId: true,
            product: { select: { name: true, sku: true } },
          },
        },
      },
    });

    const byStatusMap = new Map<string, number>();
    const byServiceMap = new Map<string, { requests: number; items: number }>();
    const requestProductMap = new Map<string, { productId: string; name: string; sku: string; quantity: number }>();

    let totalItemsRequested = 0;
    let approvedSignedCount = 0;
    let pickupSignedCount = 0;
    let totalConsidered = 0;

    for (const r of requests) {
      const status = String(r.status);
      byStatusMap.set(status, (byStatusMap.get(status) || 0) + 1);

      const service = (r.requestingService ?? "Sem serviço").trim() || "Sem serviço";
      const serviceAgg = byServiceMap.get(service) || { requests: 0, items: 0 };

      let itemsForReq = 0;
      for (const it of r.items || []) {
        const qty = toNumberBigint(it.quantity);
        if (qty <= 0) continue;
        totalItemsRequested += qty;
        itemsForReq += qty;

        const pName = it.product?.name ?? "Produto";
        const pSku = it.product?.sku ?? "";
        const key = it.productId;
        const pAgg = requestProductMap.get(key) || { productId: it.productId, name: pName, sku: pSku, quantity: 0 };
        requestProductMap.set(key, { ...pAgg, quantity: pAgg.quantity + qty });
      }

      byServiceMap.set(service, {
        requests: serviceAgg.requests + 1,
        items: serviceAgg.items + itemsForReq,
      });

      if (["APPROVED", "FULFILLED"].includes(status)) {
        totalConsidered += 1;
        if (r.signedAt) approvedSignedCount += 1;
        if (r.pickupSignedAt) pickupSignedCount += 1;
      }
    }

    const requestsByStatus = [...byStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const requestsByService = [...byServiceMap.entries()]
      .map(([service, agg]) => ({ service, ...agg }))
      .sort((a, b) => b.items - a.items);

    const requestsTopProducts = [...requestProductMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Movements/Audit
    const movements = await prisma.stockMovement.findMany({
      where: {
        tenantId,
        ...(dateWhere ? { createdAt: dateWhere } : {}),
      },
      select: {
        id: true,
        type: true,
        quantity: true,
        createdAt: true,
        costCenter: true,
        reason: true,
        requestId: true,
        invoiceId: true,
        product: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const movementsByType = new Map<string, { quantity: number; count: number }>();

    const recentMovements = movements.map((m) => {
      const type = String(m.type);
      const qty = toNumberBigint(m.quantity);
      const agg = movementsByType.get(type) || { quantity: 0, count: 0 };
      movementsByType.set(type, { quantity: agg.quantity + qty, count: agg.count + 1 });

      return {
        id: m.id,
        createdAt: m.createdAt.toISOString(),
        type,
        quantity: qty,
        productName: m.product?.name ?? "Produto",
        productSku: m.product?.sku ?? "",
        costCenter: m.costCenter ?? null,
        reason: m.reason ?? null,
        requestId: m.requestId ?? null,
        invoiceId: m.invoiceId ?? null,
      };
    });

    const movementsByTypeRows = [...movementsByType.entries()]
      .map(([type, agg]) => ({ type, ...agg }))
      .sort((a, b) => b.count - a.count);

    // Units/Assets
    const unitsGrouped = await prisma.productUnit.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });

    const unitsByStatus = unitsGrouped
      .map((r) => ({ status: String(r.status), count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    const totalUnits = unitsByStatus.reduce((sum, s) => sum + s.count, 0);

    const unitsByProduct = await prisma.productUnit.groupBy({
      by: ["productId"],
      where: { tenantId },
      _count: { _all: true },
      orderBy: { _count: { _all: "desc" } },
      take: 10,
    });

    const productIds = unitsByProduct.map((r) => r.productId);
    const productMeta = await prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });

    const productMetaMap = new Map(productMeta.map((p) => [p.id, p] as const));

    const unitsTopProducts = unitsByProduct.map((r) => {
      const p = productMetaMap.get(r.productId);
      return {
        productId: r.productId,
        name: p?.name ?? "Produto",
        sku: p?.sku ?? "",
        units: r._count._all,
      };
    });

    const payload: MunicipalReportData = {
      meta: {
        generatedAt: new Date().toISOString(),
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
      stock: {
        totalProducts: products.length,
        totalQuantity,
        totalValue: Number(totalValue.toFixed(2)),
        lowStockCount,
        outOfStockCount,
        topByValue: topByValue.map((r) => ({
          ...r,
          value: Number(r.value.toFixed(2)),
          unitPrice: Number(r.unitPrice.toFixed(2)),
        })),
        lowStock,
        byCategory: byCategory.map((r) => ({ ...r, value: Number(r.value.toFixed(2)) })),
        bySupplier: bySupplier.map((r) => ({ ...r, value: Number(r.value.toFixed(2)) })),
      },
      purchases: {
        invoicesCount,
        totalQuantity: invoicesTotalQty,
        totalSpend: Number(invoicesTotalSpend.toFixed(2)),
        bySupplier: purchasesBySupplierRows.map((r) => ({
          supplier: r.supplier,
          spend: Number(r.spend.toFixed(2)),
          quantity: r.quantity,
          invoices: r.invoices,
        })),
        topProducts: purchasesTopProducts.map((r) => ({
          ...r,
          spend: Number(r.spend.toFixed(2)),
        })),
      },
      requests: {
        requestsCount: requests.length,
        totalItemsRequested,
        byStatus: requestsByStatus,
        byService: requestsByService,
        topProducts: requestsTopProducts,
        signatureCompliance: {
          approvedSignedCount,
          pickupSignedCount,
          totalConsidered,
        },
      },
      movements: {
        totalMovements: movements.length,
        byType: movementsByTypeRows.map((r) => ({
          ...r,
          quantity: Number(r.quantity.toFixed(0)),
        })),
        recent: recentMovements,
      },
      units: {
        totalUnits,
        byStatus: unitsByStatus,
        topProducts: unitsTopProducts,
      },
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error("GET /api/reports/municipal error:", error);
    return res.status(500).json({ error: "Failed to generate report" });
  }
}
