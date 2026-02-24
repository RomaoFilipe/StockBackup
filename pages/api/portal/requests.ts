import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";

const schema = z.object({
  tenantSlug: z.string().min(1).max(120).optional(),
  requestingServiceId: z.number().int(),
  requesterName: z.string().min(2).max(120),
  deliveryLocation: z.string().max(200).optional(),
  title: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unit: z.string().max(60).optional(),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1),
});

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (typeof raw === "string" && raw.trim()) return raw.split(",")[0].trim();
  return req.socket.remoteAddress ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const tenantSlug = parsed.data.tenantSlug?.trim() || process.env.DEFAULT_TENANT_SLUG || "default";
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const service = await prisma.requestingService.findUnique({
    where: { id: parsed.data.requestingServiceId },
    select: { id: true, ativo: true },
  });
  if (!service || !service.ativo) {
    return res.status(400).json({ error: "Serviço requisitante inválido" });
  }

  const productIds = Array.from(new Set(parsed.data.items.map((item) => item.productId)));
  const products = await prisma.product.findMany({
    where: { tenantId: tenant.id, id: { in: productIds } },
    select: { id: true },
  });
  if (products.length !== productIds.length) {
    return res.status(400).json({ error: "Um ou mais produtos são inválidos" });
  }

  const created = await prisma.publicRequest.create({
    data: {
      tenantId: tenant.id,
      requestingServiceId: parsed.data.requestingServiceId,
      requesterName: parsed.data.requesterName.trim(),
      requesterIp: getClientIp(req),
      deliveryLocation: parsed.data.deliveryLocation?.trim() || null,
      title: parsed.data.title?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      status: "RECEIVED",
      items: {
        create: parsed.data.items.map((item) => ({
          productId: item.productId,
          quantity: BigInt(item.quantity) as any,
          unit: item.unit?.trim() || null,
          notes: item.notes?.trim() || null,
        })),
      },
    },
  });

  return res.status(201).json({
    id: created.id,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  });
}
