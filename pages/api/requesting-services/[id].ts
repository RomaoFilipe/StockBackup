import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const updateServiceSchema = z.object({
  codigo: z.string().min(1).max(10).optional(),
  designacao: z.string().min(1).max(200).optional(),
  ativo: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (session.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const idRaw = req.query.id;
  const id = typeof idRaw === "string" ? Number(idRaw) : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const data: { codigo?: string; designacao?: string; ativo?: boolean } = {};
  if (typeof parsed.data.codigo === "string") data.codigo = parsed.data.codigo.trim();
  if (typeof parsed.data.designacao === "string") data.designacao = parsed.data.designacao.trim();
  if (typeof parsed.data.ativo === "boolean") data.ativo = parsed.data.ativo;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  try {
    const updated = await prisma.requestingService.update({
      where: { id },
      data,
      select: { id: true, codigo: true, designacao: true, ativo: true },
    });

    return res.status(200).json(updated);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "Código já existe" });
    }

    console.error("PATCH /api/requesting-services/[id] error:", error);
    return res.status(500).json({ error: "Failed to update requesting service" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
