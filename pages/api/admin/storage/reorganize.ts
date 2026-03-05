import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";
import { applyRateLimit } from "@/utils/rateLimit";
import { notifyAdmin } from "@/utils/notifications";
import { publishRealtimeEvent } from "@/utils/realtime";
import {
  buildInvoiceFolderName,
  buildProductFolderName,
  buildRequestFolderName,
  buildStoredFileName,
  getProductInvoiceStorageDir,
  getRequestStorageDir,
  toSafePathSegment,
} from "@/utils/storageLayout";

const bodySchema = z.object({
  dryRun: z.boolean().optional().default(true),
  limit: z.number().int().positive().max(5000).optional().default(1000),
  kinds: z.array(z.enum(["INVOICE", "REQUEST", "DOCUMENT", "OTHER"])).optional(),
  includeUnlinked: z.boolean().optional().default(true),
  renameFiles: z.boolean().optional().default(false),
});

const ensureDir = async (dir: string) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

const moveFile = async (from: string, to: string) => {
  try {
    await fs.promises.rename(from, to);
  } catch (error: any) {
    if (error?.code !== "EXDEV") throw error;
    await fs.promises.copyFile(from, to);
    await fs.promises.unlink(from);
  }
};

function isSubPath(parentDir: string, candidate: string) {
  const rel = path.relative(parentDir, candidate);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const rl = await applyRateLimit(req, res, {
    windowMs: 60_000,
    max: 20,
    keyPrefix: "admin-storage-reorganize",
  });
  if (!rl.ok) {
    return res.status(429).json({ error: "Too many requests. Please try again later." });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { dryRun, limit, kinds, includeUnlinked, renameFiles } = parsed.data;
  const tenantId = session.tenantId;

  try {
    const files = await prisma.storedFile.findMany({
      where: {
        tenantId,
        ...(kinds?.length ? { kind: { in: kinds } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        originalName: true,
        fileName: true,
        storagePath: true,
        sizeBytes: true,
        createdAt: true,
        requestId: true,
        invoiceId: true,
      },
    });

    const requestIds = Array.from(
      new Set(files.filter((f) => f.kind === "REQUEST" && f.requestId).map((f) => f.requestId!))
    );
    const invoiceIds = Array.from(
      new Set(files.filter((f) => f.kind === "INVOICE" && f.invoiceId).map((f) => f.invoiceId!))
    );

    const invoices = invoiceIds.length
      ? await prisma.productInvoice.findMany({
          where: { tenantId, id: { in: invoiceIds } },
          select: {
            id: true,
            invoiceNumber: true,
            issuedAt: true,
            requestId: true,
            product: { select: { sku: true, name: true } },
          },
        })
      : [];

    const requestIdsFromInvoices = invoices
      .map((i) => i.requestId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);

    const allRequestIds = Array.from(new Set([...requestIds, ...requestIdsFromInvoices]));

    const requests = allRequestIds.length
      ? await prisma.request.findMany({
          where: { tenantId, id: { in: allRequestIds } },
          select: {
            id: true,
            gtmiNumber: true,
            gtmiYear: true,
            requestedAt: true,
            requesterName: true,
            title: true,
            user: { select: { name: true } },
          },
        })
      : [];

    const requestById = new Map(requests.map((r) => [r.id, r] as const));
    const invoiceById = new Map(invoices.map((i) => [i.id, i] as const));

    const storageRoot = path.join(process.cwd(), "storage", tenantId);

    const results: Array<{
      id: string;
      kind: string;
      from: string;
      to: string;
      action: "moved" | "skipped" | "missing" | "error";
      reason?: string;
    }> = [];

    let moved = 0;
    let skipped = 0;
    let missing = 0;
    let errored = 0;

    for (const f of files) {
      const absFrom = path.join(process.cwd(), f.storagePath);

      if (!f.storagePath || !isSubPath(process.cwd(), absFrom)) {
        errored += 1;
        results.push({
          id: f.id,
          kind: f.kind,
          from: f.storagePath,
          to: "",
          action: "error",
          reason: "Invalid storagePath",
        });
        continue;
      }

      if (!fs.existsSync(absFrom)) {
        missing += 1;
        results.push({
          id: f.id,
          kind: f.kind,
          from: f.storagePath,
          to: "",
          action: "missing",
          reason: "File missing on disk",
        });
        continue;
      }

      let destDir: string | null = null;
      let destFileName = renameFiles
        ? buildStoredFileName({ originalName: f.originalName, id: f.id })
        : path.basename(f.fileName);

      // Always ensure the filename is a safe segment.
      destFileName = toSafePathSegment(destFileName, f.id);

      if (f.kind === "REQUEST") {
        const reqRow = f.requestId ? requestById.get(f.requestId) : null;
        if (!reqRow) {
          if (!includeUnlinked) {
            skipped += 1;
            results.push({
              id: f.id,
              kind: f.kind,
              from: f.storagePath,
              to: "",
              action: "skipped",
              reason: "No request linked",
            });
            continue;
          }
          const year = f.createdAt.getFullYear();
          destDir = path.join(storageRoot, String(year), "REQUISICOES", "SEM-LIGACAO");
        } else {
          const folderName = buildRequestFolderName({
            gtmiNumber: reqRow.gtmiNumber,
            requesterName: reqRow.requesterName ?? reqRow.user?.name,
            summary: reqRow.title,
            requestedAt: reqRow.requestedAt,
          });
          destDir = getRequestStorageDir({
            tenantId,
            gtmiYear: reqRow.gtmiYear,
            folderName,
          });
        }
      } else if (f.kind === "INVOICE") {
        const invRow = f.invoiceId ? invoiceById.get(f.invoiceId) : null;
        if (!invRow) {
          if (!includeUnlinked) {
            skipped += 1;
            results.push({
              id: f.id,
              kind: f.kind,
              from: f.storagePath,
              to: "",
              action: "skipped",
              reason: "No invoice linked",
            });
            continue;
          }
          const year = f.createdAt.getFullYear();
          destDir = path.join(storageRoot, String(year), "PRODUTOS", "SEM-LIGACAO", "FATURAS");
        } else {
          const invoiceFolderName = buildInvoiceFolderName({
            invoiceNumber: invRow.invoiceNumber,
            issuedAt: invRow.issuedAt,
          });

          const linkedReq = invRow.requestId ? requestById.get(invRow.requestId) : null;
          if (linkedReq) {
            const reqFolderName = buildRequestFolderName({
              gtmiNumber: linkedReq.gtmiNumber,
              requesterName: linkedReq.requesterName ?? linkedReq.user?.name,
              summary: linkedReq.title,
              requestedAt: linkedReq.requestedAt,
            });
            const requestDir = getRequestStorageDir({
              tenantId,
              gtmiYear: linkedReq.gtmiYear,
              folderName: reqFolderName,
            });
            destDir = path.join(requestDir, "FATURAS", invoiceFolderName);
          } else {
            const productFolderName = buildProductFolderName({
              sku: invRow.product.sku,
              name: invRow.product.name,
            });
            destDir = getProductInvoiceStorageDir({
              tenantId,
              year: invRow.issuedAt.getFullYear(),
              productFolderName,
              invoiceFolderName,
            });
          }
        }
      } else if (f.kind === "DOCUMENT") {
        if (!includeUnlinked) {
          skipped += 1;
          results.push({
            id: f.id,
            kind: f.kind,
            from: f.storagePath,
            to: "",
            action: "skipped",
            reason: "Unlinked kind excluded",
          });
          continue;
        }
        const year = f.createdAt.getFullYear();
        destDir = path.join(storageRoot, String(year), "DOCUMENTOS");
      } else if (f.kind === "OTHER") {
        if (!includeUnlinked) {
          skipped += 1;
          results.push({
            id: f.id,
            kind: f.kind,
            from: f.storagePath,
            to: "",
            action: "skipped",
            reason: "Unlinked kind excluded",
          });
          continue;
        }
        const year = f.createdAt.getFullYear();
        destDir = path.join(storageRoot, String(year), "OUTROS");
      }

      if (!destDir) {
        skipped += 1;
        results.push({
          id: f.id,
          kind: f.kind,
          from: f.storagePath,
          to: "",
          action: "skipped",
          reason: "No destination computed",
        });
        continue;
      }

      const absTo = path.join(destDir, destFileName);
      const relTo = path.relative(process.cwd(), absTo);

      if (path.resolve(absFrom) === path.resolve(absTo)) {
        skipped += 1;
        results.push({ id: f.id, kind: f.kind, from: f.storagePath, to: relTo, action: "skipped" });
        continue;
      }

      if (!dryRun) {
        await ensureDir(destDir);

        let finalAbsTo = absTo;
        if (fs.existsSync(finalAbsTo)) {
          const ext = path.extname(destFileName);
          const base = path.basename(destFileName, ext);
          finalAbsTo = path.join(destDir, `${base}-${f.id}${ext}`);
        }

        await moveFile(absFrom, finalAbsTo);

        const finalRel = path.relative(process.cwd(), finalAbsTo);
        try {
          await prisma.storedFile.update({
            where: { id: f.id },
            data: {
              storagePath: finalRel,
              fileName: path.basename(finalAbsTo),
            },
          });
        } catch (dbErr) {
          // Best-effort rollback.
          try {
            await moveFile(finalAbsTo, absFrom);
          } catch {
            // ignore
          }
          throw dbErr;
        }

        moved += 1;
        results.push({ id: f.id, kind: f.kind, from: f.storagePath, to: finalRel, action: "moved" });
      } else {
        moved += 1;
        results.push({ id: f.id, kind: f.kind, from: f.storagePath, to: relTo, action: "moved" });
      }
    }

    const response = {
      dryRun,
      tenantId,
      processed: files.length,
      moved,
      skipped,
      missing,
      errored,
      preview: results.slice(0, 200),
      note: dryRun
        ? "This was a dry-run. Re-run with { dryRun: false } to apply changes."
        : "Reorganization applied.",
    };

    if (!dryRun && (errored > 0 || missing > 10)) {
      try {
        await notifyAdmin({
          tenantId,
          kind: "STORAGE_ALERT",
          title: "Alerta de storage após reorganização",
          message: `Erros: ${errored}, em falta: ${missing}, movidos: ${moved}.`,
          data: { processed: files.length, moved, skipped, missing, errored },
        });
      } catch (alertError) {
        console.warn("Storage alert notification failed:", alertError);
      }
    }

    publishRealtimeEvent({
      type: "storage.reorg.done",
      tenantId,
      audience: "ADMIN",
      payload: response,
    });

    return res.status(200).json(response);
  } catch (error: any) {
    console.error("POST /api/admin/storage/reorganize error:", error);
    const message = typeof error?.message === "string" ? error.message : "Failed to reorganize storage";
    return res.status(500).json({ error: message });
  }
}
