import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { logUserAdminAction } from "@/utils/adminAudit";

const bodySchema = z.object({
  code: z.string().uuid(),
  action: z.enum(["REPAIR_OUT", "REPAIR_IN", "SCRAP", "LOST"]),
  reason: z.string().trim().max(200).optional().nullable(),
  costCenter: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const computeProductStatus = (quantity: number) =>
  quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";

function actionMeta(action: z.infer<typeof bodySchema>["action"]) {
  switch (action) {
    case "REPAIR_OUT":
      return { movementType: "REPAIR_OUT" as const, nextStatus: "IN_REPAIR" as const, label: "enviado para reparação" };
    case "REPAIR_IN":
      return { movementType: "REPAIR_IN" as const, nextStatus: "IN_STOCK" as const, label: "recebido da reparação" };
    case "SCRAP":
      return { movementType: "SCRAP" as const, nextStatus: "SCRAPPED" as const, label: "abatido" };
    case "LOST":
      return { movementType: "LOST" as const, nextStatus: "LOST" as const, label: "marcado como perdido" };
  }
}

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
  const { code, action, reason, costCenter, notes } = parsed.data;
  const meta = actionMeta(action);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const unit = await txAny.productUnit.findFirst({
        where: { tenantId, code },
        select: {
          id: true,
          code: true,
          status: true,
          productId: true,
          invoiceId: true,
          assignedToUserId: true,
          acquiredReason: true,
          costCenter: true,
          acquiredNotes: true,
        },
      });

      if (!unit) return { kind: "not_found" as const };

      if (action === "REPAIR_OUT" && unit.status !== "IN_STOCK" && unit.status !== "ACQUIRED") {
        return { kind: "invalid_state" as const, status: unit.status };
      }
      if (action === "REPAIR_IN" && unit.status !== "IN_REPAIR") {
        return { kind: "invalid_state" as const, status: unit.status };
      }
      if ((action === "SCRAP" || action === "LOST") && (unit.status === "SCRAPPED" || unit.status === "LOST")) {
        return { kind: "invalid_state" as const, status: unit.status };
      }

      let quantityDelta = 0;
      if (action === "REPAIR_OUT" && unit.status === "IN_STOCK") quantityDelta = -1;
      if (action === "REPAIR_IN") quantityDelta = 1;
      if ((action === "SCRAP" || action === "LOST") && unit.status === "IN_STOCK") quantityDelta = -1;

      const updatedUnit = await txAny.productUnit.update({
        where: { id: unit.id },
        data: {
          status: meta.nextStatus,
          acquiredReason: reason ?? unit.acquiredReason ?? null,
          costCenter: costCenter ?? unit.costCenter ?? null,
          acquiredNotes: notes ?? unit.acquiredNotes ?? null,
          ...(action === "REPAIR_IN" ? { acquiredAt: null, acquiredByUserId: null, assignedToUserId: null } : {}),
          ...(action === "SCRAP" || action === "LOST" ? { assignedToUserId: null } : {}),
        },
        select: { id: true, code: true, status: true },
      });

      await txAny.stockMovement.create({
        data: {
          type: meta.movementType,
          quantity: BigInt(1) as any,
          tenantId,
          productId: unit.productId,
          unitId: unit.id,
          invoiceId: unit.invoiceId,
          performedByUserId,
          assignedToUserId: unit.assignedToUserId ?? null,
          reason: reason ?? null,
          costCenter: costCenter ?? null,
          notes: notes ?? null,
        },
      });

      let productQuantity: number | null = null;
      if (quantityDelta !== 0) {
        const product = await tx.product.update({
          where: { id: unit.productId },
          data: { quantity: quantityDelta > 0 ? { increment: BigInt(quantityDelta) as any } : { decrement: BigInt(Math.abs(quantityDelta)) as any } },
          select: { id: true, quantity: true },
        });
        productQuantity = Number(product.quantity);
        await tx.product.update({
          where: { id: unit.productId },
          data: { status: computeProductStatus(productQuantity) },
        });
      }

      return {
        kind: "ok" as const,
        unit: updatedUnit,
        product: { id: unit.productId, quantity: productQuantity },
      };
    });

    if (result.kind === "not_found") return res.status(404).json({ error: "Unit not found" });
    if (result.kind === "invalid_state") {
      return res.status(400).json({ error: `Ação inválida para o estado atual (${result.status}).` });
    }

    await logUserAdminAction({
      tenantId,
      actorUserId: performedByUserId,
      action: `UNIT_${action}`,
      note: `Unidade ${code} ${meta.label}`,
      payload: { code, reason: reason ?? null, costCenter: costCenter ?? null, hasNotes: Boolean(notes) },
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/units/action error:", error);
    return res.status(500).json({ error: "Failed to execute unit action" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
