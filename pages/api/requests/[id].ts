import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { createRequestStatusAudit, notifyAdmin, notifyUser } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";
import { buildSignedRequestPdfBuffer } from "@/utils/requestPdf";
import {
  buildRequestFolderName,
  buildStoredFileName,
  getRequestStorageDir,
} from "@/utils/storageLayout";

function computeProductStatus(quantity: number) {
  return quantity > 20 ? "Available" : quantity > 0 ? "Stock Low" : "Stock Out";
}

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (typeof raw === "string" && raw.trim()) return raw.split(",")[0].trim();
  const ra = req.socket?.remoteAddress;
  return typeof ra === "string" ? ra : undefined;
}

const ensureDir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

function getSystemRequestPdfOriginalName(gtmiNumber: string) {
  return `[SISTEMA] Requisição ${gtmiNumber} - Assinada.pdf`;
}

function getSystemRequestApprovalPdfOriginalName(gtmiNumber: string) {
  return `[SISTEMA] Requisição ${gtmiNumber} - Aprovada.pdf`;
}

async function deleteSystemRequestPdfs(args: {
  tenantId: string;
  requestId: string;
  gtmiNumber: string;
}) {
  const originalName = getSystemRequestPdfOriginalName(args.gtmiNumber);
  const rows = await prisma.storedFile.findMany({
    where: {
      tenantId: args.tenantId,
      kind: "REQUEST",
      requestId: args.requestId,
      mimeType: "application/pdf",
      originalName,
    },
    select: { id: true, storagePath: true },
  });

  for (const r of rows) {
    const absPath = path.join(process.cwd(), r.storagePath);
    try {
      await fs.promises.unlink(absPath);
    } catch {
      // ignore if missing
    }
  }

  if (rows.length) {
    await prisma.storedFile.deleteMany({
      where: { id: { in: rows.map((r) => r.id) }, tenantId: args.tenantId },
    });
  }
}

async function deleteSystemRequestApprovalPdfs(args: {
  tenantId: string;
  requestId: string;
  gtmiNumber: string;
}) {
  const originalName = getSystemRequestApprovalPdfOriginalName(args.gtmiNumber);
  const rows = await prisma.storedFile.findMany({
    where: {
      tenantId: args.tenantId,
      kind: "REQUEST",
      requestId: args.requestId,
      mimeType: "application/pdf",
      originalName,
    },
    select: { id: true, storagePath: true },
  });

  for (const r of rows) {
    const absPath = path.join(process.cwd(), r.storagePath);
    try {
      await fs.promises.unlink(absPath);
    } catch {
      // ignore
    }
  }

  if (rows.length) {
    await prisma.storedFile.deleteMany({
      where: { id: { in: rows.map((r) => r.id) }, tenantId: args.tenantId },
    });
  }
}

async function createSystemRequestPdf(args: {
  tenantId: string;
  request: any;
}) {
  const request = args.request;
  const folderName = buildRequestFolderName({
    gtmiNumber: request.gtmiNumber,
    requesterName: request.requesterName ?? request.user?.name,
    summary: request.title,
    requestedAt: request.requestedAt,
  });
  const destDir = getRequestStorageDir({
    tenantId: args.tenantId,
    gtmiYear: request.gtmiYear,
    folderName,
  });
  await ensureDir(destDir);

  const id = crypto.randomUUID();
  const originalName = getSystemRequestPdfOriginalName(request.gtmiNumber);
  const fileName = buildStoredFileName({ originalName, id });
  const absPath = path.join(destDir, fileName);

  const pdfBuffer = await buildSignedRequestPdfBuffer({
    gtmiNumber: request.gtmiNumber,
    requestedAt: request.requestedAt,
    title: request.title,
    notes: request.notes,
    requestingService: request.requestingService,
    requesterName: request.requesterName,
    requesterEmployeeNo: request.requesterEmployeeNo,
    deliveryLocation: request.deliveryLocation,
    signedAt: request.signedAt,
    signedByName: request.signedByName,
    signedByTitle: request.signedByTitle,
    pickupSignedAt: request.pickupSignedAt,
    pickupSignedByName: request.pickupSignedByName,
    pickupSignedByTitle: request.pickupSignedByTitle,
    pickupSignatureDataUrl: request.pickupSignatureDataUrl,
    items: request.items,
  });

  await fs.promises.writeFile(absPath, pdfBuffer);

  await prisma.storedFile.create({
    data: {
      id,
      tenantId: args.tenantId,
      kind: "REQUEST",
      requestId: request.id,
      originalName,
      fileName,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      storagePath: path.relative(process.cwd(), absPath),
    },
  });
}

