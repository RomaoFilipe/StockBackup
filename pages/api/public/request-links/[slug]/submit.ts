import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { applyRateLimit } from "@/utils/rateLimit";

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(10_000),
  notes: z.string().max(500).optional(),
  unit: z.string().max(60).optional(),
});

const bodySchema = z.object({
  pin: z.string().min(4).max(32),
  requesterName: z.string().min(1).max(120),
  title: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
  deliveryLocation: z.string().max(200).optional(),
  items: z.array(itemSchema).max(50).optional(),
});

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xf) ? xf[0] : xf;
  if (typeof raw === "string" && raw.trim()) return raw.split(",")[0].trim();
  const xr = req.headers["x-real-ip"];
  if (typeof xr === "string" && xr.trim()) return xr.trim();
  const ra = req.socket?.remoteAddress;
  return typeof ra === "string" ? ra : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug) return res.status(400).json({ error: "slug is required" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rl = applyRateLimit(req, res, { windowMs: 60_000, max: 10, keyPrefix: `pub-submit:${slug}` });
  if (!rl.ok) return res.status(429).json({ error: "Rate limit exceeded" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const access = await prisma.publicRequestAccess.findFirst({
    where: { slug, isActive: true },
    select: { id: true, tenantId: true, requestingServiceId: true },
  });
  if (!access) return res.status(404).json({ error: "Not found" });

  const pins = await prisma.publicRequestPin.findMany({
    where: { accessId: access.id, isActive: true },
    select: { id: true, pinHash: true },
  });

  const inputPin = parsed.data.pin.trim();
  let matchedPinId: string | null = null;
  for (const p of pins) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await bcrypt.compare(inputPin, p.pinHash);
    if (ok) {
      matchedPinId = p.id;
      break;
    }
  }

  if (!matchedPinId) return res.status(401).json({ error: "PIN inválido" });

  const items = Array.isArray(parsed.data.items) ? parsed.data.items : [];

  if (items.length) {
    const productIds = items.map((i) => i.productId);
    const existing = await prisma.product.findMany({
      where: { tenantId: access.tenantId, id: { in: productIds } },
      select: { id: true },
    });
    const existingSet = new Set(existing.map((p) => p.id));
    const missing = productIds.filter((id) => !existingSet.has(id));
    if (missing.length) {
      return res.status(400).json({ error: "Produto inválido no pedido" });
    }
  }

  await prisma.publicRequestPin.update({
    where: { id: matchedPinId },
    data: { lastUsedAt: new Date() },
  });

  const created = await prisma.publicRequest.create({
    data: {
      tenantId: access.tenantId,
      accessId: access.id,
      requestingServiceId: access.requestingServiceId,
      requesterName: parsed.data.requesterName.trim(),
      requesterIp: getClientIp(req) ?? null,
      deliveryLocation: parsed.data.deliveryLocation?.trim() || null,
      title: parsed.data.title?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      status: "RECEIVED",
      ...(items.length
        ? {
            items: {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: BigInt(i.quantity) as any,
                notes: i.notes?.trim() || null,
                unit: i.unit?.trim() || null,
              })),
            },
          }
        : {}),
    },
    select: { id: true },
  });

  return res.status(201).json({ ok: true, id: created.id });
}
