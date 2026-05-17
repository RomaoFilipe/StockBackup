import { getReservedUnitCodes, mergeExcludedUnitCodes } from "@/utils/unitReservations";

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

export type FulfillStandardRequestArgs = {
  tx: any;
  tenantId: string;
  requestId: string;
  actorUserId: string;
  lineUnitCodes?: Map<string, string>;
  reasonPrefix?: string;
  note?: string | null;
  documentRef?: string | null;
  markFulfilled?: boolean;
  pickup?: {
    name: string;
    title?: string | null;
    signatureDataUrl?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  };
};

export async function fulfillStandardRequestStock(args: FulfillStandardRequestArgs) {
  const tx = args.tx;
  const txAny = tx as any;

  const request = await txAny.request.findFirst({
    where: { id: args.requestId, tenantId: args.tenantId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          reservedUnit: { select: { id: true, code: true, invoiceId: true, serialNumber: true, assetTag: true, status: true } },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              categoryId: true,
              isPatrimonializable: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!request) throw new Error("Request not found");
  if (request.requestType !== "STANDARD") {
    throw new Error("A finalização automática de stock só suporta requisições STANDARD.");
  }

  const existingOutCount = Number(
    await txAny.stockMovement.count({
      where: { tenantId: args.tenantId, requestId: request.id, type: "OUT" },
    })
  );
  if (existingOutCount > 0) {
    if (args.markFulfilled && request.status !== "FULFILLED") {
      await tx.request.update({ where: { id: request.id }, data: { status: "FULFILLED" } });
    }
    return { idempotent: true, request };
  }

  let resolvedLocationId: string | null = null;
  const normalizedDeliveryLocation = request.deliveryLocation?.trim() || null;
  if (normalizedDeliveryLocation) {
    const location = await txAny.municipalAssetLocation.findFirst({
      where: { tenantId: args.tenantId, name: normalizedDeliveryLocation },
      select: { id: true },
    });
    resolvedLocationId = location?.id ?? null;
  }

  const reasonBase = `${args.reasonPrefix || "Entrega"} ${request.gtmiNumber}`;

  for (const item of request.items) {
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if ((item.role ?? "NORMAL") === "OLD") continue;

    const unitCount = Number(await txAny.productUnit.count({ where: { tenantId: args.tenantId, productId: item.productId } }));
    const isUnitTracked = unitCount > 0;

    if (isUnitTracked) {
      if (qty !== 1) {
        throw new Error("Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade).");
      }

      const manualCode = args.lineUnitCodes?.get(item.id)?.trim() || "";
      const reservedCode = item.reservedUnit?.code?.trim() || "";
      const destinationCode = typeof item.destination === "string" ? item.destination.trim() : "";
      const requestedCode = manualCode || reservedCode || destinationCode;
      const reservedCodes = await getReservedUnitCodes(txAny, {
        tenantId: args.tenantId,
        productId: item.productId,
        excludeRequestId: request.id,
      });
      if (requestedCode && reservedCodes.includes(requestedCode)) {
        throw new Error(`Unidade ${requestedCode} já está reservada noutro pedido aberto`);
      }

      const excludedCodes = mergeExcludedUnitCodes(reservedCodes);
      const unit = manualCode || !item.reservedUnitId
        ? requestedCode
          ? await txAny.productUnit.findFirst({
              where: { tenantId: args.tenantId, productId: item.productId, code: requestedCode, status: "IN_STOCK" },
              select: { id: true, code: true, invoiceId: true, serialNumber: true, assetTag: true },
            })
          : await txAny.productUnit.findFirst({
              where: {
                tenantId: args.tenantId,
                productId: item.productId,
                status: "IN_STOCK",
                ...(excludedCodes.length ? { code: { notIn: excludedCodes } } : {}),
              },
              orderBy: { createdAt: "asc" },
              select: { id: true, code: true, invoiceId: true, serialNumber: true, assetTag: true },
            })
        : await txAny.productUnit.findFirst({
            where: { id: item.reservedUnitId, tenantId: args.tenantId, productId: item.productId, status: "IN_STOCK" },
            select: { id: true, code: true, invoiceId: true, serialNumber: true, assetTag: true },
          });

      if (!unit) {
        throw new Error(`Sem unidade em stock para ${item.product?.name || "produto"}`);
      }

      const lockUpdate = await txAny.productUnit.updateMany({
        where: { id: unit.id, status: "IN_STOCK" },
        data: {
          status: "ACQUIRED",
          acquiredAt: new Date(),
          acquiredByUserId: args.actorUserId,
          assignedToUserId: request.userId,
          acquiredReason: reasonBase,
        },
      });
      if (!lockUpdate.count) throw new Error(`Unidade ${unit.code} já não está disponível`);

      if (!item.reservedUnitId || item.destination !== unit.code) {
        await tx.requestItem.update({
          where: { id: item.id },
          data: { reservedUnitId: unit.id, destination: unit.code },
        });
      }

      await txAny.stockMovement.create({
        data: {
          type: "OUT",
          quantity: BigInt(1) as any,
          tenantId: args.tenantId,
          productId: item.productId,
          unitId: unit.id,
          invoiceId: unit.invoiceId ?? null,
          requestId: request.id,
          performedByUserId: args.actorUserId,
          assignedToUserId: request.userId,
          reason: reasonBase,
          notes: args.documentRef ?? args.note ?? null,
        },
        select: { id: true },
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

      if (item.product?.isPatrimonializable) {
        const mappedClass = item.product.categoryId
          ? await txAny.assetCategoryClassMap.findFirst({
              where: { tenantId: args.tenantId, categoryId: item.product.categoryId },
              select: { classId: true },
            })
          : null;

        const existingAsset = await txAny.municipalAsset.findFirst({
          where: { tenantId: args.tenantId, productUnitId: unit.id },
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
              tenantId: args.tenantId,
              code: await generateMunicipalAssetCode(txAny, args.tenantId),
              name: item.product.name,
              category: item.product.category?.name ?? null,
              status: nextStatus,
              location: normalizedDeliveryLocation,
              locationId: resolvedLocationId,
              notes: args.note?.trim() || `Criado automaticamente por entrega ${request.gtmiNumber}`,
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
              tenantId: args.tenantId,
              assetId,
              fromStatus: null,
              toStatus: nextStatus,
              note: `Criação automática via entrega ${request.gtmiNumber}`,
              actorUserId: args.actorUserId,
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
                tenantId: args.tenantId,
                assetId: existingAsset.id,
                fromStatus: existingAsset.status,
                toStatus: nextStatus,
                note: `Mudança de estado via entrega ${request.gtmiNumber}`,
                actorUserId: args.actorUserId,
              },
            });
          }
        }

        if (assetId) {
          await txAny.municipalAssetAssignment.create({
            data: {
              tenantId: args.tenantId,
              assetId,
              userId: request.userId,
              requestingServiceId: request.requestingServiceId ?? null,
              note: `Entrega ${request.gtmiNumber}`,
            },
          });

          await txAny.municipalAssetMovement.create({
            data: {
              tenantId: args.tenantId,
              assetId,
              type: existingAsset ? "TRANSFER" : "ASSIGN",
              statusFrom: existingAsset?.status ?? null,
              statusTo: nextStatus,
              movementAt: new Date(),
              reason: reasonBase,
              note: args.note?.trim() || `Entrega de unidade ${unit.code}`,
              documentRef: args.documentRef ?? `Pedido ${request.gtmiNumber}`,
              actorUserId: args.actorUserId,
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
        throw new Error(`Stock insuficiente para ${item.product?.name || "produto"}`);
      }

      await txAny.stockMovement.create({
        data: {
          type: "OUT",
          quantity: BigInt(qty) as any,
          tenantId: args.tenantId,
          productId: item.productId,
          requestId: request.id,
          performedByUserId: args.actorUserId,
          assignedToUserId: request.userId,
          reason: reasonBase,
          notes: args.documentRef ?? args.note ?? null,
        },
        select: { id: true },
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

  if (args.markFulfilled) {
    await tx.request.update({
      where: { id: request.id },
      data: {
        status: "FULFILLED",
        ...(args.pickup
          ? {
              pickupSignedAt: new Date(),
              pickupSignedByName: args.pickup.name,
              pickupSignedByTitle: args.pickup.title ?? null,
              pickupSignatureDataUrl: args.pickup.signatureDataUrl ?? null,
              pickupRecordedByUserId: args.actorUserId,
              pickupSignedIp: args.pickup.ip ?? null,
              pickupSignedUserAgent: args.pickup.userAgent ?? null,
              pickupVoidedAt: null,
              pickupVoidedReason: null,
              pickupVoidedByUserId: null,
            }
          : {}),
      },
    });
  }

  return { idempotent: false, request };
}
