import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { createRequestStatusAudit, notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";
import { createTicketAudit } from "@/pages/api/tickets/_utils";
import { ensureRequestWorkflowDefinition, ensureRequestWorkflowInstance } from "@/utils/workflow";

const goodsTypeSchema = z.enum(["MATERIALS_SERVICES", "WAREHOUSE_MATERIALS", "OTHER_PRODUCTS"]);
const requestTypeSchema = z.enum(["STANDARD", "RETURN"]);
const requestItemRoleSchema = z.enum(["NORMAL", "OLD", "NEW"]);

const dateLikeString = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
  .transform((v) => new Date(v));

const createRequestSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(1000).optional(),
  requestedAt: dateLikeString.optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueAt: dateLikeString.optional(),
  requestType: requestTypeSchema.optional(),

  requestingServiceId: z.number().int(),
  requesterName: z.string().max(120).optional(),
  requesterEmployeeNo: z.string().max(60).optional(),
  deliveryLocation: z.string().max(200).optional(),
  expectedDeliveryFrom: dateLikeString.optional(),
  expectedDeliveryTo: dateLikeString.optional(),
  goodsTypes: z.array(goodsTypeSchema).optional(),

  supplierOption1: z.string().max(200).optional(),
  supplierOption2: z.string().max(200).optional(),
  supplierOption3: z.string().max(200).optional(),
  ticketId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().max(500).optional(),
        unit: z.string().max(60).optional(),
        reference: z.string().max(120).optional(),
        destination: z.string().max(120).optional(),
        role: requestItemRoleSchema.optional(),
      })
    )
    .min(1),
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

function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function formatGtmiNumber(gtmiYear: number, gtmiSeq: number) {
  return `GTMI-${gtmiYear}-${String(gtmiSeq).padStart(6, "0")}`;
}

