import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { buildSignedRequestPdfBuffer } from "@/utils/requestPdf";
import {
  buildRequestFolderName,
  buildStoredFileName,
  getRequestStorageDir,
} from "@/utils/storageLayout";

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
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(1000).optional(),
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
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      return res.status(200).json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
        expectedDeliveryFrom: request.expectedDeliveryFrom
          ? request.expectedDeliveryFrom.toISOString()
          : null,
        expectedDeliveryTo: request.expectedDeliveryTo ? request.expectedDeliveryTo.toISOString() : null,
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
      const { sign, pickupSign, voidSign, voidPickupSign, ...rest } = parsed.data;
      const updateData: any = { ...rest };

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

      const updated = await prisma.request.updateMany({
        where: { id, tenantId },
        data: updateData,
      });

      if (updated.count === 0) {
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
    } catch (error) {
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
