import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z
  .object({
    productId: z.string().uuid().optional(),
    unitId: z.string().uuid().optional(),
    type: z
      .enum(["IN", "OUT", "RETURN", "REPAIR_OUT", "REPAIR_IN", "SCRAP", "LOST"])
      .optional(),
    performedByUserId: z.string().uuid().optional(),
    assignedToUserId: z.string().uuid().optional(),
    invoiceNumber: z.string().max(64).optional(),
    reqNumber: z.string().max(64).optional(),
    requestId: z.string().uuid().optional(),
    q: z.string().max(200).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursor: z.string().uuid().optional(),
    asUserId: z.string().uuid().optional(),
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const tenantId = session.tenantId;

  const take = parsed.data.limit ?? 50;
  const q = parsed.data.q?.trim();

  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

  try {
    const andClauses: any[] = [];
    if (parsed.data.invoiceNumber) {
      andClauses.push({ invoice: { is: { invoiceNumber: parsed.data.invoiceNumber } } });
    }
    if (parsed.data.reqNumber) {
      andClauses.push({ invoice: { is: { reqNumber: parsed.data.reqNumber } } });
    }

    const where: any = {
      tenantId,
      ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.unitId ? { unitId: parsed.data.unitId } : {}),
      ...(parsed.data.type ? { type: parsed.data.type } : {}),
      ...(parsed.data.performedByUserId ? { performedByUserId: parsed.data.performedByUserId } : {}),
      ...(parsed.data.assignedToUserId ? { assignedToUserId: parsed.data.assignedToUserId } : {}),
      ...(parsed.data.requestId ? { requestId: parsed.data.requestId } : {}),
      ...(andClauses.length ? { AND: andClauses } : {}),
      ...(parsed.data.from || parsed.data.to
        ? {
            createdAt: {
              ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
              ...(parsed.data.to ? { lte: new Date(parsed.data.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { reason: contains(q) },
              { costCenter: contains(q) },
              { notes: contains(q) },
              { product: { is: { name: contains(q) } } },
              { product: { is: { sku: contains(q) } } },
              { invoice: { is: { invoiceNumber: contains(q) } } },
              { invoice: { is: { reqNumber: contains(q) } } },
              { request: { is: { id: contains(q) } } },
              { request: { is: { title: contains(q) } } },
              { performedBy: { is: { name: contains(q) } } },
              { performedBy: { is: { email: contains(q) } } },
              { assignedTo: { is: { name: contains(q) } } },
              { assignedTo: { is: { email: contains(q) } } },
              { unit: { is: { code: contains(q) } } },
            ],
          }
        : {}),
    };

    const prismaAny = prisma as any;

    const items = await prismaAny.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(parsed.data.cursor
        ? {
            cursor: { id: parsed.data.cursor },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        type: true,
        quantity: true,
        reason: true,
        costCenter: true,
        notes: true,
        createdAt: true,
        productId: true,
        unitId: true,
        invoiceId: true,
        requestId: true,
        product: { select: { id: true, name: true, sku: true } },
        unit: { select: { code: true } },
        invoice: { select: { id: true, invoiceNumber: true, reqNumber: true } },
        request: { select: { id: true, title: true } },
        performedBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    const hasMore = items.length > take;
    const sliced = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null;

    return res.status(200).json({
      items: sliced.map((m: any) => ({
        ...m,
        quantity: Number(m.quantity),
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("GET /api/stock-movements error:", error);
    return res.status(500).json({ error: "Failed to fetch stock movements" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
