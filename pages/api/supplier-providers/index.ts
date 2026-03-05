import { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const providerCreateSchema = z.object({
  supplierId: z.string().uuid(),
  name: z.string().min(1).max(200),
  role: z.string().max(120).optional(),
  email: z.string().max(255).optional(),
  phone: z.string().max(60).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

const providerUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(120).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = session.role === "ADMIN";
  const tenantId = session.tenantId;

  switch (req.method) {
    case "GET":
      try {
        const supplierId =
          typeof req.query.supplierId === "string" && req.query.supplierId ? req.query.supplierId : undefined;
        const includeInactive = req.query.includeInactive === "1" && isAdmin;
        const providers = await prisma.supplierProvider.findMany({
          where: {
            tenantId,
            ...(supplierId ? { supplierId } : {}),
            ...(includeInactive ? {} : { isActive: true }),
          },
          include: {
            supplier: { select: { id: true, name: true } },
          },
          orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
        });
        return res.status(200).json(providers);
      } catch (error) {
        console.error("Error fetching supplier providers:", error);
        return res.status(500).json({ error: "Failed to fetch supplier providers" });
      }

    case "POST":
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
      try {
        const parsed = providerCreateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

        const supplier = await prisma.supplier.findFirst({
          where: { id: parsed.data.supplierId, tenantId },
          select: { id: true },
        });
        if (!supplier) return res.status(404).json({ error: "Fornecedor não encontrado" });

        const created = await prisma.supplierProvider.create({
          data: {
            supplierId: parsed.data.supplierId,
            name: parsed.data.name.trim(),
            role: parsed.data.role?.trim() || null,
            email: parsed.data.email?.trim() || null,
            phone: parsed.data.phone?.trim() || null,
            notes: parsed.data.notes?.trim() || null,
            isActive: parsed.data.isActive ?? true,
            tenantId,
          },
          include: { supplier: { select: { id: true, name: true } } },
        });
        return res.status(201).json(created);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "Prestador já existe para este fornecedor" });
        }
        console.error("Error creating supplier provider:", error);
        return res.status(500).json({ error: "Failed to create supplier provider" });
      }

    case "PUT":
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
      try {
        const parsed = providerUpdateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

        const data: Record<string, unknown> = {};
        if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
        if (parsed.data.role !== undefined) data.role = parsed.data.role ? parsed.data.role.trim() : null;
        if (parsed.data.email !== undefined) data.email = parsed.data.email ? parsed.data.email.trim() : null;
        if (parsed.data.phone !== undefined) data.phone = parsed.data.phone ? parsed.data.phone.trim() : null;
        if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ? parsed.data.notes.trim() : null;
        if (typeof parsed.data.isActive === "boolean") data.isActive = parsed.data.isActive;
        if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });

        const updated = await prisma.supplierProvider.updateMany({
          where: { id: parsed.data.id, tenantId },
          data,
        });
        if (updated.count === 0) return res.status(404).json({ error: "Prestador não encontrado" });

        const row = await prisma.supplierProvider.findFirst({
          where: { id: parsed.data.id, tenantId },
          include: { supplier: { select: { id: true, name: true } } },
        });
        return res.status(200).json(row);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "Prestador já existe para este fornecedor" });
        }
        console.error("Error updating supplier provider:", error);
        return res.status(500).json({ error: "Failed to update supplier provider" });
      }

    case "DELETE":
      if (!isAdmin) return res.status(403).json({ error: "Forbidden" });
      try {
        const id = typeof req.body?.id === "string" ? req.body.id : "";
        if (!id) return res.status(400).json({ error: "id obrigatório" });
        const deleted = await prisma.supplierProvider.deleteMany({ where: { id, tenantId } });
        if (deleted.count === 0) return res.status(404).json({ error: "Prestador não encontrado" });
        return res.status(204).end();
      } catch (error) {
        console.error("Error deleting supplier provider:", error);
        return res.status(500).json({ error: "Failed to delete supplier provider" });
      }

    default:
      res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
