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
  issuedAt: z.string().datetime().optional(),
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

  const isAdmin = session.role === "ADMIN";

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = createIntakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const {
    asUserId,
    invoiceNumber,
    reqNumber,
    requestId,
    issuedAt,
    notes,
    quantity,
    unitPrice,
    productId,
    product,
  } = parsed.data;

  const actingUserId = isAdmin && asUserId ? asUserId : session.id;

  if (!productId && !product) {
    return res.status(400).json({ error: "Either productId or product is required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let targetProductId = productId;

      if (!targetProductId) {
        // Ensure SKU unique (global unique in schema). Provide clearer error.
        const existingSku = await tx.product.findUnique({ where: { sku: product!.sku } });
        if (existingSku) {
          throw Object.assign(new Error("SKU must be unique"), { code: "SKU_UNIQUE" });
        }

        const createdProduct = await tx.product.create({
          data: {
            userId: actingUserId,
            name: product!.name,
            description: product!.description,
            sku: product!.sku,
            price: product!.price,
            quantity: BigInt(0) as any,
            status: calculateStatus(0),
            categoryId: product!.categoryId,
            supplierId: product!.supplierId,
          } as any,
        });

        targetProductId = createdProduct.id;
      } else {
        // Ensure product belongs to user
        const existing = await tx.product.findFirst({
          where: { id: targetProductId, userId: actingUserId },
          select: { id: true },
        });
        if (!existing) {
          throw Object.assign(new Error("Product not found"), { code: "PRODUCT_NOT_FOUND" });
        }
      }

      if (requestId) {
        const request = await tx.request.findFirst({
          where: {
            id: requestId,
            userId: actingUserId,
            items: { some: { productId: targetProductId! } },
          },
          select: { id: true },
        });

        if (!request) {
          throw Object.assign(new Error("Request not found for this product"), { code: "REQUEST_NOT_FOUND" });
        }
      }

      // Create invoice row (acts as the grouping for this intake)
      const createdInvoice = await tx.productInvoice.create({
        data: {
          userId: actingUserId,
          productId: targetProductId!,
          requestId: requestId ?? null,
          invoiceNumber,
          reqNumber: reqNumber ?? null,
          issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
          quantity: BigInt(quantity) as any,
          unitPrice: unitPrice ?? 0,
          notes: notes ?? null,
        } as any,
      });

      // Create per-unit QR codes
      const unitsToCreate = Array.from({ length: quantity }).map(() => ({
        id: crypto.randomUUID(),
        userId: actingUserId,
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
          userId: actingUserId,
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

    console.error("POST /api/intake error:", error);
    return res.status(500).json({ error: "Failed to create intake" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
