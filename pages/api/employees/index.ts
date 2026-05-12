import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const employeeCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phoneOrExtension: z.string().trim().max(60).optional().or(z.literal("")),
  requestingServiceId: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
});

const employeeUpdateSchema = employeeCreateSchema.partial().extend({
  id: z.string().uuid(),
});

const employeeDeleteSchema = z.object({
  id: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!session.tenantId) {
    return res.status(500).json({ error: "Session missing tenant" });
  }

  const isAdmin = session.role === "ADMIN";
  const tenantId = session.tenantId;

  if (req.method === "GET") {
    const includeInactive = req.query.includeInactive === "1" && isAdmin;
    const serviceId = req.query.requestingServiceId ? Number(req.query.requestingServiceId) : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    try {
      const employees = await prisma.employee.findMany({
        where: {
          tenantId,
          ...(includeInactive ? {} : { isActive: true }),
          ...(serviceId && Number.isFinite(serviceId) ? { requestingServiceId: serviceId } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { phoneOrExtension: { contains: q, mode: "insensitive" } },
                  { requestingService: { designacao: { contains: q, mode: "insensitive" } } },
                ],
              }
            : {}),
        },
        orderBy: [{ name: "asc" }],
        include: {
          requestingService: {
            select: { id: true, codigo: true, designacao: true, ativo: true },
          },
        },
      });

      return res.status(200).json(employees);
    } catch (error) {
      console.error("GET /api/employees error:", error);
      return res.status(500).json({ error: "Failed to fetch employees" });
    }
  }

  if (req.method === "POST") {
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const requestingService = await prisma.requestingService.findFirst({
      where: { id: parsed.data.requestingServiceId, ativo: true },
      select: { id: true },
    });
    if (!requestingService) {
      return res.status(400).json({ error: "Departamento inválido" });
    }

    try {
      const employee = await prisma.employee.create({
        data: {
          tenantId,
          name: parsed.data.name.trim(),
          email: parsed.data.email?.trim() || null,
          phoneOrExtension: parsed.data.phoneOrExtension?.trim() || null,
          requestingServiceId: parsed.data.requestingServiceId,
          isActive: parsed.data.isActive ?? true,
        },
        include: {
          requestingService: {
            select: { id: true, codigo: true, designacao: true, ativo: true },
          },
        },
      });
      return res.status(201).json(employee);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Funcionário já existe neste departamento" });
      }
      console.error("POST /api/employees error:", error);
      return res.status(500).json({ error: "Failed to create employee" });
    }
  }

  if (req.method === "PUT") {
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = employeeUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    if (parsed.data.requestingServiceId) {
      const requestingService = await prisma.requestingService.findFirst({
        where: { id: parsed.data.requestingServiceId, ativo: true },
        select: { id: true },
      });
      if (!requestingService) {
        return res.status(400).json({ error: "Departamento inválido" });
      }
    }

    const data: Prisma.EmployeeUncheckedUpdateManyInput = {};
    if (typeof parsed.data.name === "string") data.name = parsed.data.name.trim();
    if (parsed.data.email !== undefined) data.email = parsed.data.email?.trim() || null;
    if (parsed.data.phoneOrExtension !== undefined) data.phoneOrExtension = parsed.data.phoneOrExtension?.trim() || null;
    if (typeof parsed.data.isActive === "boolean") data.isActive = parsed.data.isActive;
    if (typeof parsed.data.requestingServiceId === "number") data.requestingServiceId = parsed.data.requestingServiceId;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    try {
      const updated = await prisma.employee.updateMany({
        where: { id: parsed.data.id, tenantId },
        data,
      });

      if (updated.count === 0) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }

      const employee = await prisma.employee.findFirst({
        where: { id: parsed.data.id, tenantId },
        include: {
          requestingService: {
            select: { id: true, codigo: true, designacao: true, ativo: true },
          },
        },
      });
      return res.status(200).json(employee);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(409).json({ error: "Funcionário já existe neste departamento" });
      }
      console.error("PUT /api/employees error:", error);
      return res.status(500).json({ error: "Failed to update employee" });
    }
  }

  if (req.method === "DELETE") {
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const parsed = employeeDeleteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const deleted = await prisma.employee.deleteMany({
        where: { id: parsed.data.id, tenantId },
      });

      if (deleted.count === 0) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }

      return res.status(204).end();
    } catch (error) {
      console.error("DELETE /api/employees error:", error);
      return res.status(500).json({ error: "Failed to delete employee" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}

export const config = {
  api: {
    externalResolver: true,
  },
};