async function createSystemRequestApprovalPdf(args: {
  tenantId: string;
  request: any;
}) {
  const request = args.request;
  const folderName = buildRequestFolderName({
    gtmiNumber: request.gtmiNumber,
    requesterName: request.requesterName ?? request.user?.name,
    summary: request.title,
    requestedAt: request.requestedAt,
  });
  const destDir = getRequestStorageDir({
    tenantId: args.tenantId,
    gtmiYear: request.gtmiYear,
    folderName,
  });
  await ensureDir(destDir);

  const id = crypto.randomUUID();
  const originalName = getSystemRequestApprovalPdfOriginalName(request.gtmiNumber);
  const fileName = buildStoredFileName({ originalName, id });
  const absPath = path.join(destDir, fileName);

  const pdfBuffer = await buildSignedRequestPdfBuffer({
    gtmiNumber: request.gtmiNumber,
    requestedAt: request.requestedAt,
    title: request.title,
    notes: request.notes,
    requestingService: request.requestingService,
    requesterName: request.requesterName,
    requesterEmployeeNo: request.requesterEmployeeNo,
    deliveryLocation: request.deliveryLocation,
    signedAt: request.signedAt,
    signedByName: request.signedByName,
    signedByTitle: request.signedByTitle,
    items: request.items,
  });

  await fs.promises.writeFile(absPath, pdfBuffer);

  await prisma.storedFile.create({
    data: {
      id,
      tenantId: args.tenantId,
      kind: "REQUEST",
      requestId: request.id,
      originalName,
      fileName,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      storagePath: path.relative(process.cwd(), absPath),
    },
  });
}

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "FULFILLED"]).optional(),
  title: z.string().max(120).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),

  requestedAt: z
    .string()
    .min(1)
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
    .transform((v) => new Date(v))
    .optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueAt: z
    .union([
      z
        .string()
        .min(1)
        .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
        .transform((v) => new Date(v)),
      z.null(),
    ])
    .optional(),

  requestingServiceId: z.number().int().optional(),
  requesterName: z.string().max(120).nullable().optional(),
  requesterEmployeeNo: z.string().max(60).nullable().optional(),
  deliveryLocation: z.string().max(200).nullable().optional(),
  expectedDeliveryFrom: z
    .union([
      z
        .string()
        .min(1)
        .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
        .transform((v) => new Date(v)),
      z.null(),
    ])
    .optional(),
  expectedDeliveryTo: z
    .union([
      z
        .string()
        .min(1)
        .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date")
        .transform((v) => new Date(v)),
      z.null(),
    ])
    .optional(),
  goodsTypes: z.array(z.enum(["MATERIALS_SERVICES", "WAREHOUSE_MATERIALS", "OTHER_PRODUCTS"]))
    .optional(),

  supplierOption1: z.string().max(200).nullable().optional(),
  supplierOption2: z.string().max(200).nullable().optional(),
  supplierOption3: z.string().max(200).nullable().optional(),

  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        notes: z.string().max(500).nullable().optional(),
        unit: z.string().max(60).nullable().optional(),
        reference: z.string().max(120).nullable().optional(),
        destination: z.string().max(120).nullable().optional(),
      })
    )
    .optional(),

  replaceItems: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        notes: z.string().max(500).nullable().optional(),
        unit: z.string().max(60).nullable().optional(),
        reference: z.string().max(120).nullable().optional(),
        destination: z.string().max(120).nullable().optional(),
      })
    )
    .optional(),
  sign: z
    .object({
      name: z.string().min(1).max(120),
      title: z.string().max(120).optional(),
    })
    .optional(),
  pickupSign: z
    .object({
      name: z.string().min(1).max(120),
      title: z.string().max(120).optional(),
      signatureDataUrl: z
        .string()
        .min(50)
        .max(400_000)
        .refine((v) => v.startsWith("data:image/png;base64,"), {
          message: "Signature must be a PNG data URL",
        }),
    })
    .optional(),
  voidSign: z
    .object({
      reason: z.string().min(3).max(500),
    })
    .optional(),
  voidPickupSign: z
    .object({
      reason: z.string().min(3).max(500),
    })
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid request id" });
  }

  const tenantId = session.tenantId;

  const isAdmin = session.role === "ADMIN";
  const asUserIdFromQuery = typeof req.query.asUserId === "string" ? req.query.asUserId : undefined;

  const canMutateRequest = async () => {
    const row = await prisma.request.findFirst({
      where: { id, tenantId },
      select: { userId: true },
    });

    if (!row) return { ok: false as const, status: 404 as const, error: "Request not found" };
    if (isAdmin) return { ok: true as const, ownerUserId: row.userId };
    if (row.userId === session.id) return { ok: true as const, ownerUserId: row.userId };

    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  };

  if (req.method === "GET") {
    try {
      const request = await prisma.request.findFirst({
        where: { id, tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          signedBy: { select: { id: true, name: true, email: true } },
          signedVoidedBy: { select: { id: true, name: true, email: true } },
          pickupRecordedBy: { select: { id: true, name: true, email: true } },
          pickupVoidedBy: { select: { id: true, name: true, email: true } },
          requestingServiceRef: { select: { id: true, codigo: true, designacao: true, ativo: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  supplier: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          invoices: {
            select: {
              id: true,
              invoiceNumber: true,
              issuedAt: true,
              productId: true,
              reqNumber: true,
              reqDate: true,
              requestId: true,
            },
            orderBy: { issuedAt: "desc" },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      const uniqueProductIds = Array.from(
        new Set((request.items || []).map((it) => it.productId).filter((pid) => typeof pid === "string" && pid))
      ) as string[];

      // Same behavior as the create form: pick the latest invoice per product.
      // We do it server-side to avoid N requests from the details/print pages.
      const invoicesForProducts = uniqueProductIds.length
        ? await prisma.productInvoice.findMany({
            where: { tenantId, productId: { in: uniqueProductIds } },
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              invoiceNumber: true,
              issuedAt: true,
              productId: true,
              reqNumber: true,
              reqDate: true,
              requestId: true,
            },
          })
        : [];

      const latestInvoiceByProductId = new Map<string, (typeof invoicesForProducts)[number]>();
      for (const inv of invoicesForProducts) {
        if (!latestInvoiceByProductId.has(inv.productId)) latestInvoiceByProductId.set(inv.productId, inv);
      }

      const latestInvoices = uniqueProductIds
        .map((productId) => latestInvoiceByProductId.get(productId))
        .filter(Boolean)
        .map((inv) => ({
          ...inv!,
          issuedAt: inv!.issuedAt.toISOString(),
          reqDate: inv!.reqDate ? inv!.reqDate.toISOString() : null,
        }));

      return res.status(200).json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
        expectedDeliveryFrom: request.expectedDeliveryFrom
          ? request.expectedDeliveryFrom.toISOString()
          : null,
        expectedDeliveryTo: request.expectedDeliveryTo ? request.expectedDeliveryTo.toISOString() : null,
        dueAt: (request as any).dueAt ? (request as any).dueAt.toISOString() : null,
        signedAt: request.signedAt ? request.signedAt.toISOString() : null,
        signedVoidedAt: request.signedVoidedAt ? request.signedVoidedAt.toISOString() : null,
        pickupSignedAt: request.pickupSignedAt ? request.pickupSignedAt.toISOString() : null,
        pickupVoidedAt: request.pickupVoidedAt ? request.pickupVoidedAt.toISOString() : null,
        items: request.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
        invoices: request.invoices.map((inv) => ({
          ...inv,
          issuedAt: inv.issuedAt.toISOString(),
          reqDate: inv.reqDate ? inv.reqDate.toISOString() : null,
        })),
        latestInvoices,
      });
    } catch (error) {
      console.error("GET /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to fetch request" });
    }
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const authz = await canMutateRequest();
    if (!authz.ok) {
      return res.status(authz.status).json({ error: authz.error });
    }

    try {
      const { sign, pickupSign, voidSign, voidPickupSign, items, replaceItems, ...rest } = parsed.data;
      const updateData: any = { ...rest };
      const existingBefore = await prisma.request.findFirst({
        where: { id, tenantId },
        select: { status: true, userId: true, gtmiNumber: true },
      });
      if (!existingBefore) {
        return res.status(404).json({ error: "Request not found" });
      }

      const hasAdminOnlyMutation =
        Boolean(sign) ||
        Boolean(pickupSign) ||
        Boolean(voidSign) ||
        Boolean(voidPickupSign) ||
        Object.prototype.hasOwnProperty.call(updateData, "status");
      if (hasAdminOnlyMutation && !isAdmin) {
        return res.status(403).json({ error: "Apenas ADMIN pode assinar ou alterar estado." });
      }

      const hasNonSignatureUpdates = Object.keys(rest).length > 0 || Boolean(items?.length) || Boolean(replaceItems);
      if (hasNonSignatureUpdates) {
        const existing = await prisma.request.findFirst({ where: { id, tenantId }, select: { signedAt: true } });
        if (existing?.signedAt) {
          return res.status(409).json({
            error: "Request is signed and cannot be edited. Void the signature to make changes.",
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "title")) {
        const raw = updateData.title;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData.title = trimmed ? trimmed : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "notes")) {
        const raw = updateData.notes;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData.notes = trimmed ? trimmed : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "requesterName")) {
        const raw = updateData.requesterName;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData.requesterName = trimmed ? trimmed : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "requesterEmployeeNo")) {
        const raw = updateData.requesterEmployeeNo;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData.requesterEmployeeNo = trimmed ? trimmed : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "deliveryLocation")) {
        const raw = updateData.deliveryLocation;
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData.deliveryLocation = trimmed ? trimmed : null;
        }
      }

      for (const k of ["supplierOption1", "supplierOption2", "supplierOption3"] as const) {
        if (!Object.prototype.hasOwnProperty.call(updateData, k)) continue;
        const raw = updateData[k];
        if (typeof raw === "string") {
          const trimmed = raw.trim();
          updateData[k] = trimmed ? trimmed : null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "requestingServiceId")) {
        const requestingServiceId = updateData.requestingServiceId;
        if (typeof requestingServiceId !== "number" || !Number.isFinite(requestingServiceId)) {
          return res.status(400).json({ error: "Serviço requisitante inválido" });
        }

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
        updateData.requestingService = `${svc.codigo} — ${svc.designacao}`.slice(0, 120);
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "requestedAt")) {
        const next = updateData.requestedAt;
        if (!(next instanceof Date) || Number.isNaN(next.getTime())) {
          return res.status(400).json({ error: "Data/Hora do pedido inválida" });
        }

        const existing = await prisma.request.findFirst({
          where: { id, tenantId },
          select: { gtmiYear: true },
        });
        if (!existing) {
          return res.status(404).json({ error: "Request not found" });
        }

        const nextYear = next.getFullYear();
        if (existing.gtmiYear !== nextYear) {
          return res.status(400).json({
            error: "Não é possível alterar o ano do pedido (GTMI). Ajuste apenas data/hora dentro do mesmo ano.",
          });
        }
      }

      const ip = getClientIp(req);
      const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined;

      if (voidSign) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden" });
        }
        updateData.signedAt = null;
        updateData.signedByName = null;
        updateData.signedByTitle = null;
        updateData.signedByUserId = null;
        updateData.signedIp = null;
        updateData.signedUserAgent = null;
        updateData.signedVoidedAt = new Date();
        updateData.signedVoidedReason = voidSign.reason;
        updateData.signedVoidedByUserId = session.id;
      }

      if (voidPickupSign) {
        if (!isAdmin) {
          return res.status(403).json({ error: "Forbidden" });
        }
        updateData.pickupSignedAt = null;
        updateData.pickupSignedByName = null;
        updateData.pickupSignedByTitle = null;
        updateData.pickupSignatureDataUrl = null;
        updateData.pickupSignedIp = null;
        updateData.pickupSignedUserAgent = null;
        updateData.pickupRecordedByUserId = null;
        updateData.pickupVoidedAt = new Date();
        updateData.pickupVoidedReason = voidPickupSign.reason;
        updateData.pickupVoidedByUserId = session.id;
      }

      if (sign) {
        const existing = await prisma.request.findFirst({ where: { id, tenantId }, select: { signedAt: true } });
        if (existing?.signedAt) {
          return res.status(409).json({ error: "Request already signed" });
        }
        updateData.signedAt = new Date();
        updateData.signedByName = sign.name;
        updateData.signedByTitle = sign.title ?? null;
        updateData.signedByUserId = session.id;
        updateData.signedIp = ip ?? null;
        updateData.signedUserAgent = userAgent ?? null;
        updateData.signedVoidedAt = null;
        updateData.signedVoidedReason = null;
        updateData.signedVoidedByUserId = null;
      }

      if (pickupSign) {
        const existing = await prisma.request.findFirst({ where: { id, tenantId }, select: { pickupSignedAt: true, status: true } });
        if (existing?.pickupSignedAt) {
          return res.status(409).json({ error: "Pickup already signed" });
        }

        if (existing?.status === "APPROVED") {
          updateData.status = "FULFILLED";
        }
        updateData.pickupSignedAt = new Date();
        updateData.pickupSignedByName = pickupSign.name;
        updateData.pickupSignedByTitle = pickupSign.title ?? null;
        updateData.pickupSignatureDataUrl = pickupSign.signatureDataUrl;
        updateData.pickupSignedIp = ip ?? null;
        updateData.pickupSignedUserAgent = userAgent ?? null;
        updateData.pickupRecordedByUserId = session.id;
        updateData.pickupVoidedAt = null;
        updateData.pickupVoidedReason = null;
        updateData.pickupVoidedByUserId = null;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const updatedRequest = await tx.request.updateMany({
          where: { id, tenantId },
          data: updateData,
        });

        if (updatedRequest.count === 0) {
          return { updatedCount: 0 };
        }

        if (items?.length) {
          const results = await Promise.all(
            items.map(async (it) => {
              const data: any = {};

              if (Object.prototype.hasOwnProperty.call(it, "notes")) {
                const v = it.notes;
                data.notes = typeof v === "string" ? (v.trim() ? v.trim() : null) : v === null ? null : undefined;
              }
              if (Object.prototype.hasOwnProperty.call(it, "unit")) {
                const v = it.unit;
                data.unit = typeof v === "string" ? (v.trim() ? v.trim() : null) : v === null ? null : undefined;
              }
              if (Object.prototype.hasOwnProperty.call(it, "reference")) {
                const v = it.reference;
                data.reference = typeof v === "string" ? (v.trim() ? v.trim() : null) : v === null ? null : undefined;
              }
              if (Object.prototype.hasOwnProperty.call(it, "destination")) {
                const v = it.destination;
                data.destination = typeof v === "string" ? (v.trim() ? v.trim() : null) : v === null ? null : undefined;
              }

              // No-op updates are allowed.
              return tx.requestItem.updateMany({
                where: { id: it.id, requestId: id },
                data,
              });
            })
          );

          const updatedItemsCount = results.reduce((acc, r) => acc + (r?.count ?? 0), 0);
          if (updatedItemsCount !== items.length) {
            throw new Error("One or more request items were not found");
          }
        }

        if (replaceItems) {
          if (replaceItems.length < 1) {
            throw new Error("Replace items must include at least one item");
          }

          const txAny = tx as any;

          const existingRequest = await tx.request.findFirst({
            where: { id, tenantId },
            select: {
              id: true,
              userId: true,
              gtmiNumber: true,
              items: {
                select: {
                  id: true,
                  productId: true,
                  quantity: true,
                  destination: true,
                },
              },
            },
          });
          if (!existingRequest) {
            return { updatedCount: 0 };
          }

          const performerUserId = session.id;
          const assignedToUserId = existingRequest.userId;
          const stockReason = `Requisi\u00e7\u00e3o ${existingRequest.gtmiNumber}`;
          const editReason = `Edi\u00e7\u00e3o: ${stockReason}`;

          const existingProductIds = existingRequest.items.map((it) => it.productId);
          const nextProductIds = replaceItems.map((it) => it.productId);
          const uniqueProductIds = Array.from(new Set([...existingProductIds, ...nextProductIds]));

          const unitCounts = await Promise.all(
            uniqueProductIds.map(async (productId) => {
              const count = await txAny.productUnit.count({ where: { tenantId, productId } });
              return [productId, Number(count)] as const;
            })
          );
          const unitCountByProductId = new Map<string, number>(unitCounts);
          const isUnitTracked = (productId: string) => (unitCountByProductId.get(productId) ?? 0) > 0;

          // === Restore stock for existing items ===
          for (const it of existingRequest.items) {
            const qty = Number(it.quantity);
            if (!Number.isFinite(qty) || qty <= 0) continue;

            if (isUnitTracked(it.productId)) {
              const code = typeof it.destination === "string" ? it.destination.trim() : "";
              if (!code) {
                throw new Error("Cannot restore unit-tracked item without destination code");
              }

              const unit = await txAny.productUnit.findFirst({
                where: { tenantId, productId: it.productId, code },
                select: { id: true, status: true, invoiceId: true, assignedToUserId: true },
              });

              if (!unit || unit.status !== "ACQUIRED") {
                throw new Error("Cannot restore unit (not found or not acquired)");
              }

              await txAny.productUnit.update({
                where: { id: unit.id },
                data: { status: "IN_STOCK", assignedToUserId: null },
                select: { id: true },
              });

              await txAny.stockMovement.create({
                data: {
                  type: "RETURN",
                  quantity: BigInt(1) as any,
                  tenantId,
                  productId: it.productId,
                  unitId: unit.id,
                  invoiceId: unit.invoiceId ?? null,
                  requestId: existingRequest.id,
                  performedByUserId: performerUserId,
                  assignedToUserId: unit.assignedToUserId ?? assignedToUserId,
                  reason: editReason,
                },
                select: { id: true },
              });

              const productAfter = await tx.product.update({
                where: { id: it.productId },
                data: { quantity: { increment: BigInt(1) as any } },
                select: { quantity: true },
              });
              await tx.product.update({
                where: { id: it.productId },
                data: { status: computeProductStatus(Number(productAfter.quantity)) },
              });
            } else {
              await txAny.stockMovement.create({
                data: {
                  type: "IN",
                  quantity: BigInt(qty) as any,
                  tenantId,
                  productId: it.productId,
                  requestId: existingRequest.id,
                  performedByUserId: performerUserId,
                  assignedToUserId,
                  reason: editReason,
                },
                select: { id: true },
              });

              const productAfter = await tx.product.update({
                where: { id: it.productId },
                data: { quantity: { increment: BigInt(qty) as any } },
                select: { quantity: true },
              });
              await tx.product.update({
                where: { id: it.productId },
                data: { status: computeProductStatus(Number(productAfter.quantity)) },
              });
            }
          }

          await tx.requestItem.deleteMany({ where: { requestId: existingRequest.id } });

          // === Validate products for new items ===
          const products = await tx.product.findMany({
            where: { tenantId, id: { in: Array.from(new Set(nextProductIds)) } },
            select: { id: true, quantity: true },
          });
          const productById = new Map(products.map((p) => [p.id, p] as const));
          for (const item of replaceItems) {
            if (!productById.has(item.productId)) {
              throw new Error("One or more products were not found");
            }
          }

          const createdItems: Array<{
            productId: string;
            quantity: number;
            notes?: string | null;
            unit?: string | null;
            reference?: string | null;
            destination?: string | null;
          }> = [];

          // === Allocate stock for new items ===
          for (const item of replaceItems) {
            const qty = Number(item.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
              throw new Error("Invalid quantity");
            }

            if (isUnitTracked(item.productId)) {
              if (qty !== 1) {
                throw new Error("Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade).");
              }

              const requestedCode = typeof item.destination === "string" ? item.destination.trim() : "";

              const unit = requestedCode
                ? await txAny.productUnit.findFirst({
                    where: {
                      tenantId,
                      productId: item.productId,
                      code: requestedCode,
                      status: "IN_STOCK",
                    },
                    select: { id: true, code: true, invoiceId: true },
                  })
                : await txAny.productUnit.findFirst({
                    where: {
                      tenantId,
                      productId: item.productId,
                      status: "IN_STOCK",
                    },
                    orderBy: { createdAt: "asc" },
                    select: { id: true, code: true, invoiceId: true },
                  });

              if (!unit) {
                throw new Error("Sem unidades em stock para um dos produtos selecionados.");
              }

              await txAny.productUnit.updateMany({
                where: { id: unit.id, status: "IN_STOCK" },
                data: {
                  status: "ACQUIRED",
                  acquiredAt: new Date(),
                  acquiredByUserId: performerUserId,
                  assignedToUserId,
                  acquiredReason: stockReason,
                },
              });

              await txAny.stockMovement.create({
                data: {
                  type: "OUT",
                  quantity: BigInt(1) as any,
                  tenantId,
                  productId: item.productId,
                  unitId: unit.id,
                  invoiceId: unit.invoiceId ?? null,
                  requestId: existingRequest.id,
                  performedByUserId: performerUserId,
                  assignedToUserId,
                  reason: stockReason,
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

              createdItems.push({
                productId: item.productId,
                quantity: 1,
                notes: typeof item.notes === "string" ? (item.notes.trim() ? item.notes.trim() : null) : item.notes ?? null,
                unit: typeof item.unit === "string" ? (item.unit.trim() ? item.unit.trim() : null) : item.unit ?? null,
                reference:
                  typeof item.reference === "string" ? (item.reference.trim() ? item.reference.trim() : null) : item.reference ?? null,
                destination: unit.code,
              });
            } else {
              const product = await tx.product.findUnique({ where: { id: item.productId }, select: { quantity: true } });
              const currentQty = Number(product?.quantity ?? BigInt(0));
              if (currentQty < qty) {
                throw new Error("Stock insuficiente para um dos produtos selecionados.");
              }

              await txAny.stockMovement.create({
                data: {
                  type: "OUT",
                  quantity: BigInt(qty) as any,
                  tenantId,
                  productId: item.productId,
                  requestId: existingRequest.id,
                  performedByUserId: performerUserId,
                  assignedToUserId,
                  reason: stockReason,
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

              createdItems.push({
                productId: item.productId,
                quantity: qty,
                notes: typeof item.notes === "string" ? (item.notes.trim() ? item.notes.trim() : null) : item.notes ?? null,
                unit: typeof item.unit === "string" ? (item.unit.trim() ? item.unit.trim() : null) : item.unit ?? null,
                reference:
                  typeof item.reference === "string" ? (item.reference.trim() ? item.reference.trim() : null) : item.reference ?? null,
                destination:
                  typeof item.destination === "string" ? (item.destination.trim() ? item.destination.trim() : null) : item.destination ?? null,
              });
            }
          }

          await tx.requestItem.createMany({
            data: createdItems.map((it) => ({
              requestId: existingRequest.id,
              productId: it.productId,
              quantity: BigInt(it.quantity) as any,
              notes: it.notes ?? null,
              unit: it.unit ?? null,
              reference: it.reference ?? null,
              destination: it.destination ?? null,
            })),
          });
        }

        return { updatedCount: updatedRequest.count };
      });

      if (updated.updatedCount === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      const request = await prisma.request.findFirst({
        where: { id, tenantId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          signedBy: { select: { id: true, name: true, email: true } },
          signedVoidedBy: { select: { id: true, name: true, email: true } },
          pickupRecordedBy: { select: { id: true, name: true, email: true } },
          pickupVoidedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      // Keep a signed PDF in storage when the pickup signature exists.
      // If the pickup signature is voided, remove the generated PDF.
      let pdfGeneratedPickup: boolean | undefined;
      let pdfGeneratedApproval: boolean | undefined;
      let pdfErrorPickup: string | undefined;
      let pdfErrorApproval: string | undefined;
      try {
        if (voidPickupSign) {
          await deleteSystemRequestPdfs({ tenantId, requestId: request.id, gtmiNumber: request.gtmiNumber });
          pdfGeneratedPickup = false;
        }

        if (pickupSign) {
          await deleteSystemRequestPdfs({ tenantId, requestId: request.id, gtmiNumber: request.gtmiNumber });
          await createSystemRequestPdf({ tenantId, request });
          pdfGeneratedPickup = true;
        }
      } catch (e: any) {
        console.error("request PDF sync error:", e);
        pdfGeneratedPickup = false;
        pdfErrorPickup = typeof e?.message === "string" ? e.message : "Failed to generate pickup PDF";
      }

      try {
        if (voidSign) {
          await deleteSystemRequestApprovalPdfs({
            tenantId,
            requestId: request.id,
            gtmiNumber: request.gtmiNumber,
          });
          pdfGeneratedApproval = false;
        }

        if (sign) {
          await deleteSystemRequestApprovalPdfs({
            tenantId,
            requestId: request.id,
            gtmiNumber: request.gtmiNumber,
          });
          await createSystemRequestApprovalPdf({ tenantId, request });
          pdfGeneratedApproval = true;
        }
      } catch (e: any) {
        console.error("approval PDF sync error:", e);
        pdfGeneratedApproval = false;
        pdfErrorApproval = typeof e?.message === "string" ? e.message : "Failed to generate approval PDF";
      }

      try {
        const fromStatus = existingBefore.status;
        const toStatus = request.status;
        const statusChanged = fromStatus !== toStatus;

        if (statusChanged) {
          await createRequestStatusAudit({
            tenantId,
            requestId: request.id,
            fromStatus,
            toStatus,
            changedByUserId: session.id,
            source: "api/requests/[id]:PATCH",
            note:
              typeof parsed.data.notes === "string" && parsed.data.notes.trim()
                ? parsed.data.notes.trim()
                : voidSign?.reason || voidPickupSign?.reason || null,
          });

          await notifyAdmin({
            tenantId,
            kind: "REQUEST_STATUS_CHANGED",
            title: `Estado alterado: ${request.gtmiNumber}`,
            message: `${fromStatus} -> ${toStatus}`,
            requestId: request.id,
            data: { fromStatus, toStatus, requestId: request.id, gtmiNumber: request.gtmiNumber },
          });

          if (request.userId) {
            await notifyUser({
              tenantId,
              recipientUserId: request.userId,
              kind: "REQUEST_STATUS_CHANGED",
              title: `Atualização do pedido ${request.gtmiNumber}`,
              message: `O estado mudou para ${toStatus}.`,
              requestId: request.id,
              data: { fromStatus, toStatus, requestId: request.id, gtmiNumber: request.gtmiNumber },
            });
          }

          publishRealtimeEvent({
            type: "request.status_changed",
            tenantId,
            audience: "ALL",
            userId: request.userId,
            payload: {
              requestId: request.id,
              gtmiNumber: request.gtmiNumber,
              fromStatus,
              toStatus,
              at: new Date().toISOString(),
            },
          });
        } else if (Object.keys(updateData).length > 0 || Boolean(items?.length) || Boolean(replaceItems)) {
          await notifyAdmin({
            tenantId,
            kind: "REQUEST_UPDATED",
            title: `Pedido atualizado: ${request.gtmiNumber}`,
            message: "Foi aplicada uma atualização na requisição.",
            requestId: request.id,
            data: { requestId: request.id, gtmiNumber: request.gtmiNumber },
          });
          publishRealtimeEvent({
            type: "request.updated",
            tenantId,
            audience: "ALL",
            userId: request.userId,
            payload: {
              requestId: request.id,
              gtmiNumber: request.gtmiNumber,
              status: request.status,
              at: new Date().toISOString(),
            },
          });
        }
      } catch (notifyError) {
        console.error("PATCH /api/requests/[id] notify/audit error:", notifyError);
      }

      return res.status(200).json({
        ...request,
        pdfGeneratedPickup,
        pdfGeneratedApproval,
        pdfErrorPickup,
        pdfErrorApproval,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
        expectedDeliveryFrom: request.expectedDeliveryFrom
          ? request.expectedDeliveryFrom.toISOString()
          : null,
        expectedDeliveryTo: request.expectedDeliveryTo ? request.expectedDeliveryTo.toISOString() : null,
        dueAt: (request as any).dueAt ? (request as any).dueAt.toISOString() : null,
        signedAt: request.signedAt ? request.signedAt.toISOString() : null,
        signedVoidedAt: request.signedVoidedAt ? request.signedVoidedAt.toISOString() : null,
        pickupSignedAt: request.pickupSignedAt ? request.pickupSignedAt.toISOString() : null,
        pickupVoidedAt: request.pickupVoidedAt ? request.pickupVoidedAt.toISOString() : null,
        items: request.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      });
    } catch (error: any) {
      if (typeof error?.message === "string") {
        if (error.message === "One or more request items were not found") {
          return res.status(400).json({ error: "One or more request items were not found" });
        }
        if (error.message === "Replace items must include at least one item") {
          return res.status(400).json({ error: "A requisição deve ter pelo menos um item." });
        }
        if (error.message === "One or more products were not found") {
          return res.status(404).json({ error: "One or more products were not found" });
        }
        if (
          error.message === "Stock insuficiente para um dos produtos selecionados." ||
          error.message === "Sem unidades em stock para um dos produtos selecionados." ||
          error.message === "Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade)." ||
          error.message === "Cannot restore unit-tracked item without destination code" ||
          error.message === "Cannot restore unit (not found or not acquired)"
        ) {
          return res.status(400).json({ error: error.message });
        }
      }
      console.error("PATCH /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to update request" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const authz = await canMutateRequest();
      if (!authz.ok) {
        return res.status(authz.status).json({ error: authz.error });
      }

      const deleted = await prisma.request.deleteMany({
        where: isAdmin ? { id, tenantId } : { id, tenantId, userId: session.id },
      });

      if (deleted.count === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      return res.status(204).end();
    } catch (error) {
      console.error("DELETE /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to delete request" });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