async function createRequestWithGtmiSeq(args: {
  tenantId: string;
  userId: string;
  createdByUserId: string;
  title?: string;
  notes?: string;
  requestedAt: Date;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt?: Date;
  requestType: z.infer<typeof requestTypeSchema>;
  requestingService?: string;
  requestingServiceId?: number;
  requesterName?: string;
  requesterEmployeeNo?: string;
  deliveryLocation?: string;
  expectedDeliveryFrom?: Date;
  expectedDeliveryTo?: Date;
  goodsTypes: Array<z.infer<typeof goodsTypeSchema>>;
  supplierOption1?: string;
  supplierOption2?: string;
  supplierOption3?: string;
  items: Array<{
    productId: string;
    quantity: number;
    notes?: string;
    unit?: string;
    reference?: string;
    destination?: string;
    role?: z.infer<typeof requestItemRoleSchema>;
  }>;
}) {
  const gtmiYear = args.requestedAt.getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const txAny = tx as any;

        const maxSeq = await tx.request.aggregate({
          where: { tenantId: args.tenantId, gtmiYear },
          _max: { gtmiSeq: true },
        });

        const nextSeq = (maxSeq._max.gtmiSeq ?? 0) + 1;
        const gtmiNumber = formatGtmiNumber(gtmiYear, nextSeq);

        const created = await tx.request.create({
          data: {
            tenantId: args.tenantId,
            userId: args.userId,
            createdByUserId: args.createdByUserId,
            status: "SUBMITTED",
            requestType: args.requestType,

            title: args.title,
            notes: args.notes,

            gtmiYear,
            gtmiSeq: nextSeq,
            gtmiNumber,
            requestedAt: args.requestedAt,
            priority: args.priority ?? "NORMAL",
            dueAt: args.dueAt ?? null,

            requestingService: args.requestingService,
            requestingServiceId: typeof args.requestingServiceId === "number" ? args.requestingServiceId : null,
            requesterName: args.requesterName,
            requesterEmployeeNo: args.requesterEmployeeNo,
            deliveryLocation: args.deliveryLocation,
            expectedDeliveryFrom: args.expectedDeliveryFrom,
            expectedDeliveryTo: args.expectedDeliveryTo,
            goodsTypes: args.goodsTypes,
            supplierOption1: args.supplierOption1,
            supplierOption2: args.supplierOption2,
            supplierOption3: args.supplierOption3,

            items: {
              create: args.items.map((i) => ({
                productId: i.productId,
                quantity: BigInt(i.quantity) as any,
                notes: i.notes,
                unit: i.unit,
                reference: i.reference,
                destination: i.destination,
                role: i.role ?? "NORMAL",
              })),
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            items: {
              include: { product: { select: { id: true, name: true, sku: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        await ensureRequestWorkflowInstance(tx, {
          tenantId: args.tenantId,
          requestId: created.id,
        });

        // === Stock deduction / unit allocation ===
        if (args.requestType === "RETURN") {
          const final = await tx.request.findUnique({
            where: { id: created.id },
            include: {
              user: { select: { id: true, name: true, email: true } },
              createdBy: { select: { id: true, name: true, email: true } },
              items: {
                include: { product: { select: { id: true, name: true, sku: true } } },
                orderBy: { createdAt: "asc" },
              },
            },
          });

          return final ?? created;
        }

        const performerUserId = args.createdByUserId;
        const assignedToUserId = args.userId;
        const stockReason = `Requisi\u00e7\u00e3o ${gtmiNumber}`;

        const unitCountByProductId = new Map<string, number>();

        for (const item of created.items as any[]) {
          const qty = Number(item.quantity);
          if (!Number.isFinite(qty) || qty <= 0) {
            continue;
          }

          const productId: string = item.productId;

          let unitCount: number | undefined = unitCountByProductId.get(productId);
          if (unitCount === undefined) {
            unitCount = Number(
              await txAny.productUnit.count({
              where: { tenantId: args.tenantId, productId },
              })
            );
            unitCountByProductId.set(productId, unitCount);
          }

          const isUnitTracked = unitCount > 0;
          const requestedCode = typeof item.destination === "string" ? item.destination.trim() : "";

          if (isUnitTracked) {
            if (qty !== 1) {
              throw new StockAllocationError(
                "UNIT_QTY_MUST_BE_1",
                "Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade).",
                { productId, quantity: qty }
              );
            }

            const unit = requestedCode && isUuidLike(requestedCode)
              ? await txAny.productUnit.findFirst({
                  where: {
                    tenantId: args.tenantId,
                    productId,
                    code: requestedCode,
                    status: "IN_STOCK",
                  },
                  select: { id: true, code: true, invoiceId: true },
                })
              : await txAny.productUnit.findFirst({
                  where: {
                    tenantId: args.tenantId,
                    productId,
                    status: "IN_STOCK",
                  },
                  orderBy: { createdAt: "asc" },
                  select: { id: true, code: true, invoiceId: true },
                });

            if (!unit) {
              throw new StockAllocationError(
                "NO_UNIT_IN_STOCK",
                "Sem unidades em stock para um dos produtos selecionados.",
                { productId, requestedCode: requestedCode || null }
              );
            }

            const updated = await txAny.productUnit.updateMany({
              where: { id: unit.id, status: "IN_STOCK" },
              data: {
                status: "ACQUIRED",
                acquiredAt: new Date(),
                acquiredByUserId: performerUserId,
                assignedToUserId,
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

            if (!requestedCode || requestedCode !== unit.code) {
              await tx.requestItem.update({
                where: { id: item.id },
                data: { destination: unit.code },
              });
            }

            await txAny.stockMovement.create({
              data: {
                type: "OUT",
                quantity: BigInt(1) as any,
                tenantId: args.tenantId,
                productId,
                unitId: unit.id,
                invoiceId: unit.invoiceId ?? null,
                requestId: created.id,
                performedByUserId: performerUserId,
                assignedToUserId,
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
            // Bulk stock item (no per-unit tracking)
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
                tenantId: args.tenantId,
                productId,
                requestId: created.id,
                performedByUserId: performerUserId,
                assignedToUserId,
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

        const final = await tx.request.findUnique({
          where: { id: created.id },
          include: {
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            items: {
              include: { product: { select: { id: true, name: true, sku: true } } },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        return final ?? created;
      });
    } catch (error: any) {
      // P2002 = Unique constraint violation (race on gtmiSeq or gtmiNumber)
      if (error?.code === "P2002" && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to allocate GTMI sequence");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenantId = session.tenantId;

  const isAdmin = session.role === "ADMIN";
  const asUserIdFromQuery = typeof req.query.asUserId === "string" ? req.query.asUserId : undefined;
  const mineFlag = typeof req.query.mine === "string" ? req.query.mine : undefined;
  const mine = mineFlag === "1" || mineFlag === "true";
  const paged = String(req.query.paged ?? "") === "1" || String(req.query.paged ?? "") === "true";

  // By default, requests are tenant-wide (visible to all users in the tenant).
  // Optional filters:
  // - mine=1: only the current user's requests
  // - asUserId=<uuid>: only allowed for ADMIN, filter by request owner
  const userIdFilter = isAdmin && asUserIdFromQuery ? asUserIdFromQuery : mine ? session.id : undefined;

  if (req.method === "GET") {
    try {
      const page = Math.max(1, Number(req.query.page || 1) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20) || 20));
      const statusParam = typeof req.query.status === "string" ? req.query.status.trim() : "";
      const priorityParam = typeof req.query.priority === "string" ? req.query.priority.trim() : "";
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const dateFrom = typeof req.query.dateFrom === "string" && req.query.dateFrom ? new Date(req.query.dateFrom) : null;
      const dateTo = typeof req.query.dateTo === "string" && req.query.dateTo ? new Date(req.query.dateTo) : null;

      const where: any = {
        tenantId,
        ...(userIdFilter ? { userId: userIdFilter } : {}),
        ...(statusParam ? { status: statusParam } : {}),
        ...(priorityParam ? { priority: priorityParam } : {}),
        ...(q
          ? {
              OR: [
                { gtmiNumber: { contains: q, mode: "insensitive" as const } },
                { title: { contains: q, mode: "insensitive" as const } },
                { requesterName: { contains: q, mode: "insensitive" as const } },
                { requestingService: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(dateFrom || dateTo
          ? {
              requestedAt: {
                ...(dateFrom && !Number.isNaN(dateFrom.getTime()) ? { gte: dateFrom } : {}),
                ...(dateTo && !Number.isNaN(dateTo.getTime()) ? { lte: dateTo } : {}),
              },
            }
          : {}),
      };

      const [requests, total] = await Promise.all([
        prisma.request.findMany({
          where,
          orderBy: { requestedAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            signedBy: { select: { id: true, name: true, email: true } },
            requestingServiceRef: { select: { id: true, codigo: true, designacao: true, ativo: true } },
            invoices: {
              select: {
                id: true,
                invoiceNumber: true,
                issuedAt: true,
                productId: true,
              },
              orderBy: { issuedAt: "desc" },
            },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
        }),
        paged ? prisma.request.count({ where }) : Promise.resolve(0),
      ]);

      const mapped = requests.map((r) => {
          const { pickupSignatureDataUrl: _pickupSignatureDataUrl, ...rest } = r as any;
          return {
            ...rest,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            requestedAt: r.requestedAt.toISOString(),
            expectedDeliveryFrom: r.expectedDeliveryFrom ? r.expectedDeliveryFrom.toISOString() : null,
            expectedDeliveryTo: r.expectedDeliveryTo ? r.expectedDeliveryTo.toISOString() : null,
            signedAt: r.signedAt ? r.signedAt.toISOString() : null,
            signedVoidedAt: (r as any).signedVoidedAt ? (r as any).signedVoidedAt.toISOString() : null,
            pickupSignedAt: r.pickupSignedAt ? r.pickupSignedAt.toISOString() : null,
            pickupVoidedAt: (r as any).pickupVoidedAt ? (r as any).pickupVoidedAt.toISOString() : null,
            dueAt: (r as any).dueAt ? (r as any).dueAt.toISOString() : null,
            invoices: r.invoices.map((inv) => ({
              ...inv,
              issuedAt: inv.issuedAt.toISOString(),
            })),
            items: r.items.map((it) => ({
              ...it,
              quantity: Number(it.quantity),
              createdAt: it.createdAt.toISOString(),
              updatedAt: it.updatedAt.toISOString(),
            })),
          };
        });

      if (paged) {
        return res.status(200).json({
          items: mapped,
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        });
      }

      return res.status(200).json(mapped);
    } catch (error) {
      console.error("GET /api/requests error:", error);
      return res.status(500).json({ error: "Failed to fetch requests" });
    }
  }

  if (req.method === "POST") {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const {
      title,
      notes,
      requestedAt,
      priority,
      dueAt,
      requestType,
      requestingServiceId,
      requesterName,
      requesterEmployeeNo,
      deliveryLocation,
      expectedDeliveryFrom,
      expectedDeliveryTo,
      goodsTypes,
      supplierOption1,
      supplierOption2,
      supplierOption3,
      ticketId,
      items,
    } = parsed.data;
    const effectiveRequestType = requestType ?? "STANDARD";

    if (effectiveRequestType === "RETURN") {
      const hasOld = items.some((it) => (it.role ?? "NORMAL") === "OLD");
      const hasNew = items.some((it) => (it.role ?? "NORMAL") === "NEW");
      if (!hasOld || !hasNew) {
        return res.status(400).json({ error: "Requisição de devolução exige itens ANTIGOS e NOVOS." });
      }
    }

    try {
      await ensureRequestWorkflowDefinition(prisma, tenantId);
      const svc = await prisma.requestingService.findUnique({
        where: { id: requestingServiceId },
        select: { id: true, ativo: true, codigo: true, designacao: true },
      });
      if (!svc) {
        return res.status(400).json({ error: "Serviço requisitante inválido" });
      }
      if (!svc.ativo) {
        return res.status(400).json({ error: "Serviço requisitante inativo" });
      }
      const normalizedRequestingService = `${svc.codigo} — ${svc.designacao}`.slice(0, 120);

      // Ensure all products belong to the user
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
      const products = await prisma.product.findMany({
        where: { tenantId, id: { in: uniqueProductIds } },
        select: { id: true },
      });
      const allowed = new Set(products.map((p) => p.id));

      const firstInvalid = items.find((i) => !allowed.has(i.productId));
      if (firstInvalid) {
        return res.status(404).json({ error: "One or more products were not found" });
      }

      const effectiveRequestedAt = requestedAt ?? new Date();
      const created = await createRequestWithGtmiSeq({
        tenantId,
        userId: session.id,
        createdByUserId: session.id,
        title,
        notes,
        requestedAt: effectiveRequestedAt,
        priority: priority ?? "NORMAL",
        dueAt,
        requestType: effectiveRequestType,
        requestingService: normalizedRequestingService,
        requestingServiceId,
        requesterName,
        requesterEmployeeNo,
        deliveryLocation,
        expectedDeliveryFrom,
        expectedDeliveryTo,
        goodsTypes: goodsTypes ?? [],
        supplierOption1,
        supplierOption2,
        supplierOption3,
        items: items.map((it) => ({
          ...it,
          role: it.role ?? "NORMAL",
        })),
      });

      if (ticketId) {
        const ticket = await prisma.ticket.findFirst({
          where: {
            id: ticketId,
            tenantId,
            ...(isAdmin ? {} : { OR: [{ createdByUserId: session.id }, { assignedToUserId: session.id }] }),
          },
          select: { id: true, code: true },
        });

        if (!ticket) {
          return res.status(400).json({ error: "Ticket inválido para associação." });
        }
        await prisma.$transaction(async (tx) => {
          await tx.ticket.update({
            where: { id: ticket.id },
            data: { type: "REQUEST" },
          });
          await tx.ticketRequestLink.upsert({
            where: {
              ticketId_requestId: {
                ticketId: ticket.id,
                requestId: created.id,
              },
            },
            create: {
              tenantId,
              ticketId: ticket.id,
              requestId: created.id,
              linkedByUserId: session.id,
            },
            update: {},
          });
          await tx.ticketMessage.create({
            data: {
              tenantId,
              ticketId: ticket.id,
              authorUserId: session.id,
              body: `Requisição associada: ${created.gtmiNumber}.`,
            },
          });
        });
        await createTicketAudit({
          tenantId,
          ticketId: ticket.id,
          actorUserId: session.id,
          action: "REQUEST_LINKED",
          note: `Requisição ${created.gtmiNumber} associada ao ticket`,
          data: { requestId: created.id, gtmiNumber: created.gtmiNumber },
        });

        publishRealtimeEvent({
          type: "ticket.updated",
          tenantId,
          audience: "ALL",
          payload: { ticketId: ticket.id, code: ticket.code, requestId: created.id },
        });
        publishRealtimeEvent({
          type: "ticket.message_created",
          tenantId,
          audience: "ALL",
          payload: { ticketId: ticket.id, code: ticket.code, requestId: created.id, authorUserId: session.id },
        });
      }

      try {
        await createRequestStatusAudit({
          tenantId,
          requestId: created.id,
          fromStatus: null,
          toStatus: "SUBMITTED",
          changedByUserId: session.id,
          source: "api/requests:POST",
        });

        await notifyAdmin({
          tenantId,
          kind: "REQUEST_CREATED",
          title: `Nova requisição ${created.gtmiNumber}`,
          message: `${created.requesterName || created.user?.name || "Utilizador"} submeteu um pedido.`,
          requestId: created.id,
          data: {
            requestId: created.id,
            gtmiNumber: created.gtmiNumber,
            status: created.status,
            ownerUserId: created.userId,
          },
        });

        if (created.userId) {
          await notifyUser({
            tenantId,
            recipientUserId: created.userId,
            kind: "REQUEST_CREATED",
            title: `Pedido criado: ${created.gtmiNumber}`,
            message: "A tua requisição foi criada com sucesso.",
            requestId: created.id,
            data: {
              requestId: created.id,
              gtmiNumber: created.gtmiNumber,
              status: created.status,
            },
          });
        }

        publishRealtimeEvent({
          type: "request.created",
          tenantId,
          audience: "ALL",
          userId: created.userId,
          payload: {
            id: created.id,
            gtmiNumber: created.gtmiNumber,
            status: created.status,
            requestedAt: created.requestedAt.toISOString(),
            ownerUserId: created.userId,
          },
        });
      } catch (notifyError) {
        console.error("POST /api/requests notify/audit error:", notifyError);
      }

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        requestedAt: created.requestedAt.toISOString(),
        expectedDeliveryFrom: created.expectedDeliveryFrom ? created.expectedDeliveryFrom.toISOString() : null,
        expectedDeliveryTo: created.expectedDeliveryTo ? created.expectedDeliveryTo.toISOString() : null,
        dueAt: created.dueAt ? created.dueAt.toISOString() : null,
        items: created.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      if (error instanceof StockAllocationError) {
        return res.status(400).json({ error: error.message, code: error.code, details: error.details ?? null });
      }
      console.error("POST /api/requests error:", error);
      return res.status(500).json({ error: "Failed to create request" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
