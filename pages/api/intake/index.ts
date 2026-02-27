import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const createIntakeSchema = z.object({
  asUserId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1).max(64),
  reqNumber: z.string().max(64).optional(),
  requestId: z.string().uuid().optional(),
  requestingServiceId: z.number().int().optional(),
  issuedAt: z.string().datetime().optional(),
  reqDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),

  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),

  // Either create a new product or add stock to an existing one
  productId: z.string().uuid().optional(),
  product: z
    .object({
      name: z.string().min(1).max(100),
      description: z.string().max(1000).optional(),
      sku: z.string().min(1).max(64),
      price: z.number().nonnegative(),
      categoryId: z.string().uuid(),
      supplierId: z.string().uuid(),
      isPatrimonializable: z.boolean().optional(),
    })
    .optional(),
});

function calculateStatus(quantity: number): string {
  if (quantity > 20) return "Available";
  if (quantity > 0 && quantity <= 20) return "Stock Low";
  return "Stock Out";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenantId = session.tenantId;

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = createIntakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const {
    invoiceNumber,
    reqNumber,
    requestId,
    requestingServiceId,
    issuedAt,
    reqDate,
    notes,
    quantity,
    unitPrice,
    productId,
    product,
  } = parsed.data;

  if (!productId && !product) {
    return res.status(400).json({ error: "Either productId or product is required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let targetProductId = productId;
      let targetSupplierName: string | null = null;
      let targetRequest: { id: string; gtmiNumber: string; requestedAt: Date } | null = null;

      if (typeof requestingServiceId === "number") {
        const svc = await tx.requestingService.findUnique({
          where: { id: requestingServiceId },
          select: { id: true, ativo: true },
        });
        if (!svc) {
          throw Object.assign(new Error("Serviço requisitante inválido"), { code: "INVALID_REQUESTING_SERVICE" });
        }
        if (!svc.ativo) {
          throw Object.assign(new Error("Serviço requisitante inativo"), { code: "INACTIVE_REQUESTING_SERVICE" });
        }
      }

      if (!targetProductId) {
        // Ensure SKU unique (global unique in schema). Provide clearer error.
        const existingSku = await tx.product.findUnique({ where: { sku: product!.sku } });
        if (existingSku) {
          throw Object.assign(new Error("SKU must be unique"), { code: "SKU_UNIQUE" });
        }

        // Ensure category/supplier belong to this tenant
        const [category, supplier] = await Promise.all([
          tx.category.findFirst({ where: { id: product!.categoryId, tenantId }, select: { id: true } }),
          tx.supplier.findFirst({ where: { id: product!.supplierId, tenantId }, select: { id: true } }),
        ]);
        if (!category) {
          throw Object.assign(new Error("Invalid category"), { code: "INVALID_CATEGORY" });
        }
        if (!supplier) {
          throw Object.assign(new Error("Invalid supplier"), { code: "INVALID_SUPPLIER" });
        }

        const createdProduct = await tx.product.create({
          data: {
            tenantId,
            name: product!.name,
            description: product!.description,
            sku: product!.sku,
            price: product!.price,
            quantity: BigInt(0) as any,
            status: calculateStatus(0),
            isPatrimonializable: Boolean(product!.isPatrimonializable),
            categoryId: product!.categoryId,
            supplierId: product!.supplierId,
          } as any,
        });

        targetProductId = createdProduct.id;

        const sup = await tx.supplier.findFirst({
          where: { id: product!.supplierId, tenantId },
          select: { name: true },
        });
        targetSupplierName = sup?.name ?? null;
      } else {
        // Ensure product belongs to user
        const existing = await tx.product.findFirst({
          where: { id: targetProductId, tenantId },
          select: { id: true, supplier: { select: { name: true } } },
        });
        if (!existing) {
          throw Object.assign(new Error("Product not found"), { code: "PRODUCT_NOT_FOUND" });
        }

        targetSupplierName = existing.supplier?.name ?? null;
      }

      // Resolve request linking:
      // - If requestId is provided, validate and use it.
      // - Else if reqNumber is provided, try to match that GTMI number.
      // - Else attempt a conservative auto-link if there is exactly one recent matching request for this product.
      if (requestId) {
        const request = await tx.request.findFirst({
          where: {
            id: requestId,
            tenantId,
            items: { some: { productId: targetProductId! } },
          },
          select: { id: true, gtmiNumber: true, requestedAt: true },
        });

        if (!request) {
          throw Object.assign(new Error("Request not found for this product"), { code: "REQUEST_NOT_FOUND" });
        }
        targetRequest = { id: request.id, gtmiNumber: request.gtmiNumber, requestedAt: request.requestedAt };
      } else if (reqNumber?.trim()) {
        const request = await tx.request.findFirst({
          where: {
            tenantId,
            gtmiNumber: reqNumber.trim(),
            items: { some: { productId: targetProductId! } },
          },
          select: { id: true, gtmiNumber: true, requestedAt: true },
        });

        if (request) {
          targetRequest = { id: request.id, gtmiNumber: request.gtmiNumber, requestedAt: request.requestedAt };
        }
      } else {
        const candidates = await tx.request.findMany({
          where: {
            tenantId,
            status: { in: ["SUBMITTED", "APPROVED", "FULFILLED"] },
            items: { some: { productId: targetProductId! } },
          },
          orderBy: { requestedAt: "desc" },
          take: 10,
          select: { id: true, gtmiNumber: true, title: true, requestedAt: true },
        });

        if (candidates.length === 1) {
          targetRequest = { id: candidates[0].id, gtmiNumber: candidates[0].gtmiNumber, requestedAt: candidates[0].requestedAt };
        } else if (candidates.length > 1) {
          throw Object.assign(new Error("Multiple requests match this product"), {
            code: "REQUEST_AMBIGUOUS",
            candidates: candidates.map((c) => ({
              id: c.id,
              gtmiNumber: c.gtmiNumber,
              title: c.title ?? null,
              requestedAt: c.requestedAt.toISOString(),
            })),
          });
        }
      }

      const effectiveReqNumber = targetRequest?.gtmiNumber ?? (reqNumber?.trim() ? reqNumber.trim() : null);
      const effectiveReqDate = reqDate
        ? new Date(reqDate)
        : targetRequest
          ? targetRequest.requestedAt
          : null;

      // Create invoice row (acts as the grouping for this intake)
      const createdInvoice = await tx.productInvoice.create({
        data: {
          tenantId,
          productId: targetProductId!,
          requestId: targetRequest?.id ?? requestId ?? null,
          invoiceNumber,
          reqNumber: effectiveReqNumber,
          reqDate: effectiveReqDate,
          requestingServiceId: typeof requestingServiceId === "number" ? requestingServiceId : null,
          issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
          quantity: BigInt(quantity) as any,
          unitPrice: unitPrice ?? 0,
          notes: notes ?? null,
        } as any,
      });

      // Auto-fill supplier option in the linked request for traceability.
      if (targetRequest) {
        const supplierLabel = (targetSupplierName ?? "").trim();
        const reqLabel = effectiveReqNumber ? `REQ.N: ${effectiveReqNumber}` : "";
        const raw = [supplierLabel ? `${supplierLabel}` : null, `FT: ${invoiceNumber}`, reqLabel || null]
          .filter(Boolean)
          .join(" - ");
        const value = raw.slice(0, 200);

        const existing = await tx.request.findFirst({
          where: { id: targetRequest.id, tenantId },
          select: { supplierOption1: true, supplierOption2: true, supplierOption3: true },
        });

        if (existing) {
          const slots = [existing.supplierOption1, existing.supplierOption2, existing.supplierOption3].map((v) =>
            typeof v === "string" ? v.trim() : ""
          );
          const already = slots.some((v) => v === value);
          if (!already) {
            const patch: any = {};
            if (!slots[0]) patch.supplierOption1 = value;
            else if (!slots[1]) patch.supplierOption2 = value;
            else if (!slots[2]) patch.supplierOption3 = value;
            if (Object.keys(patch).length) {
              await tx.request.update({ where: { id: targetRequest.id }, data: patch });
            }
          }
        }
      }

      // Create per-unit QR codes
      const unitsToCreate = Array.from({ length: quantity }).map(() => ({
        id: crypto.randomUUID(),
        tenantId,
        productId: targetProductId!,
        invoiceId: createdInvoice.id,
        code: crypto.randomUUID(),
        status: "IN_STOCK" as const,
      }));

      await (tx as any).productUnit.createMany({ data: unitsToCreate });

      // Update product aggregate quantity & status
      const updatedProduct = await tx.product.update({
        where: { id: targetProductId! },
        data: {
          quantity: { increment: BigInt(quantity) as any },
        },
      });

      const finalQuantity = Number(updatedProduct.quantity);
      const finalStatus = calculateStatus(finalQuantity);

      const finalProduct = await tx.product.update({
        where: { id: targetProductId! },
        data: { status: finalStatus },
      });

      // Audit trail
      await (tx as any).stockMovement.create({
        data: {
          type: "IN",
          quantity: BigInt(quantity) as any,
          tenantId,
          productId: targetProductId!,
          invoiceId: createdInvoice.id,
          requestId: requestId ?? null,
          performedByUserId: session.id,
          reason: "Intake",
          notes: notes ?? null,
        },
        select: { id: true },
      });

      return {
        product: {
          ...finalProduct,
          quantity: Number(finalProduct.quantity),
          createdAt: finalProduct.createdAt.toISOString(),
          updatedAt: finalProduct.updatedAt.toISOString(),
        },
        invoice: {
          ...createdInvoice,
          reqNumber: (createdInvoice as any).reqNumber ?? null,
          quantity: Number(createdInvoice.quantity),
          issuedAt: createdInvoice.issuedAt.toISOString(),
          createdAt: createdInvoice.createdAt.toISOString(),
          updatedAt: createdInvoice.updatedAt.toISOString(),
        },
        units: {
          count: quantity,
          // Return a preview only; full list can be fetched via /api/units
          previewCodes: unitsToCreate.slice(0, 24).map((u) => u.code),
        },
      };
    });

    return res.status(201).json(result);
  } catch (error: any) {
    if (error?.code === "SKU_UNIQUE" || error?.message === "SKU must be unique") {
      return res.status(400).json({ error: "SKU must be unique" });
    }

    if (error?.code === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ error: "Product not found" });
    }

    if (error?.code === "REQUEST_NOT_FOUND") {
      return res.status(404).json({ error: "Request not found for this product" });
    }

    if (error?.code === "REQUEST_AMBIGUOUS") {
      return res.status(409).json({
        error: "Multiple requests match this product. Please choose one.",
        candidates: Array.isArray(error?.candidates) ? error.candidates : [],
      });
    }

    if (error?.code === "INVALID_CATEGORY") {
      return res.status(400).json({ error: "Invalid category" });
    }

    if (error?.code === "INVALID_SUPPLIER") {
      return res.status(400).json({ error: "Invalid supplier" });
    }

    console.error("POST /api/intake error:", error);
    return res.status(500).json({ error: "Failed to create intake" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
