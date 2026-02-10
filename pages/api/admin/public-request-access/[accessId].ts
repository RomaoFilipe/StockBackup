import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const patchSchema = z.object({
  isActive: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const accessId = typeof req.query.accessId === "string" ? req.query.accessId : "";
  if (!accessId) return res.status(400).json({ error: "accessId is required" });

  try {
    const existing = await prisma.publicRequestAccess.findFirst({
      where: { id: accessId, tenantId: session.tenantId },
      select: { id: true, isActive: true },
    });

    if (!existing) {
      return res.status(404).json({ error: "Not found" });
    }

    if (req.method === "PATCH") {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

      const updated = await prisma.publicRequestAccess.update({
        where: { id: accessId },
        data: { isActive: parsed.data.isActive },
        select: { id: true, isActive: true },
      });

      return res.status(200).json(updated);
    }

    if (req.method === "DELETE") {
      const hardParam = req.query.hard;
      const hard =
        hardParam === "1" ||
        hardParam === "true" ||
        (Array.isArray(hardParam) && (hardParam[0] === "1" || hardParam[0] === "true"));

      if (hard) {
        const requestsCount = await prisma.publicRequest.count({
          where: { tenantId: session.tenantId, accessId },
        });

        if (requestsCount > 0) {
          return res.status(409).json({
            error: "Não é possível remover: existem pedidos associados. Use desativar para manter histórico.",
          });
        }

        const deleted = await prisma.publicRequestAccess.deleteMany({
          where: { id: accessId, tenantId: session.tenantId },
        });

        if (!deleted.count) {
          return res.status(404).json({ error: "Not found" });
        }

        return res.status(204).end();
      }

      // Soft-remove: keep the link record and keep PublicRequests history.
      await prisma.publicRequestAccess.update({
        where: { id: accessId },
        data: { isActive: false },
        select: { id: true },
      });
      return res.status(204).end();
    }

    res.setHeader("Allow", ["PATCH", "DELETE"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error) {
    console.error("/api/admin/public-request-access/[accessId] error:", error);
    return res.status(500).json({ error: "Failed to update public request link" });
  }
}
