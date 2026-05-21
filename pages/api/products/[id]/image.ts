import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { IncomingForm } from "formidable";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import {
  buildProductFolderName,
  buildStoredFileName,
  getProductStorageDir,
} from "@/utils/storageLayout";

export const config = {
  api: {
    bodyParser: false,
  },
};

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

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

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const productId = req.query.id;
  if (typeof productId !== "string") {
    return res.status(400).json({ error: "Invalid product id" });
  }

  const tenantId = session.tenantId;
  let movedPath: string | null = null;

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      select: {
        id: true,
        name: true,
        sku: true,
        createdAt: true,
        category: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const form = new IncomingForm({
      multiples: false,
      maxFileSize: 8 * 1024 * 1024,
    });

    const { files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const upload = (files.file ?? files.image ?? files.upload) as any;
    if (!upload) {
      return res.status(400).json({ error: "image file is required" });
    }

    const file = Array.isArray(upload) ? upload[0] : upload;
    const tempPath: string = file.filepath;
    const originalName: string = file.originalFilename || "produto";
    const mimeType: string = file.mimetype || "application/octet-stream";
    const sizeBytes: number = Number(file.size || 0);

    if (!tempPath || !fs.existsSync(tempPath)) {
      return res.status(400).json({ error: "Invalid upload" });
    }

    const ext = path.extname(originalName).toLowerCase();
    if (!allowedExtensions.has(ext) || !allowedMimeTypes.has(mimeType)) {
      return res.status(400).json({ error: "Só são permitidas imagens PNG, JPG ou WEBP." });
    }

    const productFolderName = buildProductFolderName({
      sku: product.sku,
      name: product.name,
      categoryName: product.category?.name,
      supplierName: product.supplier?.name,
      createdAt: product.createdAt,
    });
    const destDir = path.join(
      getProductStorageDir({ tenantId, folderName: productFolderName }),
      "Imagens"
    );
    await ensureDir(destDir);

    const id = crypto.randomUUID();
    const safeOriginalName = `Imagem produto - ${product.name}${ext}`;
    const fileName = buildStoredFileName({ originalName: safeOriginalName, id });
    const destPath = path.join(destDir, fileName);
    const sha256 = await hashFileSha256(tempPath);

    await moveFile(tempPath, destPath);
    movedPath = destPath;

    const stored = await prisma.storedFile.create({
      data: {
        id,
        tenantId,
        kind: "OTHER",
        originalName: safeOriginalName,
        fileName,
        mimeType,
        sizeBytes,
        storagePath: path.relative(process.cwd(), destPath),
        sha256,
      },
    });

    const imageUrl = `/api/storage/${stored.id}`;
    const updated = await (prisma as any).product.update({
      where: { id: product.id },
      data: { imageUrl },
    });

    return res.status(200).json({
      imageUrl,
      product: {
        ...updated,
        quantity: Number(updated.quantity),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (movedPath) {
      try {
        await fs.promises.unlink(movedPath);
      } catch {
        // best-effort cleanup
      }
    }
    console.error("POST /api/products/[id]/image error:", error);
    return res.status(500).json({ error: error?.message || "Failed to upload product image" });
  }
}
