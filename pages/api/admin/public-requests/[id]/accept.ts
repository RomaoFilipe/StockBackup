import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";
import { createRequestStatusAudit, notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";

const bodySchema = z.object({
  note: z.string().max(500).optional(),
});

class StockAllocationError extends Error {
  code: string;
  details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function computeProductStatus(quantity: number) {
  return quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";
}

function formatGtmiNumber(gtmiYear: number, gtmiSeq: number) {
  return `GTMI-${gtmiYear}-${String(gtmiSeq).padStart(6, "0")}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "id is required" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const publicReq = await prisma.publicRequest.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      requestingService: { select: { id: true, codigo: true, designacao: true } },
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!publicReq) return res.status(404).json({ error: "Not found" });
  if (publicReq.status !== "RECEIVED") return res.status(400).json({ error: "Request already handled" });

  const requestedAt = publicReq.createdAt;
  const tenantId = session.tenantId;
  const adminUserId = session.id;
  let requestOwnerUserId: string = publicReq.requesterUserId ?? adminUserId;

  // Backward compatibility for older public requests created before requesterUserId existed.
  if (!publicReq.requesterUserId) {
    const byName = await prisma.user.findMany({
      where: {
        tenantId,
        role: "USER",
        name: publicReq.requesterName,
      },
      select: { id: true },
      take: 2,
    });

    if (byName.length === 1) {
      requestOwnerUserId = byName[0].id;
    } else if (publicReq.requesterName?.includes("@")) {
      const byEmail = await prisma.user.findMany({
        where: {
          tenantId,
          role: "USER",
          email: publicReq.requesterName,
        },
        select: { id: true },
        take: 2,
      });
      if (byEmail.length === 1) {
        requestOwnerUserId = byEmail[0].id;
      }
    } else {
      const byService = await prisma.user.findMany({
        where: {
          tenantId,
          role: "USER",
          requestingServiceId: publicReq.requestingServiceId,
          isActive: true,
        },
        select: { id: true },
        take: 2,
      });
      if (byService.length === 1) {
        requestOwnerUserId = byService[0].id;
      }
    }
  }

  const gtmiYear = requestedAt.getFullYear();

  try {
    const createdRequest = await prisma.$transaction(async (tx) => {
      const maxSeq = await tx.request.aggregate({
        where: { tenantId, gtmiYear },
        _max: { gtmiSeq: true },
      });

      const nextSeq = (maxSeq._max.gtmiSeq ?? 0) + 1;
      const gtmiNumber = formatGtmiNumber(gtmiYear, nextSeq);

      const created = await tx.request.create({
        data: {
          tenantId,
          userId: requestOwnerUserId,
          createdByUserId: adminUserId,
          status: "SUBMITTED",
          title: publicReq.title,
          notes: publicReq.notes,
          gtmiYear,
          gtmiSeq: nextSeq,
          gtmiNumber,
          requestedAt,
          requestingServiceId: publicReq.requestingServiceId,
          requestingService: publicReq.requestingService?.designacao ?? null,
          requesterName: publicReq.requesterName,
          deliveryLocation: (publicReq as any).deliveryLocation ?? null,
          ...(publicReq.items.length
            ? {
                items: {
                  create: publicReq.items.map((i) => ({
                    productId: i.productId,
                    quantity: i.quantity as any,
                    notes: i.notes,
                    unit: i.unit,
                  })),
                },
              }
            : {}),
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });

      // Allocate stock similarly to /api/requests create logic
      const stockReason = `Requisição ${gtmiNumber}`;
      const unitCountByProductId = new Map<string, number>();

      const txAny = tx as any;

      for (const item of created.items as any[]) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const productId: string = item.productId;

        let unitCount = unitCountByProductId.get(productId);
        if (unitCount === undefined) {
          unitCount = Number(
            await txAny.productUnit.count({
              where: { tenantId, productId },
            })
          );
          unitCountByProductId.set(productId, unitCount);
        }

        const isUnitTracked = unitCount > 0;

        if (isUnitTracked) {
          if (qty !== 1) {
            throw new StockAllocationError(
              "UNIT_QTY_MUST_BE_1",
              "Para produtos com QR (unidades), use Qtd=1 por linha.",
              { productId, quantity: qty }
            );
          }

          const unit = await txAny.productUnit.findFirst({
            where: { tenantId, productId, status: "IN_STOCK" },
            orderBy: { createdAt: "asc" },
            select: { id: true, code: true, invoiceId: true },
          });

          if (!unit) {
            throw new StockAllocationError(
              "NO_UNIT_IN_STOCK",
              "Sem unidades em stock para um dos produtos selecionados.",
              { productId }
            );
          }

          const updated = await txAny.productUnit.updateMany({
            where: { id: unit.id, status: "IN_STOCK" },
            data: {
              status: "ACQUIRED",
              acquiredAt: new Date(),
              acquiredByUserId: adminUserId,
              assignedToUserId: requestOwnerUserId,
              acquiredReason: stockReason,
            },
          });

          if (!updated?.count) {
            throw new StockAllocationError(
              "UNIT_RACE_CONDITION",
              "A unidade foi alocada por outro utilizador. Tente novamente.",
              { productId, code: unit.code }
            );
          }

          await txAny.stockMovement.create({
            data: {
              type: "OUT",
              quantity: BigInt(1) as any,
              tenantId,
              productId,
              unitId: unit.id,
              invoiceId: unit.invoiceId ?? null,
              requestId: created.id,
              performedByUserId: adminUserId,
              assignedToUserId: requestOwnerUserId,
              reason: stockReason,
            },
            select: { id: true },
          });

          const productAfter = await tx.product.update({
            where: { id: productId },
            data: { quantity: { decrement: BigInt(1) as any } },
            select: { quantity: true },
          });
          const finalQuantity = Number(productAfter.quantity);
          await tx.product.update({
            where: { id: productId },
            data: { status: computeProductStatus(finalQuantity) },
          });
        } else {
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { quantity: true },
          });
          const currentQty = Number(product?.quantity ?? BigInt(0));
          if (currentQty < qty) {
            throw new StockAllocationError(
              "INSUFFICIENT_STOCK",
              "Stock insuficiente para um dos produtos selecionados.",
              { productId, requested: qty, available: currentQty }
            );
          }

          await txAny.stockMovement.create({
            data: {
              type: "OUT",
              quantity: BigInt(qty) as any,
              tenantId,
              productId,
              requestId: created.id,
              performedByUserId: adminUserId,
              assignedToUserId: requestOwnerUserId,
              reason: stockReason,
            },
            select: { id: true },
          });

          const productAfter = await tx.product.update({
            where: { id: productId },
            data: { quantity: { decrement: BigInt(qty) as any } },
            select: { quantity: true },
          });
          const finalQuantity = Number(productAfter.quantity);
          await tx.product.update({
            where: { id: productId },
            data: { status: computeProductStatus(finalQuantity) },
          });
        }
      }

      return created;
    });

    await prisma.publicRequest.update({
      where: { id: publicReq.id },
      data: {
        status: "ACCEPTED",
        handledAt: new Date(),
        handledByUserId: session.id,
        handledNote: parsed.data.note?.trim() || null,
        acceptedRequestId: createdRequest.id,
      },
    });

    try {
      await createRequestStatusAudit({
        tenantId,
        requestId: createdRequest.id,
        fromStatus: null,
        toStatus: "SUBMITTED",
        changedByUserId: session.id,
        source: "api/admin/public-requests/[id]/accept",
      });

      await notifyAdmin({
        tenantId,
        kind: "PUBLIC_REQUEST_ACCEPTED",
        title: "Pedido recebido aceite",
        message: `Foi criada a requisição ${createdRequest.gtmiNumber}.`,
        requestId: createdRequest.id,
        data: {
          publicRequestId: publicReq.id,
          requestId: createdRequest.id,
          gtmiNumber: createdRequest.gtmiNumber,
        },
      });

      if (requestOwnerUserId) {
        await notifyUser({
          tenantId,
          recipientUserId: requestOwnerUserId,
          kind: "PUBLIC_REQUEST_ACCEPTED",
          title: `Pedido aceite: ${createdRequest.gtmiNumber}`,
          message: "O teu pedido foi aceite e convertido em requisição.",
          requestId: createdRequest.id,
          data: {
            publicRequestId: publicReq.id,
            requestId: createdRequest.id,
            gtmiNumber: createdRequest.gtmiNumber,
          },
        });
      }

      publishRealtimeEvent({
        type: "public-request.accepted",
        tenantId,
        audience: "ALL",
        userId: requestOwnerUserId ?? null,
        payload: {
          publicRequestId: publicReq.id,
          requestId: createdRequest.id,
          gtmiNumber: createdRequest.gtmiNumber,
          at: new Date().toISOString(),
        },
      });
    } catch (notifyError) {
      console.error("POST /api/admin/public-requests/[id]/accept notify/audit error:", notifyError);
    }

    return res.status(200).json({ ok: true, requestId: createdRequest.id });
  } catch (error: any) {
    const code = error?.code;
    const msg = error?.message || "Não foi possível aceitar o pedido.";

    return res.status(400).json({
      error: msg,
      code: typeof code === "string" ? code : undefined,
      details: error?.details,
    });
  }
}
