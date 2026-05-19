import fs from "fs";
import path from "path";
import crypto from "crypto";

import { prisma } from "@/prisma/client";
import { buildSignedRequestPdfBuffer } from "@/utils/requestPdf";
import {
  buildRequestFolderName,
  getRequestStorageDir,
  toSafePathSegment,
} from "@/utils/storageLayout";

const ensureDir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

function getSystemRequestPdfOriginalName(gtmiNumber: string) {
  return `[SISTEMA] Requisição ${gtmiNumber} - Assinada.pdf`;
}

function getSystemRequestApprovalPdfOriginalName(gtmiNumber: string) {
  return `[SISTEMA] Requisição ${gtmiNumber} - Aprovada.pdf`;
}

function getLisbonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? date.getFullYear()),
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

function formatLisbonDateYmd(date: Date) {
  const parts = getLisbonDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getCurrentLisbonYear(date: Date) {
  return getLisbonDateParts(date).year;
}

function getSystemFinalRequestPdfPrefix(gtmiNumber: string) {
  return `${gtmiNumber} - `;
}

function getSystemFinalRequestPdfOriginalName(request: any, generatedAt: Date) {
  const signerName =
    request.pickupSignedByName?.trim() ||
    request.requesterName?.trim() ||
    request.user?.name?.trim() ||
    "Funcionario";
  return `${request.gtmiNumber} - ${signerName} - ${formatLisbonDateYmd(generatedAt)}.pdf`;
}

function buildSystemFinalRequestPdfFileName(originalName: string) {
  const ext = path.extname(originalName) || ".pdf";
  const base = path.basename(originalName, ext);
  return `${toSafePathSegment(base, "Pedido assinado").slice(0, 150)}${ext}`;
}

export function requestHasFinalSignatures(request: any) {
  return (
    Boolean(request.signedAt) &&
    Boolean(request.pickupSignedAt) &&
    Boolean(request.signedSignatureDataUrl) &&
    Boolean(request.pickupSignatureDataUrl) &&
    !request.signedVoidedAt &&
    !request.pickupVoidedAt
  );
}

export async function deleteFinalSignedRequestPdfs(args: {
  tenantId: string;
  requestId: string;
  gtmiNumber: string;
}) {
  const signedOriginalName = getSystemRequestPdfOriginalName(args.gtmiNumber);
  const approvalOriginalName = getSystemRequestApprovalPdfOriginalName(args.gtmiNumber);
  const finalOriginalNamePrefix = getSystemFinalRequestPdfPrefix(args.gtmiNumber);
  const rows = await prisma.storedFile.findMany({
    where: {
      tenantId: args.tenantId,
      kind: "REQUEST",
      requestId: args.requestId,
      mimeType: "application/pdf",
      OR: [
        { originalName: signedOriginalName },
        { originalName: approvalOriginalName },
        { originalName: { startsWith: finalOriginalNamePrefix } },
      ],
    },
    select: { id: true, storagePath: true },
  });

  for (const row of rows) {
    const absPath = path.join(process.cwd(), row.storagePath);
    try {
      await fs.promises.unlink(absPath);
    } catch {
      // The DB row is authoritative enough here; a missing file should not block cleanup.
    }
  }

  if (rows.length) {
    await prisma.storedFile.deleteMany({
      where: { id: { in: rows.map((row) => row.id) }, tenantId: args.tenantId },
    });
  }
}

export async function createFinalSignedRequestPdf(args: {
  tenantId: string;
  request: any;
}) {
  const request = args.request;
  const generatedAt = new Date();
  const folderName = buildRequestFolderName({
    gtmiNumber: request.gtmiNumber,
    requesterName: request.requesterName ?? request.user?.name,
    summary: request.title,
    requestedAt: request.requestedAt,
  });
  const destDir = getRequestStorageDir({
    tenantId: args.tenantId,
    gtmiYear: getCurrentLisbonYear(generatedAt),
    folderName,
  });
  await ensureDir(destDir);

  const id = crypto.randomUUID();
  const originalName = getSystemFinalRequestPdfOriginalName(request, generatedAt);
  const fileName = buildSystemFinalRequestPdfFileName(originalName);
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
    signedSignatureDataUrl: request.signedSignatureDataUrl,
    pickupSignedAt: request.pickupSignedAt,
    pickupSignedByName: request.pickupSignedByName,
    pickupSignedByTitle: request.pickupSignedByTitle,
    pickupSignatureDataUrl: request.pickupSignatureDataUrl,
    appOrigin: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "",
    items: request.items,
  });

  await fs.promises.writeFile(absPath, pdfBuffer);
  const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");

  try {
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
        sha256,
      },
    });
  } catch (error) {
    try {
      await fs.promises.unlink(absPath);
    } catch {
      // keep the original DB error
    }
    throw error;
  }
}

export async function syncFinalSignedRequestPdf(args: {
  tenantId: string;
  request: any;
  signatureChanged: boolean;
}) {
  if (!args.signatureChanged) return undefined;

  await deleteFinalSignedRequestPdfs({
    tenantId: args.tenantId,
    requestId: args.request.id,
    gtmiNumber: args.request.gtmiNumber,
  });

  if (!requestHasFinalSignatures(args.request)) return false;

  await createFinalSignedRequestPdf({
    tenantId: args.tenantId,
    request: args.request,
  });

  return true;
}
