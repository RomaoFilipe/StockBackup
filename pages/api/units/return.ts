import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { logUserAdminAction } from "@/utils/adminAudit";
import { logInfo } from "@/utils/logger";

const bodySchema = z.object({
  code: z.string().uuid(),
  asUserId: z.string().uuid().optional(),
  reason: z.string().trim().max(200).optional().nullable(),
  costCenter: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const computeProductStatus = (quantity: number) =>
  quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";

function formatGtmiNumber(gtmiYear: number, gtmiSeq: number) {
  return `GTMI-${gtmiYear}-${String(gtmiSeq).padStart(6, "0")}`;
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
  const { code, reason, costCenter, notes } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const unit = await txAny.productUnit.findFirst({
        where: { code },
        select: {
          id: true,
          code: true,
          status: true,
          tenantId: true,
          productId: true,
          invoiceId: true,
          assignedToUserId: true,
          product: { select: { id: true, name: true, sku: true } },
          invoice: { select: { requestId: true } },
        },
      });

      if (!unit) return { kind: "not_found" as const };
      if (unit.tenantId !== tenantId) return { kind: "forbidden" as const };

      if (unit.status !== "ACQUIRED") {
        return { kind: "invalid_state" as const, status: unit.status };
      }

      const performedAt = new Date();
      const requestOwnerUserId = unit.assignedToUserId ?? performedByUserId;
      const requestOwner = await tx.user.findFirst({
        where: { id: requestOwnerUserId, tenantId },
        select: {
          id: true,
          name: true,
          requestingServiceId: true,
          requestingService: { select: { codigo: true, designacao: true } },
        },
      });

      if (!requestOwner) return { kind: "forbidden" as const };

      const gtmiYear = performedAt.getFullYear();
      const maxSeq = await tx.request.aggregate({
        where: { tenantId, gtmiYear },
        _max: { gtmiSeq: true },
      });
      const gtmiSeq = (maxSeq._max.gtmiSeq ?? 0) + 1;
      const gtmiNumber = formatGtmiNumber(gtmiYear, gtmiSeq);
      const reqServiceText = requestOwner.requestingService
        ? `${requestOwner.requestingService.codigo} — ${requestOwner.requestingService.designacao}`.slice(0, 120)
        : null;

      const linkedRequest = await tx.request.create({
        data: {
          tenantId,
          userId: requestOwner.id,
          createdByUserId: performedByUserId,
          status: "SUBMITTED",
          requestType: "RETURN",
          title: "Requisição de Devolução",
          notes: notes ?? null,
          gtmiYear,
          gtmiSeq,
          gtmiNumber,
          requestedAt: performedAt,
          priority: "NORMAL",
          requestingService: reqServiceText,
          requestingServiceId: requestOwner.requestingServiceId ?? null,
          requesterName: requestOwner.name,
          goodsTypes: ["MATERIALS_SERVICES"],
          supplierOption1: unit.product.name,
          items: {
            create: [
              {
                productId: unit.productId,
                quantity: BigInt(1) as any,
                notes: reason ?? null,
                unit: "un",
                reference: "Equipamento devolvido",
                destination: unit.code,
                role: "OLD",
              },
            ],
          },
        },
        select: { id: true, gtmiNumber: true },
      });

      await tx.requestStatusAudit.create({
        data: {
          tenantId,
          requestId: linkedRequest.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          changedByUserId: performedByUserId,
          source: "api/units/return:POST",
          note: `Criada automaticamente por devolução da unidade ${unit.code}`,
        },
      });

      const product = await tx.product.findUnique({
        where: { id: unit.productId },
        select: { id: true, quantity: true, status: true },
      });
      if (!product) return { kind: "not_found" as const };

      const finalQuantity = Number(product.quantity);
      const finalStatus = product.status ?? computeProductStatus(finalQuantity);

      return {
        kind: "ok" as const,
        unit: { id: unit.id, code, status: "ACQUIRED" as const },
        product: { id: unit.productId, quantity: finalQuantity, status: finalStatus },
        linkedRequest: { id: linkedRequest.id, gtmiNumber: linkedRequest.gtmiNumber },
      };
    });

    if (result.kind === "not_found") return res.status(404).json({ error: "Unit not found" });
    if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
    if (result.kind === "invalid_state") {
      return res.status(400).json({ error: "Unit is not acquired (cannot return)" });
    }

    await logUserAdminAction({
      tenantId: session.tenantId,
      actorUserId: session.id,
      action: "UNIT_RETURN_REQUEST_CREATED",
      note: `Return request created for unit: ${code}`,
      payload: {
        code,
        linkedRequestId: result.linkedRequest.id,
        linkedRequestGtmiNumber: result.linkedRequest.gtmiNumber,
        reason: reason ?? null,
        costCenter: costCenter ?? null,
        hasNotes: Boolean(notes),
      },
    });
    logInfo(
      "Return request created; stock pending signature",
      {
        tenantId: session.tenantId,
        userId: session.id,
        code,
        linkedRequestId: result.linkedRequest.id,
      },
      req
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/units/return error:", error);
    return res.status(500).json({ error: "Failed to return unit" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
