import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid file id" });
  }

  const tenantId = session.tenantId;

  if (req.method === "GET") {
    try {
      const file = await prisma.storedFile.findFirst({
        where: { id, tenantId },
      });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const absPath = path.join(process.cwd(), file.storagePath);
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({ error: "File missing on disk" });
      }

      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Length", String(file.sizeBytes));

      const downloadName = String(file.originalName).replace(/[\r\n\0]/g, " ");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(downloadName)}"`
      );

      const stream = fs.createReadStream(absPath);
      stream.on("error", (err) => {
        console.error("download stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to read file" });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
      return;
    } catch (error) {
      console.error("GET /api/storage/[id] error:", error);
      return res.status(500).json({ error: "Failed to download file" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const file = await prisma.storedFile.findFirst({ where: { id, tenantId } });

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const absPath = path.join(process.cwd(), file.storagePath);
      try {
        await fs.promises.unlink(absPath);
      } catch {
        // ignore if file missing on disk
      }

      await prisma.storedFile.delete({ where: { id: file.id } });
      return res.status(204).end();
    } catch (error) {
      console.error("DELETE /api/storage/[id] error:", error);
      return res.status(500).json({ error: "Failed to delete file" });
    }
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
