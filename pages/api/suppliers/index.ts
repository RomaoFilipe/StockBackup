import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const supplierCreateSchema = z.object({
  name: z.string().min(1).max(200),
  nif: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(60).optional(),
  contactName: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

const supplierUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  nif: z.string().max(30).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  contactName: z.string().max(120).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

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
        const parsed = supplierCreateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request body" });
        }

        const name = parsed.data.name.trim();
        const nif = parsed.data.nif?.trim() || null;
        const email = parsed.data.email?.trim() || null;
        const phone = parsed.data.phone?.trim() || null;
        const contactName = parsed.data.contactName?.trim() || null;
        const address = parsed.data.address?.trim() || null;
        const notes = parsed.data.notes?.trim() || null;
        const isActive = parsed.data.isActive ?? true;

        const supplier = await prisma.supplier.create({
          data: {
            name,
            nif,
            email,
            phone,
            contactName,
            address,
            notes,
            isActive,
            tenantId,
          },
        });
        res.status(201).json(supplier);
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "Fornecedor já existe" });
        }
        console.error("Error creating supplier:", error);
        res.status(500).json({ error: "Failed to create supplier" });
      }
      break;
    case "GET":
      try {
        const includeInactive = req.query.includeInactive === "1" && isAdmin;
        const suppliers = await prisma.supplier.findMany({
          where: includeInactive ? { tenantId } : { tenantId, isActive: true },
          orderBy: { name: "asc" },
        });
        res.status(200).json(suppliers);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        res.status(500).json({ error: "Failed to fetch suppliers" });
      }
      break;
    case "PUT":
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const parsed = supplierUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request body" });
        }

        const id = parsed.data.id;

        const data: any = {};
        if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
        if (parsed.data.nif !== undefined) data.nif = parsed.data.nif ? parsed.data.nif.trim() : null;
        if (parsed.data.email !== undefined) data.email = parsed.data.email ? parsed.data.email.trim() : null;
        if (parsed.data.phone !== undefined) data.phone = parsed.data.phone ? parsed.data.phone.trim() : null;
        if (parsed.data.contactName !== undefined) data.contactName = parsed.data.contactName ? parsed.data.contactName.trim() : null;
        if (parsed.data.address !== undefined) data.address = parsed.data.address ? parsed.data.address.trim() : null;
        if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ? parsed.data.notes.trim() : null;
        if (typeof parsed.data.isActive === "boolean") data.isActive = parsed.data.isActive;

        if (Object.keys(data).length === 0) {
          return res.status(400).json({ error: "No fields to update" });
        }

        const updated = await prisma.supplier.updateMany({
          where: { id, tenantId },
          data,
        });

        if (updated.count === 0) {
          return res.status(404).json({ error: "Supplier not found" });
        }

        const updatedSupplier = await prisma.supplier.findFirst({
          where: { id, tenantId },
        });

        res.status(200).json(updatedSupplier);
      } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "Fornecedor já existe" });
        }
        console.error("Error updating supplier:", error);
        res.status(500).json({ error: "Failed to update supplier" });
      }
      break;
    case "DELETE":
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      try {
        const { id } = req.body;

        const deleted = await prisma.supplier.deleteMany({
          where: { id, tenantId },
        });

        if (deleted.count === 0) {
          return res.status(404).json({ error: "Supplier not found" });
        }

        res.status(204).end();
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
          return res.status(409).json({ error: "Não é possível remover: existem produtos associados." });
        }
        console.error("Error deleting supplier:", error);
        res.status(500).json({ error: "Failed to delete supplier" });
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
