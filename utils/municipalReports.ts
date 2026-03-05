import { z } from "zod";

export const municipalReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type MunicipalReportQuery = z.infer<typeof municipalReportQuerySchema>;

export type MunicipalReportData = {
  meta: {
    generatedAt: string;
    from: string | null;
    to: string | null;
  };

  stock: {
    totalProducts: number;
    totalQuantity: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    topByValue: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; value: number }>;
    lowStock: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    byCategory: Array<{ category: string; quantity: number; value: number }>;
    bySupplier: Array<{ supplier: string; quantity: number; value: number }>;
  };

  purchases: {
    invoicesCount: number;
    totalQuantity: number;
    totalSpend: number;
    bySupplier: Array<{ supplier: string; spend: number; quantity: number; invoices: number }>;
    topProducts: Array<{ productId: string; name: string; sku: string; quantity: number; spend: number }>;
  };

  requests: {
    requestsCount: number;
    totalItemsRequested: number;
    byStatus: Array<{ status: string; count: number }>;
    byService: Array<{ service: string; requests: number; items: number }>;
    topProducts: Array<{ productId: string; name: string; sku: string; quantity: number }>;
    signatureCompliance: {
      approvedSignedCount: number;
      pickupSignedCount: number;
      totalConsidered: number;
    };
  };

  movements: {
    totalMovements: number;
    byType: Array<{ type: string; quantity: number; count: number }>;
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
    topProducts: Array<{ productId: string; name: string; sku: string; units: number }>;
  };
};

export function toIsoRange(from?: string, to?: string): { fromDate: Date | null; toDate: Date | null } {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  if (fromDate && !Number.isFinite(fromDate.getTime())) return { fromDate: null, toDate };
  if (toDate && !Number.isFinite(toDate.getTime())) return { fromDate, toDate: null };

  return { fromDate, toDate };
}
