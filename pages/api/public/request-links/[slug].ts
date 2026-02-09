import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug) return res.status(400).json({ error: "slug is required" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const access = await prisma.publicRequestAccess.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      isActive: true,
      requestingService: { select: { id: true, codigo: true, designacao: true, ativo: true } },
    },
  });

  if (!access) return res.status(404).json({ error: "Not found" });

  return res.status(200).json({
    access: { id: access.id, slug: access.slug, isActive: access.isActive },
    requestingService: access.requestingService,
  });
}
