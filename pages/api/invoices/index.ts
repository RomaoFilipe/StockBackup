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
  reqDate: z.string().datetime().optional(),
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

  const tenantId = session.tenantId;

  if (req.method === "GET") {
    const productId = req.query.productId;
    if (typeof productId !== "string") {
      return res.status(400).json({ error: "productId is required" });
    }

    const takeRaw = req.query.take;
    let take: number | undefined;
    if (typeof takeRaw === "string" && takeRaw.trim()) {
      const parsedTake = Number(takeRaw);
      if (!Number.isFinite(parsedTake) || parsedTake <= 0) {
        return res.status(400).json({ error: "take must be a positive number" });
      }
      take = Math.min(Math.floor(parsedTake), 50);
    }

    try {
      // Ensure product belongs to the user
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const invoices = await prisma.productInvoice.findMany({
        where: { tenantId, productId },
        orderBy: { issuedAt: "desc" },
        take,
        include: {
          request: {
            select: {
              id: true,
              gtmiNumber: true,
              title: true,
              status: true,
              requestedAt: true,
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
          reqDate: inv.reqDate ? inv.reqDate.toISOString() : null,
          issuedAt: inv.issuedAt.toISOString(),
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          request: inv.request
            ? {
                ...inv.request,
                requestedAt: inv.request.requestedAt.toISOString(),
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

    const { productId, requestId, reqNumber, reqDate, invoiceNumber, issuedAt, quantity, unitPrice, notes } = parsed.data;

    try {
      // Ensure product belongs to the user
      const product = await prisma.product.findFirst({
        where: { id: productId, tenantId },
        select: { id: true },
      });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      let effectiveReqNumber = reqNumber?.trim() ? reqNumber.trim() : null;
      let effectiveRequestId = requestId ?? null;
      let resolvedRequestDate: Date | null = null;

      if (requestId) {
        const request = await prisma.request.findFirst({
          where: {
            id: requestId,
            tenantId,
            items: { some: { productId } },
          },
          select: { id: true, gtmiNumber: true, requestedAt: true },
        });

        if (!request) {
          return res.status(404).json({ error: "Request not found for this product" });
        }

        if (!effectiveReqNumber) effectiveReqNumber = request.gtmiNumber;
        resolvedRequestDate = request.requestedAt;
      } else if (effectiveReqNumber) {
        const request = await prisma.request.findFirst({
          where: {
            tenantId,
            gtmiNumber: effectiveReqNumber,
            items: { some: { productId } },
          },
          select: { id: true, requestedAt: true },
        });
        if (request) {
          effectiveRequestId = request.id;
          resolvedRequestDate = request.requestedAt;
        }
      } else {
        const candidates = await prisma.request.findMany({
          where: {
            tenantId,
            status: { in: ["SUBMITTED", "APPROVED", "FULFILLED"] },
            items: { some: { productId } },
          },
          orderBy: { requestedAt: "desc" },
          take: 2,
          select: { id: true, gtmiNumber: true, requestedAt: true },
        });

        if (candidates.length === 1) {
          effectiveRequestId = candidates[0].id;
          effectiveReqNumber = candidates[0].gtmiNumber;
          resolvedRequestDate = candidates[0].requestedAt;
        }
      }

      const effectiveReqDate = reqDate ? new Date(reqDate) : resolvedRequestDate;

      const created = await prisma.productInvoice.create({
        data: {
          tenantId,
          productId,
          requestId: effectiveRequestId,
          reqNumber: effectiveReqNumber,
          reqDate: effectiveReqDate,
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
              gtmiNumber: true,
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
        return res.status(400).json({ error: "Invoice number must be unique per tenant" });
      }
      console.error("POST /api/invoices error:", error);
      return res.status(500).json({ error: "Failed to create invoice" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
