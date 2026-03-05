import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { z } from "zod";

const createServiceSchema = z.object({
  codigo: z.string().min(1).max(10),
  designacao: z.string().min(1).max(200),
  ativo: z.boolean().optional(),
});

async function createServiceWithNextId(args: { codigo: string; designacao: string; ativo: boolean }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const maxId = await tx.requestingService.aggregate({ _max: { id: true } });
        const nextId = (maxId._max.id ?? 0) + 1;
        return tx.requestingService.create({
          data: {
            id: nextId,
            codigo: args.codigo,
            designacao: args.designacao,
            ativo: args.ativo,
          },
          select: { id: true, codigo: true, designacao: true, ativo: true },
        });
      });
    } catch (error: any) {
      const code = error?.code;
      // P2002 unique constraint, P2003 FK constraint (shouldn't happen), retry on collisions
      if (code === "P2002") {
        throw error;
      }
      if (attempt === 4) throw error;
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = session.role === "ADMIN";

  if (req.method === "GET") {
    const includeInactive = req.query.includeInactive === "1" && isAdmin;

    try {
      const services = await prisma.requestingService.findMany({
        where: includeInactive ? undefined : { ativo: true },
        orderBy: [{ codigo: "asc" }],
        select: { id: true, codigo: true, designacao: true, ativo: true },
      });

      return res.status(200).json(services);
    } catch (error) {
      console.error("Error fetching requesting services:", error);
      return res.status(500).json({ error: "Failed to fetch requesting services" });
    }
  }

  if (req.method === "POST") {
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = createServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const codigo = parsed.data.codigo.trim();
    const designacao = parsed.data.designacao.trim();
    const ativo = parsed.data.ativo ?? true;

    try {
      const created = await createServiceWithNextId({ codigo, designacao, ativo });
      return res.status(201).json(created);
    } catch (error: any) {
      if (error?.code === "P2002") {
        return res.status(409).json({ error: "Código já existe" });
      }
      console.error("Error creating requesting service:", error);
      return res.status(500).json({ error: "Failed to create requesting service" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

export const config = {
  api: {
    externalResolver: true,
  },
};
