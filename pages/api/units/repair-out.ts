import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const bodySchema = z.object({
  code: z.string().uuid(),
  asUserId: z.string().uuid().optional(),
  reason: z.string().trim().max(200).optional().nullable(),
  costCenter: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const computeProductStatus = (quantity: number) =>
  quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const tenantId = session.tenantId;
  const performedByUserId = session.id;
  const { code, reason, costCenter, notes } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const unit = await txAny.productUnit.findFirst({
        where: { code },
        select: {
          id: true,
          status: true,
          tenantId: true,
          productId: true,
          invoiceId: true,
          assignedToUserId: true,
          invoice: { select: { requestId: true } },
        },
      });

      if (!unit) return { kind: "not_found" as const };
      if (unit.tenantId !== tenantId) return { kind: "forbidden" as const };

      if (unit.status === "IN_REPAIR") return { kind: "already" as const };
      if (unit.status === "SCRAPPED" || unit.status === "LOST") {
        return { kind: "invalid_state" as const, status: unit.status };
      }

      // If it was in stock, it must leave available stock now.
      const shouldDecrement = unit.status === "IN_STOCK";

      await txAny.productUnit.update({
        where: { id: unit.id },
        data: {
          status: "IN_REPAIR",
          assignedToUserId: null,
        },
        select: { id: true },
      });

      await txAny.stockMovement.create({
        data: {
          type: "REPAIR_OUT",
          quantity: BigInt(1) as any,
          tenantId,
          productId: unit.productId,
          unitId: unit.id,
          invoiceId: unit.invoiceId,
          requestId: unit.invoice?.requestId ?? null,
          performedByUserId,
          assignedToUserId: unit.assignedToUserId ?? null,
          reason: reason ?? null,
          costCenter: costCenter ?? null,
          notes: notes ?? null,
        },
        select: { id: true },
      });

      if (shouldDecrement) {
        const product = await tx.product.update({
          where: { id: unit.productId },
          data: { quantity: { decrement: BigInt(1) as any } },
          select: { id: true, quantity: true },
        });

        const finalQuantity = Number(product.quantity);
        const finalStatus = computeProductStatus(finalQuantity);

        await tx.product.update({
          where: { id: unit.productId },
          data: { status: finalStatus },
        });

        return {
          kind: "ok" as const,
          unit: { id: unit.id, code, status: "IN_REPAIR" as const },
          product: { id: unit.productId, quantity: finalQuantity, status: finalStatus },
        };
      }

      const product = await tx.product.findUnique({
        where: { id: unit.productId },
        select: { id: true, quantity: true, status: true },
      });

      return {
        kind: "ok" as const,
        unit: { id: unit.id, code, status: "IN_REPAIR" as const },
        product: product
          ? { id: product.id, quantity: Number(product.quantity), status: product.status }
          : { id: unit.productId, quantity: 0, status: "" },
      };
    });

    if (result.kind === "not_found") return res.status(404).json({ error: "Unit not found" });
    if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
    if (result.kind === "already") return res.status(400).json({ error: "Unit already in repair" });
    if (result.kind === "invalid_state") {
      return res.status(400).json({ error: "Unit state does not allow repair-out" });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/units/repair-out error:", error);
    return res.status(500).json({ error: "Failed to send unit to repair" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
