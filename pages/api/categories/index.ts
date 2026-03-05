import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
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

  const isAdmin = session.role === "ADMIN";

  const { method } = req;
  const tenantId = session.tenantId;

  switch (method) {
    case "POST":
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const name = String(req.body?.name ?? "").trim();
        if (!name) {
          return res.status(400).json({ error: "Name is required" });
        }
        const category = await prisma.category.create({
          data: {
            name,
            tenantId,
          },
        });
        res.status(201).json(category);
      } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ error: "Failed to create category" });
      }
      break;
    case "GET":
      try {
        const categories = await prisma.category.findMany({
          where: { tenantId },
          orderBy: { name: "asc" },
        });
        res.status(200).json(categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
      }
      break;
    case "PUT":
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const { id, name } = req.body;

        if (!id || !String(name ?? "").trim()) {
          return res.status(400).json({ error: "ID and name are required" });
        }

        const normalizedName = String(name).trim();

        const updated = await prisma.category.updateMany({
          where: { id, tenantId },
          data: { name: normalizedName },
        });

        if (updated.count === 0) {
          return res.status(404).json({ error: "Category not found" });
        }

        const updatedCategory = await prisma.category.findFirst({
          where: { id, tenantId },
        });

        res.status(200).json(updatedCategory);
      } catch (error) {
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Failed to update category" });
      }
      break;
    case "DELETE":
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const { id } = req.body;

        const deleted = await prisma.category.deleteMany({
          where: { id, tenantId },
        });

        if (deleted.count === 0) {
          return res.status(404).json({ error: "Category not found" });
        }

        res.status(204).end();
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
          return res.status(409).json({ error: "Não é possível remover: existem produtos associados." });
        }
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Failed to delete category" });
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
