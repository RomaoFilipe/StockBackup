import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { logUserAdminAction } from "@/utils/adminAudit";
import { logInfo, logWarn } from "@/utils/logger";
import { ensureRequestWorkflowDefinition, ensureRequestWorkflowInstance, transitionRequestWorkflowByActionTx } from "@/utils/workflow";

const bodySchema = z.object({
  oldCode: z.string().uuid(),
  newCode: z.string().uuid(),
  oldDisposition: z.enum(["RETURN", "REPAIR", "SCRAP", "LOST"]).default("RETURN"),
  returnReasonCode: z.enum(["AVARIA", "FIM_USO", "TROCA", "EXTRAVIO", "OUTRO"]).default("OUTRO"),
  returnReasonDetail: z.string().trim().max(240).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  reason: z.string().trim().max(200).optional().nullable(),
  costCenter: z.string().trim().max(200).optional().nullable(),
  ticketNumber: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  compatibilityOverrideReason: z.string().trim().max(300).optional().nullable(),
});

const computeProductStatus = (quantity: number) =>
  quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";

function formatGtmiNumber(gtmiYear: number, gtmiSeq: number) {
  return `GTMI-${gtmiYear}-${String(gtmiSeq).padStart(6, "0")}`;
}

function composeNotes(baseNotes: string | null, substitutionId: string, oldCode: string, newCode: string, ticket: string | null) {
  const parts = [
    baseNotes?.trim() || null,
    `SUB:${substitutionId}`,
    `OLD:${oldCode}`,
    `NEW:${newCode}`,
    ticket ? `TICKET:${ticket}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

function buildReasonText(
  code: "AVARIA" | "FIM_USO" | "TROCA" | "EXTRAVIO" | "OUTRO",
  detail?: string | null,
  fallback?: string | null
) {
  const label: Record<typeof code, string> = {
    AVARIA: "Avaria",
    FIM_USO: "Fim de uso",
    TROCA: "Troca",
    EXTRAVIO: "Extravio",
    OUTRO: "Outro",
  };
  const base = label[code];
  const d = (detail ?? "").trim();
  if (d) return `${base}: ${d}`;
  const f = (fallback ?? "").trim();
  return f ? `${base}: ${f}` : base;
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

  const {
    oldCode,
    newCode,
    oldDisposition,
    returnReasonCode,
    returnReasonDetail,
    assignedToUserId,
    reason,
    costCenter,
    ticketNumber,
    notes,
    compatibilityOverrideReason,
  } = parsed.data;
  if (oldCode === newCode) {
    return res.status(400).json({ error: "Old and new codes must be different" });
  }

  if (returnReasonCode === "OUTRO" && !returnReasonDetail?.trim()) {
    return res.status(400).json({ error: "returnReasonDetail is required when returnReasonCode=OUTRO" });
  }
  if (returnReasonCode === "AVARIA" && oldDisposition !== "REPAIR" && oldDisposition !== "SCRAP") {
    return res.status(400).json({ error: "Avaria requires oldDisposition=REPAIR or SCRAP" });
  }
  if (returnReasonCode === "EXTRAVIO" && oldDisposition !== "LOST") {
    return res.status(400).json({ error: "Extravio requires oldDisposition=LOST" });
  }
  if ((returnReasonCode === "FIM_USO" || returnReasonCode === "TROCA") && oldDisposition !== "RETURN") {
    return res.status(400).json({ error: "FIM_USO/TROCA require oldDisposition=RETURN" });
  }

  if ((oldDisposition === "SCRAP" || oldDisposition === "LOST") && session.role !== "ADMIN") {
    logWarn(
      "Unit substitution denied: non-admin requested restricted disposition",
      { tenantId: session.tenantId, userId: session.id, oldCode, newCode, oldDisposition },
      req
    );
    await logUserAdminAction({
      tenantId: session.tenantId,
      actorUserId: session.id,
      action: "UNIT_SUBSTITUTE_DENIED_NON_ADMIN_RESTRICTED_DISPOSITION",
      note: `Non-admin attempted substitution with oldDisposition=${oldDisposition}`,
      payload: { oldCode, newCode, oldDisposition },
    });
    return res.status(403).json({ error: "Forbidden: admin only for SCRAP/LOST substitution" });
  }

  await ensureRequestWorkflowDefinition(prisma, session.tenantId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      const oldUnit = await txAny.productUnit.findFirst({
        where: { code: oldCode },
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

      const newUnit = await txAny.productUnit.findFirst({
        where: { code: newCode },
        select: {
          id: true,
          code: true,
          status: true,
          tenantId: true,
          productId: true,
          invoiceId: true,
          product: { select: { id: true, name: true, sku: true } },
          invoice: { select: { requestId: true } },
        },
      });

      if (!oldUnit || !newUnit) {
        return { kind: "not_found" as const };
      }
      if (oldUnit.tenantId !== session.tenantId || newUnit.tenantId !== session.tenantId) {
        return { kind: "forbidden" as const };
      }
      if (oldUnit.id === newUnit.id) {
        return { kind: "same_unit" as const };
      }

      if (oldUnit.status !== "ACQUIRED" && oldUnit.status !== "IN_REPAIR") {
        return { kind: "invalid_old_state" as const, status: oldUnit.status };
      }
      if (oldDisposition === "REPAIR" && oldUnit.status === "IN_REPAIR") {
        return { kind: "invalid_old_state_for_disposition" as const, status: oldUnit.status, oldDisposition };
      }
      if (newUnit.status !== "IN_STOCK") {
        return { kind: "invalid_new_state" as const, status: newUnit.status };
      }
      if (oldUnit.productId !== newUnit.productId && !compatibilityOverrideReason?.trim()) {
        return { kind: "sku_mismatch_requires_reason" as const };
      }

      const substitutionId = crypto.randomUUID();
      const performedAt = new Date();
      const effectiveAssignedTo = assignedToUserId ?? oldUnit.assignedToUserId ?? null;
      const requestOwnerUserId = effectiveAssignedTo ?? oldUnit.assignedToUserId ?? session.id;

      const requestOwner = await tx.user.findFirst({
        where: { id: requestOwnerUserId, tenantId: session.tenantId },
        select: { id: true, name: true, requestingServiceId: true, requestingService: { select: { codigo: true, designacao: true } } },
      });
      if (!requestOwner) return { kind: "forbidden" as const };

      const gtmiYear = performedAt.getFullYear();
      const maxSeq = await tx.request.aggregate({
        where: { tenantId: session.tenantId, gtmiYear },
        _max: { gtmiSeq: true },
      });
      const gtmiSeq = (maxSeq._max.gtmiSeq ?? 0) + 1;
      const gtmiNumber = formatGtmiNumber(gtmiYear, gtmiSeq);
      const reqServiceText = requestOwner.requestingService
        ? `${requestOwner.requestingService.codigo} — ${requestOwner.requestingService.designacao}`.slice(0, 120)
        : null;

      const linkedRequest = await tx.request.create({
        data: {
          tenantId: session.tenantId,
          userId: requestOwner.id,
          createdByUserId: session.id,
          status: "DRAFT",
          requestType: "RETURN",
          title: "Requisição de Devolução / Substituição",
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
          supplierOption1: oldUnit.product.name,
          supplierOption2: newUnit.product.name,
          items: {
            create: [
              {
                productId: oldUnit.productId,
                quantity: BigInt(1) as any,
                notes: buildReasonText(returnReasonCode, returnReasonDetail ?? null, reason ?? null),
                unit: "un",
                reference:
                  oldDisposition === "RETURN"
                    ? "Equipamento antigo (devolução)"
                    : oldDisposition === "REPAIR"
                      ? "Equipamento antigo (reparação)"
                      : oldDisposition === "SCRAP"
                        ? "Equipamento antigo (abate)"
                        : "Equipamento antigo (extravio)",
                destination: oldUnit.code,
                role: "OLD",
              },
              {
                productId: newUnit.productId,
                quantity: BigInt(1) as any,
                notes: buildReasonText(returnReasonCode, returnReasonDetail ?? null, reason ?? null),
                unit: "un",
                reference: "Equipamento novo (substituição)",
                destination: newUnit.code,
                role: "NEW",
              },
            ],
          },
        },
        select: { id: true, gtmiNumber: true },
      });

      await ensureRequestWorkflowInstance(tx, { tenantId: session.tenantId, requestId: linkedRequest.id });
      await transitionRequestWorkflowByActionTx(tx, {
        tenantId: session.tenantId,
        requestId: linkedRequest.id,
        action: "SUBMIT",
        actorUserId: session.id,
        note: "auto-submit (unit substitute)",
      });

      await tx.requestStatusAudit.create({
        data: {
          tenantId: session.tenantId,
          requestId: linkedRequest.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          changedByUserId: session.id,
          source: "api/units/substitute:POST",
          note: `Criada automaticamente por substituição ${substitutionId}`,
        },
      });

      const movementNotes = composeNotes(notes ?? null, substitutionId, oldUnit.code, newUnit.code, ticketNumber ?? null);
      const fullMovementNotes =
        oldUnit.productId !== newUnit.productId
          ? `${movementNotes}${movementNotes ? " | " : ""}SKU_OVERRIDE:${compatibilityOverrideReason?.trim() || ""}`
          : movementNotes;
      const reasonText = buildReasonText(returnReasonCode, returnReasonDetail ?? null, reason ?? null);
      const touchedProducts = new Set<string>();

      if (oldDisposition === "RETURN") {
        await txAny.productUnit.update({
          where: { id: oldUnit.id },
          data: { status: "IN_STOCK", assignedToUserId: null },
          select: { id: true },
        });

        await txAny.stockMovement.create({
          data: {
            type: "RETURN",
            quantity: BigInt(1) as any,
            tenantId: session.tenantId,
            productId: oldUnit.productId,
            unitId: oldUnit.id,
            invoiceId: oldUnit.invoiceId,
            requestId: linkedRequest.id,
            performedByUserId: session.id,
            assignedToUserId: oldUnit.assignedToUserId ?? null,
            reason: reasonText,
            costCenter: costCenter ?? null,
            notes: fullMovementNotes,
          },
          select: { id: true },
        });

        await tx.product.update({
          where: { id: oldUnit.productId },
          data: { quantity: { increment: BigInt(1) as any } },
          select: { id: true },
        });

        touchedProducts.add(oldUnit.productId);
      } else if (oldDisposition === "REPAIR") {
        await txAny.productUnit.update({
          where: { id: oldUnit.id },
          data: { status: "IN_REPAIR", assignedToUserId: null },
          select: { id: true },
        });

        await txAny.stockMovement.create({
          data: {
            type: "REPAIR_OUT",
            quantity: BigInt(1) as any,
            tenantId: session.tenantId,
            productId: oldUnit.productId,
            unitId: oldUnit.id,
            invoiceId: oldUnit.invoiceId,
            requestId: linkedRequest.id,
            performedByUserId: session.id,
            assignedToUserId: oldUnit.assignedToUserId ?? null,
            reason: reasonText,
            costCenter: costCenter ?? null,
            notes: fullMovementNotes,
          },
          select: { id: true },
        });
      } else if (oldDisposition === "SCRAP") {
        await txAny.productUnit.update({
          where: { id: oldUnit.id },
          data: { status: "SCRAPPED", assignedToUserId: null },
          select: { id: true },
        });

        await txAny.stockMovement.create({
          data: {
            type: "SCRAP",
            quantity: BigInt(1) as any,
            tenantId: session.tenantId,
            productId: oldUnit.productId,
            unitId: oldUnit.id,
            invoiceId: oldUnit.invoiceId,
            requestId: linkedRequest.id,
            performedByUserId: session.id,
            assignedToUserId: oldUnit.assignedToUserId ?? null,
            reason: reasonText,
            costCenter: costCenter ?? null,
            notes: fullMovementNotes,
          },
          select: { id: true },
        });
      } else {
        await txAny.productUnit.update({
          where: { id: oldUnit.id },
          data: { status: "LOST", assignedToUserId: null },
          select: { id: true },
        });

        await txAny.stockMovement.create({
          data: {
            type: "LOST",
            quantity: BigInt(1) as any,
            tenantId: session.tenantId,
            productId: oldUnit.productId,
            unitId: oldUnit.id,
            invoiceId: oldUnit.invoiceId,
            requestId: linkedRequest.id,
            performedByUserId: session.id,
            assignedToUserId: oldUnit.assignedToUserId ?? null,
            reason: reasonText,
            costCenter: costCenter ?? null,
            notes: fullMovementNotes,
          },
          select: { id: true },
        });
      }

      await txAny.productUnit.update({
        where: { id: newUnit.id },
        data: {
          status: "ACQUIRED",
          acquiredAt: performedAt,
          acquiredByUserId: session.id,
          assignedToUserId: effectiveAssignedTo,
          acquiredReason: reasonText,
          costCenter: costCenter ?? null,
          acquiredNotes: fullMovementNotes,
        },
        select: { id: true },
      });

      await txAny.stockMovement.create({
        data: {
          type: "OUT",
          quantity: BigInt(1) as any,
          tenantId: session.tenantId,
          productId: newUnit.productId,
          unitId: newUnit.id,
          invoiceId: newUnit.invoiceId,
          requestId: linkedRequest.id,
          performedByUserId: session.id,
          assignedToUserId: effectiveAssignedTo,
          reason: reasonText,
          costCenter: costCenter ?? null,
          notes: fullMovementNotes,
        },
        select: { id: true },
      });

      await tx.product.update({
        where: { id: newUnit.productId },
        data: { quantity: { decrement: BigInt(1) as any } },
        select: { id: true },
      });
      touchedProducts.add(newUnit.productId);

      for (const productId of touchedProducts) {
        const p = await tx.product.findUnique({ where: { id: productId }, select: { quantity: true } });
        if (!p) continue;
        await tx.product.update({
          where: { id: productId },
          data: { status: computeProductStatus(Number(p.quantity)) },
          select: { id: true },
        });
      }

      return {
        kind: "ok" as const,
        substitutionId,
        oldUnit: {
          id: oldUnit.id,
          code: oldUnit.code,
          statusAfter:
            oldDisposition === "RETURN"
              ? "IN_STOCK"
              : oldDisposition === "REPAIR"
                ? "IN_REPAIR"
                : oldDisposition === "SCRAP"
                  ? "SCRAPPED"
                  : "LOST",
          product: oldUnit.product,
        },
        newUnit: {
          id: newUnit.id,
          code: newUnit.code,
          statusAfter: "ACQUIRED" as const,
          product: newUnit.product,
        },
        meta: {
          reason: reasonText,
          reasonCode: returnReasonCode,
          reasonDetail: returnReasonDetail ?? null,
          costCenter: costCenter ?? null,
          ticketNumber: ticketNumber ?? null,
          notes: notes ?? null,
          compatibilityOverrideReason: oldUnit.productId !== newUnit.productId ? compatibilityOverrideReason ?? null : null,
          performedAt: performedAt.toISOString(),
        },
        linkedRequest: {
          id: linkedRequest.id,
          gtmiNumber: linkedRequest.gtmiNumber,
          ownerUserId: requestOwner.id,
          ownerName: requestOwner.name,
        },
      };
    });

    if (result.kind === "not_found") return res.status(404).json({ error: "Unit not found" });
    if (result.kind === "forbidden") return res.status(403).json({ error: "Forbidden" });
    if (result.kind === "same_unit") return res.status(400).json({ error: "Old and new units must be different" });
    if (result.kind === "invalid_old_state") {
      return res.status(400).json({ error: `Old unit state does not allow substitution (${result.status})` });
    }
    if (result.kind === "invalid_old_state_for_disposition") {
      return res.status(400).json({ error: `Old unit state ${result.status} does not allow oldDisposition=${result.oldDisposition}` });
    }
    if (result.kind === "invalid_new_state") {
      return res.status(400).json({ error: `New unit must be IN_STOCK (${result.status})` });
    }
    if (result.kind === "sku_mismatch_requires_reason") {
      return res.status(400).json({ error: "Old/new SKU mismatch requires compatibilityOverrideReason" });
    }

    await logUserAdminAction({
      tenantId: session.tenantId,
      actorUserId: session.id,
      action: "UNIT_SUBSTITUTE",
      note: `Unit substitution ${result.substitutionId}: ${result.oldUnit.code} -> ${result.newUnit.code}`,
      payload: {
        substitutionId: result.substitutionId,
        oldCode: result.oldUnit.code,
        newCode: result.newUnit.code,
        linkedRequestId: result.linkedRequest.id,
        linkedRequestGtmiNumber: result.linkedRequest.gtmiNumber,
        linkedRequestOwnerUserId: result.linkedRequest.ownerUserId,
        oldDisposition,
        returnReasonCode,
        returnReasonDetail: returnReasonDetail ?? null,
        assignedToUserId: assignedToUserId ?? null,
        reason: result.meta.reason ?? null,
        costCenter: costCenter ?? null,
        ticketNumber: ticketNumber ?? null,
        hasNotes: Boolean(notes),
        compatibilityOverrideReason: compatibilityOverrideReason ?? null,
      },
    });

    logInfo(
      "Unit substitution success",
      {
        tenantId: session.tenantId,
        userId: session.id,
        substitutionId: result.substitutionId,
        oldCode: result.oldUnit.code,
        newCode: result.newUnit.code,
        oldDisposition,
      },
      req
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("POST /api/units/substitute error:", error);
    return res.status(500).json({ error: "Failed to substitute units" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
