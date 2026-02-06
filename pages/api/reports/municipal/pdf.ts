import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import {
  municipalReportQuerySchema,
  toIsoRange,
  type MunicipalReportData,
} from "@/utils/municipalReports";
import { buildMunicipalReportPdfBytes } from "@/utils/municipalReportPdf";

const ensureDir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

function safeFileBase(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "report";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = municipalReportQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const { fromDate, toDate } = toIsoRange(parsed.data.from, parsed.data.to);
  const tenantId = session.tenantId;

  try {
    // Reuse the same aggregation as JSON endpoint by calling prisma directly here.
    // (We keep it inline to avoid cross-importing API handlers.)

    const dateWhere =
      fromDate || toDate
        ? {
            gte: fromDate ?? undefined,
            lte: toDate ?? undefined,
          }
        : null;

    const toNumberBigint = (value: any): number => {
      if (typeof value === "bigint") return Number(value);
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    };

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

    const topByValue = [...stockRows].sort((a, b) => b.value - a.value).slice(0, 10);
    const lowStock = stockRows
      .filter((r) => r.quantity > 0 && r.quantity <= 20)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 10)
      .map((r) => ({ productId: r.productId, name: r.name, sku: r.sku, quantity: r.quantity }));

    const byCategory = [...byCategoryMap.entries()]
      .map(([category, agg]) => ({ category, quantity: agg.quantity, value: Number(agg.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    const bySupplier = [...bySupplierMap.entries()]
      .map(([supplier, agg]) => ({ supplier, quantity: agg.quantity, value: Number(agg.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    const invoices = await prisma.productInvoice.findMany({
      where: {
        tenantId,
        ...(dateWhere ? { issuedAt: dateWhere } : {}),
      },
      select: {
        quantity: true,
        unitPrice: true,
        productId: true,
        product: { select: { name: true, sku: true, supplier: { select: { name: true } } } },
      },
    });

    const purchasesBySupplier = new Map<string, { spend: number; quantity: number; invoices: number }>();
    const purchasesByProduct = new Map<string, { productId: string; name: string; sku: string; quantity: number; spend: number }>();
    let invoicesTotalQty = 0;
    let invoicesTotalSpend = 0;

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

      const key = inv.productId;
      const prodAgg = purchasesByProduct.get(key) || {
        productId: inv.productId,
        name: inv.product?.name ?? "Produto",
        sku: inv.product?.sku ?? "",
        quantity: 0,
        spend: 0,
      };
      purchasesByProduct.set(key, {
        ...prodAgg,
        quantity: prodAgg.quantity + qty,
        spend: prodAgg.spend + spend,
      });
    }

    const purchasesBySupplierRows = [...purchasesBySupplier.entries()]
      .map(([supplier, agg]) => ({ supplier, spend: Number(agg.spend.toFixed(2)), quantity: agg.quantity, invoices: agg.invoices }))
      .sort((a, b) => b.spend - a.spend);

    const purchasesTopProducts = [...purchasesByProduct.values()]
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)
      .map((p) => ({ ...p, spend: Number(p.spend.toFixed(2)) }));

    const requests = await prisma.request.findMany({
      where: {
        tenantId,
        ...(dateWhere ? { requestedAt: dateWhere } : {}),
      },
      select: {
        status: true,
        requestingService: true,
        signedAt: true,
        pickupSignedAt: true,
        items: { select: { quantity: true, productId: true, product: { select: { name: true, sku: true } } } },
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
      const svcAgg = byServiceMap.get(service) || { requests: 0, items: 0 };

      let itemsForReq = 0;
      for (const it of r.items || []) {
        const qty = toNumberBigint(it.quantity);
        if (qty <= 0) continue;
        totalItemsRequested += qty;
        itemsForReq += qty;

        const key = it.productId;
        const pAgg = requestProductMap.get(key) || {
          productId: it.productId,
          name: it.product?.name ?? "Produto",
          sku: it.product?.sku ?? "",
          quantity: 0,
        };
        requestProductMap.set(key, { ...pAgg, quantity: pAgg.quantity + qty });
      }

      byServiceMap.set(service, { requests: svcAgg.requests + 1, items: svcAgg.items + itemsForReq });

      if (["APPROVED", "FULFILLED"].includes(status)) {
        totalConsidered += 1;
        if (r.signedAt) approvedSignedCount += 1;
        if (r.pickupSignedAt) pickupSignedCount += 1;
      }
    }

    const requestsByStatus = [...byStatusMap.entries()].map(([status, count]) => ({ status, count }));
    const requestsByService = [...byServiceMap.entries()]
      .map(([service, agg]) => ({ service, ...agg }))
      .sort((a, b) => b.items - a.items)
      .slice(0, 10);

    const requestsTopProducts = [...requestProductMap.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

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
    for (const m of movements) {
      const type = String(m.type);
      const qty = toNumberBigint(m.quantity);
      const agg = movementsByType.get(type) || { quantity: 0, count: 0 };
      movementsByType.set(type, { quantity: agg.quantity + qty, count: agg.count + 1 });
    }

    const movementsByTypeRows = [...movementsByType.entries()]
      .map(([type, agg]) => ({ type, quantity: agg.quantity, count: agg.count }))
      .sort((a, b) => b.count - a.count);

    const unitsGrouped = await prisma.productUnit.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    });

    const unitsByStatus = unitsGrouped.map((r) => ({ status: String(r.status), count: r._count._all }));
    const totalUnits = unitsByStatus.reduce((sum, r) => sum + r.count, 0);

    const unitsByProduct = await prisma.productUnit.groupBy({
      by: ["productId"],
      where: { tenantId },
      _count: { _all: true },
      orderBy: { _count: { _all: "desc" } },
      take: 8,
    });

    const productIds = unitsByProduct.map((r) => r.productId);
    const productMeta = await prisma.product.findMany({
      where: { tenantId, id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMetaMap = new Map(productMeta.map((p) => [p.id, p] as const));

    const unitsTopProducts = unitsByProduct.map((r) => {
      const p = productMetaMap.get(r.productId);
      return { productId: r.productId, name: p?.name ?? "Produto", sku: p?.sku ?? "", units: r._count._all };
    });

    const data: MunicipalReportData = {
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
          unitPrice: Number(r.unitPrice.toFixed(2)),
          value: Number(r.value.toFixed(2)),
        })),
        lowStock,
        byCategory,
        bySupplier,
      },
      purchases: {
        invoicesCount: invoices.length,
        totalQuantity: invoicesTotalQty,
        totalSpend: Number(invoicesTotalSpend.toFixed(2)),
        bySupplier: purchasesBySupplierRows,
        topProducts: purchasesTopProducts,
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
        byType: movementsByTypeRows,
        recent: movements.map((m) => ({
          id: m.id,
          createdAt: m.createdAt.toISOString(),
          type: String(m.type),
          quantity: toNumberBigint(m.quantity),
          productName: m.product?.name ?? "Produto",
          productSku: m.product?.sku ?? "",
          costCenter: m.costCenter ?? null,
          reason: m.reason ?? null,
          requestId: m.requestId ?? null,
          invoiceId: m.invoiceId ?? null,
        })),
      },
      units: {
        totalUnits,
        byStatus: unitsByStatus,
        topProducts: unitsTopProducts,
      },
    };

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    const pdfBytes = await buildMunicipalReportPdfBytes({ tenantName: tenant?.name ?? null, data });

    const archive = req.method === "POST";

    if (archive) {
      const year = (toDate ?? fromDate ?? new Date()).getFullYear();
      const storageRoot = path.join(process.cwd(), "storage", tenantId, String(year), "OUTROS");
      await ensureDir(storageRoot);

      const id = crypto.randomUUID();
      const fromLabel = fromDate ? fromDate.toISOString().slice(0, 10) : "inicio";
      const toLabel = toDate ? toDate.toISOString().slice(0, 10) : "hoje";
      const fileBase = safeFileBase(`Relatorio_Municipal_${fromLabel}_a_${toLabel}`);
      const fileName = `${fileBase}-${id}.pdf`;
      const absPath = path.join(storageRoot, fileName);

      await fs.promises.writeFile(absPath, Buffer.from(pdfBytes));

      const stored = await prisma.storedFile.create({
        data: {
          id,
          tenantId,
          kind: "OTHER",
          originalName: `${fileBase}.pdf`,
          fileName,
          mimeType: "application/pdf",
          sizeBytes: Buffer.byteLength(Buffer.from(pdfBytes)),
          storagePath: path.relative(process.cwd(), absPath),
        },
      });

      return res.status(200).json({
        archived: {
          ...stored,
          createdAt: stored.createdAt.toISOString(),
          updatedAt: stored.updatedAt.toISOString(),
        },
        pdfBase64: Buffer.from(pdfBytes).toString("base64"),
      });
    }

    // Download-only
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=Relatorio_Municipal.pdf");
    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("/api/reports/municipal/pdf error:", error);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
}
