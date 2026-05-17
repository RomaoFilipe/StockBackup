import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { IncomingForm } from "formidable";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import {
  buildProductFolderName,
  buildRequestFolderName,
  buildStockDocumentBaseName,
  buildStoredFileName,
  getProductInvoiceStorageDir,
  getRequestStorageDir,
} from "@/utils/storageLayout";

export const config = {
  api: {
    bodyParser: false,
  },
};

const kindSchema = z.enum(["INVOICE", "REQUEST", "DOCUMENT", "OTHER"]);
const documentRoleSchema = z.enum(["FATURA", "REQ"]);
const allowedExtensions = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".csv", ".xls", ".xlsx", ".doc", ".docx"]);
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/octet-stream",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ensureDir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

const moveFile = async (from: string, to: string) => {
  try {
    await fs.promises.rename(from, to);
  } catch (error: any) {
    // EXDEV can happen if temp upload dir is on another device.
    if (error?.code !== "EXDEV") throw error;
    await fs.promises.copyFile(from, to);
    await fs.promises.unlink(from);
  }
};

const hashFileSha256 = async (filePath: string) => {
  const hash = crypto.createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenantId = session.tenantId;

  if (req.method === "GET") {
    const kind = req.query.kind;
    if (typeof kind !== "string") {
      return res.status(400).json({ error: "kind is required" });
    }
    const parsedKind = kindSchema.safeParse(kind);
    if (!parsedKind.success) {
      return res.status(400).json({ error: "Invalid kind" });
    }

    const invoiceId = typeof req.query.invoiceId === "string" ? req.query.invoiceId : undefined;
    const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;

    try {
      const files = await prisma.storedFile.findMany({
        where: {
          tenantId,
          kind: parsedKind.data,
          invoiceId: invoiceId ?? undefined,
          requestId: requestId ?? undefined,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json(
        files.map((f) => ({
          ...f,
          createdAt: f.createdAt.toISOString(),
          updatedAt: f.updatedAt.toISOString(),
        }))
      );
    } catch (error) {
      console.error("GET /api/storage error:", error);
      return res.status(500).json({ error: "Failed to fetch files" });
    }
  }

  if (req.method === "POST") {
    let movedPath: string | null = null;
    const form = new IncomingForm({
      multiples: false,
      maxFileSize: 25 * 1024 * 1024, // 25MB
    });

    try {
      const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
      });

      const kindValue = Array.isArray(fields.kind) ? fields.kind[0] : fields.kind;
      const parsedKind = kindSchema.safeParse(kindValue);
      if (!parsedKind.success) {
        return res.status(400).json({ error: "Invalid kind" });
      }

      const invoiceId = Array.isArray(fields.invoiceId) ? fields.invoiceId[0] : fields.invoiceId;
      const requestId = Array.isArray(fields.requestId) ? fields.requestId[0] : fields.requestId;
      const documentRoleValue = Array.isArray(fields.documentRole) ? fields.documentRole[0] : fields.documentRole;
      const parsedDocumentRole = documentRoleValue
        ? documentRoleSchema.safeParse(String(documentRoleValue).toUpperCase())
        : null;
      if (parsedDocumentRole && !parsedDocumentRole.success) {
        return res.status(400).json({ error: "Invalid documentRole" });
      }
      const documentRole = parsedDocumentRole?.success ? parsedDocumentRole.data : "FATURA";

      // Only allow linking IDs when kind matches
      if (invoiceId && parsedKind.data !== "INVOICE") {
        return res.status(400).json({ error: "invoiceId only allowed for INVOICE kind" });
      }
      if (requestId && parsedKind.data !== "REQUEST") {
        return res.status(400).json({ error: "requestId only allowed for REQUEST kind" });
      }
      if (documentRoleValue && parsedKind.data !== "INVOICE") {
        return res.status(400).json({ error: "documentRole only allowed for INVOICE kind" });
      }

      const upload = (files.file ?? files.upload ?? files.document) as any;
      if (!upload) {
        return res.status(400).json({ error: "file is required" });
      }

      const file = Array.isArray(upload) ? upload[0] : upload;
      const tempPath: string = file.filepath;
      const originalName: string = file.originalFilename || "file";
      const mimeType: string = file.mimetype || "application/octet-stream";
      const sizeBytes: number = Number(file.size || 0);

      if (!tempPath || !fs.existsSync(tempPath)) {
        return res.status(400).json({ error: "Invalid upload" });
      }

      const originalExt = path.extname(originalName || "").toLowerCase();
      if (!allowedExtensions.has(originalExt)) {
        return res.status(400).json({ error: "Tipo de ficheiro não permitido" });
      }
      if (!allowedMimeTypes.has(mimeType)) {
        return res.status(400).json({ error: "MIME type não permitido" });
      }
      const sha256 = await hashFileSha256(tempPath);

      // Validate ownership of linked entities
      let invoiceMeta:
        | {
            id: string;
            invoiceNumber: string;
            issuedAt: Date;
            reqNumber: string | null;
            reqDate: Date | null;
            createdAt: Date;
            requestId: string | null;
            request: { gtmiNumber: string; requestedAt: Date } | null;
            product: {
              id: string;
              sku: string;
              name: string;
              createdAt: Date;
              category: { name: string } | null;
              supplier: { name: string } | null;
            };
          }
        | null = null;
      if (invoiceId) {
        const inv = await prisma.productInvoice.findFirst({
          where: { id: String(invoiceId), tenantId },
          select: {
            id: true,
            invoiceNumber: true,
            issuedAt: true,
            reqNumber: true,
            reqDate: true,
            createdAt: true,
            requestId: true,
            request: { select: { gtmiNumber: true, requestedAt: true } },
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                createdAt: true,
                category: { select: { name: true } },
                supplier: { select: { name: true } },
              },
            },
          },
        });
        if (!inv) return res.status(404).json({ error: "Invoice not found" });
        invoiceMeta = {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          issuedAt: inv.issuedAt,
          reqNumber: inv.reqNumber ?? inv.request?.gtmiNumber ?? null,
          reqDate: inv.reqDate ?? inv.request?.requestedAt ?? null,
          createdAt: inv.createdAt,
          requestId: inv.requestId ?? null,
          request: inv.request ?? null,
          product: inv.product,
        };
      }

      let requestMeta:
        | {
            id: string;
            gtmiNumber: string;
            gtmiYear: number;
            requestedAt: Date;
            requesterName: string | null;
            title: string | null;
            userName: string | null;
          }
        | null = null;
      if (requestId) {
        const reqRow = await prisma.request.findFirst({
          where: { id: String(requestId), tenantId },
          select: {
            id: true,
            gtmiNumber: true,
            gtmiYear: true,
            requestedAt: true,
            requesterName: true,
            title: true,
            user: { select: { name: true } },
          },
        });
        if (!reqRow) return res.status(404).json({ error: "Request not found" });

        requestMeta = {
          id: reqRow.id,
          gtmiNumber: reqRow.gtmiNumber,
          gtmiYear: reqRow.gtmiYear,
          requestedAt: reqRow.requestedAt,
          requesterName: reqRow.requesterName,
          title: reqRow.title,
          userName: reqRow.user?.name ?? null,
        };
      }

      const originalBase = path.basename(String(originalName));
      const originalForDb = (
        originalBase
          .replace(/[\r\n\0]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180) || "file"
      );

      const id = crypto.randomUUID();

      let destDir: string | null = null;
      if (parsedKind.data === "DOCUMENT") {
        const year = new Date().getFullYear();
        destDir = path.join(process.cwd(), "storage", tenantId, String(year), "DOCUMENTOS");
      }

      if (parsedKind.data === "OTHER") {
        const year = new Date().getFullYear();
        destDir = path.join(process.cwd(), "storage", tenantId, String(year), "OUTROS");
      }

      if (parsedKind.data === "REQUEST" && requestMeta) {
        const folderName = buildRequestFolderName({
          gtmiNumber: requestMeta.gtmiNumber,
          requesterName: requestMeta.requesterName ?? requestMeta.userName,
          summary: requestMeta.title,
          requestedAt: requestMeta.requestedAt,
        });
        destDir = getRequestStorageDir({
          tenantId,
          gtmiYear: requestMeta.gtmiYear,
          folderName,
        });
      }

      if (parsedKind.data === "INVOICE" && invoiceMeta) {
        const productFolderName = buildProductFolderName({
          sku: invoiceMeta.product.sku,
          name: invoiceMeta.product.name,
          categoryName: invoiceMeta.product.category?.name,
          supplierName: invoiceMeta.product.supplier?.name,
          createdAt: invoiceMeta.product.createdAt,
        });
        destDir = getProductInvoiceStorageDir({
          tenantId,
          productFolderName,
          documentRole,
        });
      }

      if (!destDir) {
        destDir = path.join(process.cwd(), "storage", tenantId);
      }

      await ensureDir(destDir);

      const uploadExt = path.extname(originalForDb).slice(0, 16);
      const storageOriginalName =
        parsedKind.data === "INVOICE" && invoiceMeta
          ? `${buildStockDocumentBaseName({
              documentRole,
              invoiceNumber: invoiceMeta.invoiceNumber,
              issuedAt: invoiceMeta.issuedAt,
              reqNumber: invoiceMeta.reqNumber,
              reqDate: invoiceMeta.reqDate,
              importedAt: new Date(),
            })}${uploadExt || ".pdf"}`
          : originalForDb;
      const fileName = buildStoredFileName({ originalName: storageOriginalName, id });
      const destPath = path.join(destDir, fileName);
      await moveFile(tempPath, destPath);
      movedPath = destPath;

      const created = await prisma.storedFile.create({
        data: {
          id,
          tenantId,
          kind: parsedKind.data,
          originalName: storageOriginalName,
          fileName,
          mimeType,
          sizeBytes,
          storagePath: path.relative(process.cwd(), destPath),
          sha256,
          invoiceId: invoiceId ? String(invoiceId) : undefined,
          requestId: requestId ? String(requestId) : undefined,
        },
      });

      return res.status(201).json({
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      });
    } catch (error: any) {
      if (movedPath) {
        try {
          await fs.promises.unlink(movedPath);
        } catch {
          // best-effort cleanup: the DB error is the important response
        }
      }
      console.error("POST /api/storage error:", error);
      const message = typeof error?.message === "string" ? error.message : "Upload failed";
      return res.status(500).json({ error: message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
