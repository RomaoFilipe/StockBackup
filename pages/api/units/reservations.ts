import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  productId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const tenantId = session.tenantId;
  const q = parsed.data.q?.trim();
  const contains = (value: string) => ({ contains: value, mode: "insensitive" as const });

  try {
    const prismaAny = prisma as any;
    const andClauses: any[] = [
      { OR: [{ reservedUnitId: { not: null } }, { destination: { not: null } }] },
    ];
    if (q) {
      andClauses.push({
        OR: [
          { destination: contains(q) },
          { product: { is: { name: contains(q) } } },
          { product: { is: { sku: contains(q) } } },
          { reservedUnit: { is: { code: contains(q) } } },
          { request: { is: { gtmiNumber: contains(q) } } },
          { request: { is: { requesterName: contains(q) } } },
          { request: { is: { user: { is: { name: contains(q) } } } } },
        ],
      });
    }

    const items = await prismaAny.requestItem.findMany({
      where: {
        role: { not: "OLD" },
        ...(parsed.data.productId ? { productId: parsed.data.productId } : {}),
        AND: andClauses,
        request: {
          tenantId,
          status: parsed.data.status ? parsed.data.status : { in: ["DRAFT", "SUBMITTED", "APPROVED"] },
          ...(parsed.data.requestId ? { id: parsed.data.requestId } : {}),
        },
      },
      orderBy: [{ createdAt: "desc" }],
      take: parsed.data.limit,
      select: {
        id: true,
        quantity: true,
        destination: true,
        notes: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            supplier: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
        reservedUnit: {
          select: {
            id: true,
            code: true,
            status: true,
            serialNumber: true,
            partNumber: true,
            assetTag: true,
          },
        },
        request: {
          select: {
            id: true,
            gtmiNumber: true,
            title: true,
            status: true,
            requesterName: true,
            deliveryLocation: true,
            requestedAt: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return res.status(200).json({
      items: items.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        createdAt: item.createdAt.toISOString(),
        request: {
          ...item.request,
          requestedAt: item.request.requestedAt.toISOString(),
        },
      })),
    });
  } catch (error) {
    console.error("GET /api/units/reservations error:", error);
    return res.status(500).json({ error: "Failed to fetch reservations" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
