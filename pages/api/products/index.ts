import { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { method } = req;
  const tenantId = session.tenantId;

  switch (method) {
    case "POST":
      try {
        const { name, description, sku, price, quantity, status, categoryId, supplierId } =
          req.body;

        // Check if SKU already exists
        const existingProduct = await prisma.product.findUnique({
          where: { sku },
        });

        if (existingProduct) {
          return res.status(400).json({ error: "SKU must be unique" });
        }

        // Ensure category/supplier belong to the same tenant
        const [category, supplier] = await Promise.all([
          prisma.category.findFirst({ where: { id: categoryId, tenantId }, select: { id: true, name: true } }),
          prisma.supplier.findFirst({ where: { id: supplierId, tenantId, isActive: true }, select: { id: true, name: true } }),
        ]);

        if (!category) {
          return res.status(400).json({ error: "Invalid category" });
        }
        if (!supplier) {
          return res.status(400).json({ error: "Invalid supplier" });
        }

        // Use Prisma for product creation to ensure consistency
        const product = await prisma.product.create({
          data: {
            name,
            description: description ?? null,
            sku,
            price,
            quantity: BigInt(quantity) as any,
            status,
            tenantId,
            categoryId,
            supplierId,
            createdAt: new Date(),
          },
        });

        // Return the created product data with category and supplier names
        res.status(201).json({
          id: product.id,
          name: product.name,
          description: product.description,
          sku: product.sku,
          price: product.price,
          quantity: Number(product.quantity),
          status: product.status,
          tenantId: product.tenantId,
          categoryId: product.categoryId,
          supplierId: product.supplierId,
          createdAt: product.createdAt.toISOString(),
          category: category.name,
          supplier: supplier.name,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to create product" });
      }
      break;

    case "GET":
      try {
        const products = await prisma.product.findMany({
          where: { tenantId },
          include: {
            category: { select: { name: true } },
            supplier: { select: { name: true } },
          },
        });

        const transformedProducts = products.map((product) => ({
          ...product,
          quantity: Number(product.quantity),
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          description: product.description ?? null,
          category: product.category?.name || "Unknown",
          supplier: product.supplier?.name || "Unknown",
        }));

        res.status(200).json(transformedProducts);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
      }
      break;

    case "PUT":
      try {
        const {
          id,
          name,
          description,
          sku,
          price,
          quantity,
          status,
          categoryId,
          supplierId,
        } = req.body;

        const existing = await prisma.product.findFirst({
          where: { id, tenantId },
          select: { id: true },
        });

        if (!existing) {
          return res.status(404).json({ error: "Product not found" });
        }

        // Ensure category/supplier belong to the same tenant
        const [category, supplier] = await Promise.all([
          prisma.category.findFirst({ where: { id: categoryId, tenantId }, select: { id: true, name: true } }),
          prisma.supplier.findFirst({ where: { id: supplierId, tenantId, isActive: true }, select: { id: true, name: true } }),
        ]);

        if (!category) {
          return res.status(400).json({ error: "Invalid category" });
        }
        if (!supplier) {
          return res.status(400).json({ error: "Invalid supplier" });
        }

        const updatedProduct = await prisma.product.update({
          where: { id },
          data: {
            name,
            description: description ?? null,
            sku,
            price,
            quantity: BigInt(quantity) as any, // Convert to BigInt for database
            status,
            categoryId,
            supplierId,
          },
        });

        // Return the updated product data with category and supplier names
        res.status(200).json({
          id: updatedProduct.id,
          name: updatedProduct.name,
          description: updatedProduct.description,
          sku: updatedProduct.sku,
          price: updatedProduct.price,
          quantity: Number(updatedProduct.quantity), // Convert BigInt to Number
          status: updatedProduct.status,
          tenantId: updatedProduct.tenantId,
          categoryId: updatedProduct.categoryId,
          supplierId: updatedProduct.supplierId,
          createdAt: updatedProduct.createdAt.toISOString(),
          category: category.name,
          supplier: supplier.name,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to update product" });
      }
      break;

    case "DELETE":
      try {
        const { id } = req.body;

        const deleted = await prisma.product.deleteMany({
          where: { id, tenantId },
        });

        if (deleted.count === 0) {
          return res.status(404).json({ error: "Product not found" });
        }

        res.status(204).end();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
      break;

    default:
      res.setHeader("Allow", ["POST", "GET", "PUT", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
