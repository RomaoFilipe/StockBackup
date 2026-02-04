import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const createInvoiceSchema = z.object({
  asUserId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  reqNumber: z.string().max(64).optional(),
  invoiceNumber: z.string().min(1).max(64),
  issuedAt: z.string().datetime().optional(),
  quantity: z.number().int().nonnegative(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isAdmin = session.role === "ADMIN";
  const asUserIdFromQuery = typeof req.query.asUserId === "string" ? req.query.asUserId : undefined;
  const userId = isAdmin && asUserIdFromQuery ? asUserIdFromQuery : session.id;

  if (req.method === "GET") {
    const productId = req.query.productId;
    if (typeof productId !== "string") {
      return res.status(400).json({ error: "productId is required" });
    }

    try {
      // Ensure product belongs to the user
      const product = await prisma.product.findFirst({
        where: { id: productId, userId },
        select: { id: true },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const invoices = await prisma.productInvoice.findMany({
        where: { userId, productId },
        orderBy: { issuedAt: "desc" },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return res.status(200).json(
        invoices.map((inv) => ({
          ...inv,
          quantity: Number(inv.quantity),
          issuedAt: inv.issuedAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          request: inv.request
            ? {
                ...inv.request,
                createdAt: inv.request.createdAt.toISOString(),
              }
            : null,
        }))
      );
    } catch (error) {
      console.error("GET /api/invoices error:", error);
      return res.status(500).json({ error: "Failed to fetch invoices" });
    }
  }

  if (req.method === "POST") {
    const parsed = createInvoiceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { asUserId, productId, requestId, reqNumber, invoiceNumber, issuedAt, quantity, unitPrice, notes } = parsed.data;
    const actingUserId = isAdmin && asUserId ? asUserId : session.id;

    try {
      // Ensure product belongs to the user
      const product = await prisma.product.findFirst({
        where: { id: productId, userId: actingUserId },
        select: { id: true },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      if (requestId) {
        const request = await prisma.request.findFirst({
          where: {
            id: requestId,
            userId: actingUserId,
            items: { some: { productId } },
          },
          select: { id: true },
        });

        if (!request) {
          return res.status(404).json({ error: "Request not found for this product" });
        }
      }

      const created = await prisma.productInvoice.create({
        data: {
          userId: actingUserId,
          productId,
          requestId,
          reqNumber: reqNumber ?? null,
          invoiceNumber,
          issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
          quantity: BigInt(quantity) as any,
          unitPrice,
          notes,
        },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              createdAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return res.status(201).json({
        ...created,
        quantity: Number(created.quantity),
        issuedAt: created.issuedAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        request: created.request
          ? {
              ...created.request,
              createdAt: created.request.createdAt.toISOString(),
            }
          : null,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return res.status(400).json({ error: "Invoice number must be unique per user" });
      }
      console.error("POST /api/invoices error:", error);
      return res.status(500).json({ error: "Failed to create invoice" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
