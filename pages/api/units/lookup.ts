import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const querySchema = z.object({
  code: z.string().uuid(),
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

  try {
    const prismaAny = prisma as any;
    const unit = await prismaAny.productUnit.findFirst({
      where: { code: parsed.data.code, tenantId },
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
        acquiredByUserId: true,
        assignedToUserId: true,
        acquiredReason: true,
        costCenter: true,
        acquiredNotes: true,
        invoiceId: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            description: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            reqNumber: true,
            issuedAt: true,
          },
        },
      },
    });

    if (!unit) {
      return res.status(404).json({ error: "Unit not found" });
    }

    return res.status(200).json({
      ...unit,
      createdAt: unit.createdAt.toISOString(),
      acquiredAt: unit.acquiredAt ? unit.acquiredAt.toISOString() : null,
      invoice: unit.invoice
        ? {
            ...unit.invoice,
            issuedAt: unit.invoice.issuedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/units/lookup error:", error);
    return res.status(500).json({ error: "Failed to lookup unit" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
