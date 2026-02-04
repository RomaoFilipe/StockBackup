import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const bodySchema = z.object({
  code: z.string().uuid(),
  asUserId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(200).optional().nullable(),
  costCenter: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

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

  const requestingUserId = session.id;
  const { code, asUserId, assignedToUserId, reason, costCenter, notes } = parsed.data;

  const tenantUserId = asUserId && session.role === "ADMIN" ? asUserId : requestingUserId;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const unit = await txAny.productUnit.findFirst({
        where: { code },
        select: {
          id: true,
          status: true,
          productId: true,
          userId: true,
          invoiceId: true,
          invoice: {
            select: {
              requestId: true,
            },
          },
        },
      });

      if (!unit) {
        return { kind: "not_found" as const };
      }

      // Ensure the code belongs to the same tenant/user inventory
      if (unit.userId !== tenantUserId) {
        return { kind: "forbidden" as const };
      }

      if (unit.status === "ACQUIRED") {
        return { kind: "already" as const };
      }

      const unitUpdated = await txAny.productUnit.update({
        where: { id: unit.id },
        data: {
          status: "ACQUIRED",
          acquiredAt: new Date(),
          acquiredByUserId: requestingUserId,
          assignedToUserId: assignedToUserId ?? null,
          acquiredReason: reason ?? null,
          costCenter: costCenter ?? null,
          acquiredNotes: notes ?? null,
        },
        select: {
          id: true,
          code: true,
          status: true,
          productId: true,
          invoiceId: true,
          acquiredAt: true,
          acquiredByUserId: true,
          assignedToUserId: true,
          acquiredReason: true,
          costCenter: true,
          acquiredNotes: true,
        },
      });

      // Audit trail
      await txAny.stockMovement.create({
        data: {
          type: "OUT",
          quantity: BigInt(1) as any,
          userId: tenantUserId,
          productId: unit.productId,
          unitId: unit.id,
          invoiceId: unit.invoiceId,
          requestId: unit.invoice?.requestId ?? null,
          performedByUserId: requestingUserId,
          assignedToUserId: assignedToUserId ?? null,
          reason: reason ?? null,
          costCenter: costCenter ?? null,
          notes: notes ?? null,
        },
        select: { id: true },
      });

      // Decrement aggregate stock
      const product = await tx.product.update({
        where: { id: unit.productId },
        data: {
          quantity: { decrement: BigInt(1) as any },
        },
        select: { id: true, quantity: true },
      });

      const finalQuantity = Number(product.quantity);
      const finalStatus = finalQuantity > 20 ? "Available" : finalQuantity > 0 ? "Stock Low" : "Stock Out";

      await tx.product.update({
        where: { id: unit.productId },
        data: { status: finalStatus },
      });

      return {
        kind: "ok" as const,
        unit: {
          ...unitUpdated,
          acquiredAt: unitUpdated.acquiredAt ? unitUpdated.acquiredAt.toISOString() : null,
        },
        product: { id: unit.productId, quantity: finalQuantity, status: finalStatus },
      };
    });

    if (updated.kind === "not_found") return res.status(404).json({ error: "Unit not found" });
    if (updated.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
    if (updated.kind === "already") return res.status(400).json({ error: "Unit already acquired" });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("POST /api/units/acquire error:", error);
    return res.status(500).json({ error: "Failed to acquire unit" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
