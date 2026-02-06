import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const goodsTypeSchema = z.enum(["MATERIALS_SERVICES", "WAREHOUSE_MATERIALS", "OTHER_PRODUCTS"]);

const dateLikeString = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
  .transform((v) => new Date(v));

const createRequestSchema = z.object({
  asUserId: z.string().uuid().optional(),
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(1000).optional(),
  requestedAt: dateLikeString.optional(),

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
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().max(500).optional(),
        unit: z.string().max(60).optional(),
        reference: z.string().max(120).optional(),
        destination: z.string().max(120).optional(),
      })
    )
    .min(1),
});

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
  }>;
}) {
  const gtmiYear = args.requestedAt.getFullYear();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
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

            title: args.title,
            notes: args.notes,

            gtmiYear,
            gtmiSeq: nextSeq,
            gtmiNumber,
            requestedAt: args.requestedAt,

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

        return created;
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

  // By default, requests are tenant-wide (visible to all users in the tenant).
  // Optional filters:
  // - mine=1: only the current user's requests
  // - asUserId=<uuid>: only allowed for ADMIN, filter by request owner
  const userIdFilter = isAdmin && asUserIdFromQuery ? asUserIdFromQuery : mine ? session.id : undefined;

  if (req.method === "GET") {
    try {
      const requests = await prisma.request.findMany({
        where: {
          tenantId,
          ...(userIdFilter ? { userId: userIdFilter } : {}),
        },
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
      });

      return res.status(200).json(
        requests.map((r) => {
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
        })
      );
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
      asUserId,
      title,
      notes,
      requestedAt,
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
      items,
    } = parsed.data;
    const createForUserId = isAdmin && asUserId ? asUserId : session.id;

    try {
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
        userId: createForUserId,
        createdByUserId: session.id,
        title,
        notes,
        requestedAt: effectiveRequestedAt,
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
        items,
      });

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        requestedAt: created.requestedAt.toISOString(),
        expectedDeliveryFrom: created.expectedDeliveryFrom ? created.expectedDeliveryFrom.toISOString() : null,
        expectedDeliveryTo: created.expectedDeliveryTo ? created.expectedDeliveryTo.toISOString() : null,
        items: created.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("POST /api/requests error:", error);
      return res.status(500).json({ error: "Failed to create request" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
