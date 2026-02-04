import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  asUserId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
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

  const { asUserId, invoiceId, productId, cursor, limit } = parsed.data;
  if (!invoiceId && !productId) {
    return res.status(400).json({ error: "invoiceId or productId is required" });
  }

  const isAdmin = session.role === "ADMIN";
  const userId = isAdmin && asUserId ? asUserId : session.id;

  try {
    const prismaAny = prisma as any;
    const units = await prismaAny.productUnit.findMany({
      where: {
        userId,
        invoiceId: invoiceId ?? undefined,
        productId: productId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      select: {
        id: true,
        code: true,
        status: true,
        serialNumber: true,
        partNumber: true,
        assetTag: true,
        notes: true,
        createdAt: true,
        acquiredAt: true,
        productId: true,
        invoiceId: true,
        acquiredByUserId: true,
      },
    });

    const hasMore = units.length > limit;
    const page = hasMore ? units.slice(0, limit) : units;
    const nextCursor = hasMore ? page[page.length - 1]?.id : null;

    return res.status(200).json({
      items: page.map((u: any) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        acquiredAt: u.acquiredAt ? u.acquiredAt.toISOString() : null,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("GET /api/units error:", error);
    return res.status(500).json({ error: "Failed to fetch units" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
