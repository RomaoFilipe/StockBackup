import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const updateSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "FULFILLED"]).optional(),
  title: z.string().min(1).max(120).optional(),
  notes: z.string().max(1000).optional(),
  sign: z
    .object({
      name: z.string().min(1).max(120),
      title: z.string().max(120).optional(),
    })
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = req.query.id;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid request id" });
  }

  const isAdmin = session.role === "ADMIN";
  const asUserIdFromQuery = typeof req.query.asUserId === "string" ? req.query.asUserId : undefined;
  const userId = isAdmin && asUserIdFromQuery ? asUserIdFromQuery : session.id;

  if (req.method === "GET") {
    try {
      const request = await prisma.request.findFirst({
        where: { id, userId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          signedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      return res.status(200).json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
        expectedDeliveryFrom: request.expectedDeliveryFrom
          ? request.expectedDeliveryFrom.toISOString()
          : null,
        expectedDeliveryTo: request.expectedDeliveryTo ? request.expectedDeliveryTo.toISOString() : null,
        signedAt: request.signedAt ? request.signedAt.toISOString() : null,
        items: request.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("GET /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to fetch request" });
    }
  }

  if (req.method === "PATCH") {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    try {
      const { sign, ...rest } = parsed.data;
      const updateData: any = { ...rest };
      if (sign) {
        updateData.signedAt = new Date();
        updateData.signedByName = sign.name;
        updateData.signedByTitle = sign.title ?? null;
        updateData.signedByUserId = session.id;
      }

      const updated = await prisma.request.updateMany({
        where: { id, userId },
        data: updateData,
      });

      if (updated.count === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      const request = await prisma.request.findFirst({
        where: { id, userId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          signedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      return res.status(200).json({
        ...request,
        createdAt: request.createdAt.toISOString(),
        updatedAt: request.updatedAt.toISOString(),
        requestedAt: request.requestedAt.toISOString(),
        expectedDeliveryFrom: request.expectedDeliveryFrom
          ? request.expectedDeliveryFrom.toISOString()
          : null,
        expectedDeliveryTo: request.expectedDeliveryTo ? request.expectedDeliveryTo.toISOString() : null,
        signedAt: request.signedAt ? request.signedAt.toISOString() : null,
        items: request.items.map((it) => ({
          ...it,
          quantity: Number(it.quantity),
          createdAt: it.createdAt.toISOString(),
          updatedAt: it.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error("PATCH /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to update request" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await prisma.request.deleteMany({
        where: { id, userId },
      });

      if (deleted.count === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      return res.status(204).end();
    } catch (error) {
      console.error("DELETE /api/requests/[id] error:", error);
      return res.status(500).json({ error: "Failed to delete request" });
    }
  }

  res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
