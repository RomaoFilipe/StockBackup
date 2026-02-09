import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const querySchema = z.object({
  status: z.enum(["RECEIVED", "ACCEPTED", "REJECTED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  const tenantId = session.tenantId;
  const take = parsed.data.limit ?? 100;

  const rows = await prisma.publicRequest.findMany({
    where: {
      tenantId,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      requestingService: { select: { id: true, codigo: true, designacao: true } },
      access: { select: { slug: true } },
      handledBy: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: { product: { select: { id: true, name: true, sku: true } } },
      },
      acceptedRequest: { select: { id: true, gtmiNumber: true } },
    },
  });

  return res.status(200).json(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      requesterName: r.requesterName,
      requesterIp: r.requesterIp,
      deliveryLocation: (r as any).deliveryLocation ?? null,
      title: r.title,
      notes: r.notes,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      handledNote: r.handledNote,
      handledBy: r.handledBy,
      requestingService: r.requestingService,
      access: r.access,
      acceptedRequest: r.acceptedRequest,
      items: r.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.unit,
        notes: it.notes,
        product: it.product,
      })),
    }))
  );
}
