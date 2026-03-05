import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const tenantId = session.tenantId;

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid product id" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.status(200).json({
      ...product,
      quantity: Number(product.quantity),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      category: product.category?.name || "Unknown",
      supplier: product.supplier?.name || "Unknown",
    });
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return res.status(500).json({ error: "Failed to fetch product" });
  }
}
