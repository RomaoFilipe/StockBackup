import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { createRequestStatusAudit, notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const executeSchema = z.object({
  idempotencyKey: z.string().min(8).max(120),
  documentRef: z.string().min(3).max(500),
  note: z.string().max(1000).optional().nullable(),
  receivedByName: z.string().min(2).max(120).optional().nullable(),
  receivedByTitle: z.string().max(120).optional().nullable(),
  lines: z
    .array(
      z.object({
        requestItemId: z.string().uuid(),
        unitCode: z.string().max(120).optional().nullable(),
      })
    )
    .optional(),
});

function computeProductStatus(quantity: number) {
  return quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";
}

async function generateMunicipalAssetCode(txAny: any, tenantId: string) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = String(Date.now()).slice(-6);
    const code = `AST-${year}-${suffix}${attempt ? `-${attempt}` : ""}`;
    const exists = await txAny.municipalAsset.findFirst({ where: { tenantId, code }, select: { id: true } });
    if (!exists) return code;
  }
  return `AST-${year}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const requestId = typeof req.query.id === "string" ? req.query.id : "";
  if (!requestId) return res.status(400).json({ error: "Invalid request id" });

  const tenantId = session.tenantId;
  const isAdmin = session.role === "ADMIN";

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId,
    role: session.role,
  });
  const canExecute =
    isAdmin ||
    hasPermission(grants, "requests.pickup_sign") ||
    hasPermission(grants, "requests.change_status") ||
    hasPermission(grants, "assets.move");

  if (!canExecute) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const request = await prisma.request.findFirst({
      where: { id: requestId, tenantId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!request) return res.status(404).json({ error: "Request not found" });

    const optionsByItemId: Record<string, Array<{ id: string; code: string; status: string; serialNumber: string | null }>> = {};

    for (const item of request.items) {
      const qty = Number(item.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        optionsByItemId[item.id] = [];
        continue;
      }

      const unitCount = await (prisma as any).productUnit.count({ where: { tenantId, productId: item.productId } });
      if (!unitCount) {
        optionsByItemId[item.id] = [];
        continue;
      }

      const candidates = await (prisma as any).productUnit.findMany({
        where: { tenantId, productId: item.productId, status: "IN_STOCK" },
        orderBy: [{ createdAt: "asc" }],
        take: 50,
        select: { id: true, code: true, status: true, serialNumber: true },
      });
      optionsByItemId[item.id] = candidates;
    }

    return res.status(200).json({
      request: {
        id: request.id,
        status: request.status,
        requestType: request.requestType,
        gtmiNumber: request.gtmiNumber,
        deliveryLocation: request.deliveryLocation,
        requesterName: request.requesterName,
        requestingServiceId: request.requestingServiceId,
      },
      optionsByItemId,
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = executeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });

  const payload = parsed.data;

  try {
    const existingExecution = await (prisma as any).requestExecution.findFirst({
      where: { tenantId, idempotencyKey: payload.idempotencyKey },
      include: { request: { select: { id: true, status: true, gtmiNumber: true } } },
    });

    if (existingExecution) {
      return res.status(200).json({
        ok: true,
        idempotent: true,
        executionId: existingExecution.id,
        request: existingExecution.request,
      });
    }

    const beforeRequest = await prisma.request.findFirst({
      where: { id: requestId, tenantId },
      select: {
        id: true,
        status: true,
        requestType: true,
        gtmiNumber: true,
        userId: true,
        requesterName: true,
        requestingServiceId: true,
        deliveryLocation: true,
      },
    });

    if (!beforeRequest) return res.status(404).json({ error: "Request not found" });
    if (beforeRequest.requestType !== "STANDARD") {
      return res.status(400).json({ error: "Warehouse execute flow currently supports STANDARD requests only" });
    }
    if (beforeRequest.status === "FULFILLED") {
      return res.status(409).json({ error: "Request already fulfilled" });
    }
    if (beforeRequest.status !== "APPROVED") {
      return res.status(400).json({ error: "Request must be APPROVED before warehouse execution" });
    }

    const lineMap = new Map((payload.lines || []).map((line) => [line.requestItemId, line]));

    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;

      const request: any = await txAny.request.findFirst({
        where: { id: requestId, tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, categoryId: true, isPatrimonializable: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!request) throw new Error("Request not found");

      let resolvedLocationId: string | null = null;
      const normalizedDeliveryLocation = request.deliveryLocation?.trim() || null;
      if (normalizedDeliveryLocation) {
        const location = await txAny.municipalAssetLocation.findFirst({
          where: { tenantId, name: normalizedDeliveryLocation },
          select: { id: true },
        });
        resolvedLocationId = location?.id ?? null;
      }

      for (const item of request.items) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const unitCount = Number(await txAny.productUnit.count({ where: { tenantId, productId: item.productId } }));
        const isUnitTracked = unitCount > 0;

        if (isUnitTracked) {
          if (qty !== 1) {
            throw new Error("Para produtos com unidades, cada linha deve ter quantidade 1");
          }

          const requestedCode =
            lineMap.get(item.id)?.unitCode?.trim() ||
            (typeof item.destination === "string" ? item.destination.trim() : "");

          const unit = requestedCode
            ? await txAny.productUnit.findFirst({
                where: {
                  tenantId,
                  productId: item.productId,
                  code: requestedCode,
                  status: "IN_STOCK",
                },
                select: { id: true, code: true, status: true, invoiceId: true, serialNumber: true, assetTag: true },
              })
            : await txAny.productUnit.findFirst({
                where: {
                  tenantId,
                  productId: item.productId,
                  status: "IN_STOCK",
                },
                orderBy: { createdAt: "asc" },
                select: { id: true, code: true, status: true, invoiceId: true, serialNumber: true, assetTag: true },
              });

          if (!unit) {
            throw new Error(`Sem unidade em stock para ${item.product.name}`);
          }

          const lockUpdate = await txAny.productUnit.updateMany({
            where: { id: unit.id, status: "IN_STOCK" },
            data: {
              status: "ACQUIRED",
              acquiredAt: new Date(),
              acquiredByUserId: session.id,
              assignedToUserId: request.userId,
              acquiredReason: `Entrega ${request.gtmiNumber}`,
            },
          });
          if (!lockUpdate.count) throw new Error(`Unidade ${unit.code} já não está disponível`);

          if (!item.destination || item.destination !== unit.code) {
            await tx.requestItem.update({ where: { id: item.id }, data: { destination: unit.code } });
          }

          await txAny.stockMovement.create({
            data: {
              type: "OUT",
              quantity: BigInt(1) as any,
              tenantId,
              productId: item.productId,
              unitId: unit.id,
              invoiceId: unit.invoiceId ?? null,
              requestId: request.id,
              performedByUserId: session.id,
              assignedToUserId: request.userId,
              reason: `Execução armazém ${request.gtmiNumber}`,
              notes: payload.documentRef,
            },
          });

          const productAfter = await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: BigInt(1) as any } },
            select: { quantity: true },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { status: computeProductStatus(Number(productAfter.quantity)) },
          });

          if (item.product.isPatrimonializable) {
            const mappedClass = item.product.categoryId
              ? await txAny.assetCategoryClassMap.findFirst({
                  where: { tenantId, categoryId: item.product.categoryId },
                  select: { classId: true },
                })
              : null;

            const existingAsset = await txAny.municipalAsset.findFirst({
              where: { tenantId, productUnitId: unit.id },
              select: {
                id: true,
                status: true,
                requestingServiceId: true,
                assignedToUserId: true,
                locationId: true,
              },
            });

            let assetId = existingAsset?.id as string | undefined;
            const nextStatus = "IN_SERVICE";

            if (!existingAsset) {
              const createdAsset = await txAny.municipalAsset.create({
                data: {
                  tenantId,
                  code: await generateMunicipalAssetCode(txAny, tenantId),
                  name: item.product.name,
                  category: null,
                  status: nextStatus,
                  location: normalizedDeliveryLocation,
                  locationId: resolvedLocationId,
                  notes: payload.note?.trim() || `Criado automaticamente por execução ${request.gtmiNumber}`,
                  serialNumber: unit.serialNumber ?? null,
                  assetTag: unit.assetTag ?? null,
                  requestingServiceId: request.requestingServiceId ?? null,
                  assignedToUserId: request.userId,
                  productId: item.productId,
                  productUnitId: unit.id,
                  classId: mappedClass?.classId ?? null,
                },
              });
              assetId = createdAsset.id;

              await txAny.municipalAssetEvent.create({
                data: {
                  tenantId,
                  assetId,
                  fromStatus: null,
                  toStatus: nextStatus,
                  note: `Criação automática via execução de armazém ${request.gtmiNumber}`,
                  actorUserId: session.id,
                },
              });
            } else {
              await txAny.municipalAsset.update({
                where: { id: existingAsset.id },
                data: {
                  status: nextStatus,
                  requestingServiceId: request.requestingServiceId ?? null,
                  assignedToUserId: request.userId,
                  location: normalizedDeliveryLocation,
                  locationId: resolvedLocationId,
                  productId: item.productId,
                  serialNumber: unit.serialNumber ?? null,
                  assetTag: unit.assetTag ?? null,
                },
              });

              if (existingAsset.status !== nextStatus) {
                await txAny.municipalAssetEvent.create({
                  data: {
                    tenantId,
                    assetId: existingAsset.id,
                    fromStatus: existingAsset.status,
                    toStatus: nextStatus,
                    note: `Mudança de estado via execução ${request.gtmiNumber}`,
                    actorUserId: session.id,
                  },
                });
              }
            }

            if (assetId) {
              await txAny.municipalAssetAssignment.create({
                data: {
                  tenantId,
                  assetId,
                  userId: request.userId,
                  requestingServiceId: request.requestingServiceId ?? null,
                  note: `Entrega ${request.gtmiNumber}`,
                },
              });

              await txAny.municipalAssetMovement.create({
                data: {
                  tenantId,
                  assetId,
                  type: existingAsset ? "TRANSFER" : "ASSIGN",
                  statusFrom: existingAsset?.status ?? null,
                  statusTo: nextStatus,
                  movementAt: new Date(),
                  reason: `Execução armazém ${request.gtmiNumber}`,
                  note: payload.note?.trim() || `Entrega de unidade ${unit.code}`,
                  documentRef: payload.documentRef,
                  actorUserId: session.id,
                  fromRequestingServiceId: existingAsset?.requestingServiceId ?? null,
                  toRequestingServiceId: request.requestingServiceId ?? null,
                  fromLocationId: existingAsset?.locationId ?? null,
                  toLocationId: resolvedLocationId,
                  fromCustodianUserId: existingAsset?.assignedToUserId ?? null,
                  toCustodianUserId: request.userId,
                },
              });
            }
          }
        } else {
          const product = await tx.product.findUnique({ where: { id: item.productId }, select: { quantity: true } });
          const currentQty = Number(product?.quantity ?? BigInt(0));
          if (currentQty < qty) {
            throw new Error(`Stock insuficiente para ${item.product.name}`);
          }

          await txAny.stockMovement.create({
            data: {
              type: "OUT",
              quantity: BigInt(qty) as any,
              tenantId,
              productId: item.productId,
              requestId: request.id,
              performedByUserId: session.id,
              assignedToUserId: request.userId,
              reason: `Execução armazém ${request.gtmiNumber}`,
              notes: payload.documentRef,
            },
          });

          const productAfter = await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: BigInt(qty) as any } },
            select: { quantity: true },
          });
          await tx.product.update({
            where: { id: item.productId },
            data: { status: computeProductStatus(Number(productAfter.quantity)) },
          });
        }
      }

      const finalizedStatus = "FULFILLED";
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: finalizedStatus,
          pickupSignedAt: new Date(),
          pickupSignedByName: payload.receivedByName?.trim() || request.requesterName || request.user?.name || "Receção confirmada",
          pickupSignedByTitle: payload.receivedByTitle?.trim() || null,
          pickupSignatureDataUrl: null,
          pickupRecordedByUserId: session.id,
          pickupSignedIp: null,
          pickupSignedUserAgent: null,
          pickupVoidedAt: null,
          pickupVoidedReason: null,
          pickupVoidedByUserId: null,
        },
      });

      const execution = await txAny.requestExecution.create({
        data: {
          tenantId,
          requestId: request.id,
          idempotencyKey: payload.idempotencyKey,
          notes: payload.note?.trim() || null,
          documentRef: payload.documentRef,
          executedByUserId: session.id,
        },
      });

      return { request, executionId: execution.id };
    });

    await createRequestStatusAudit({
      tenantId,
      requestId,
      fromStatus: beforeRequest.status,
      toStatus: "FULFILLED",
      changedByUserId: session.id,
      source: "api/requests/[id]/execute:POST",
      note: payload.note?.trim() || `Execução de armazém (${payload.documentRef})`,
    });

    await notifyAdmin({
      tenantId,
      kind: "REQUEST_STATUS_CHANGED",
      title: `Requisição executada: ${beforeRequest.gtmiNumber}`,
      message: `Armazém executou e concluiu a requisição (${payload.documentRef}).`,
      requestId,
      data: { requestId, gtmiNumber: beforeRequest.gtmiNumber, documentRef: payload.documentRef },
    });

    if (beforeRequest.userId) {
      await notifyUser({
        tenantId,
        recipientUserId: beforeRequest.userId,
        kind: "REQUEST_STATUS_CHANGED",
        title: `Pedido concluído: ${beforeRequest.gtmiNumber}`,
        message: `Entrega concluída e registada (${payload.documentRef}).`,
        requestId,
        data: { requestId, gtmiNumber: beforeRequest.gtmiNumber, documentRef: payload.documentRef },
      });
    }

    publishRealtimeEvent({
      type: "request.status_changed",
      tenantId,
      audience: "ALL",
      userId: beforeRequest.userId,
      payload: {
        requestId,
        gtmiNumber: beforeRequest.gtmiNumber,
        fromStatus: beforeRequest.status,
        toStatus: "FULFILLED",
        at: new Date().toISOString(),
      },
    });

    return res.status(200).json({
      ok: true,
      idempotent: false,
      executionId: result.executionId,
      request: {
        id: beforeRequest.id,
        status: "FULFILLED",
        gtmiNumber: beforeRequest.gtmiNumber,
      },
    });
  } catch (error: any) {
    if (typeof error?.message === "string") {
      return res.status(400).json({ error: error.message });
    }
    console.error("POST /api/requests/[id]/execute error:", error);
    return res.status(500).json({ error: "Failed to execute request" });
  }
}
