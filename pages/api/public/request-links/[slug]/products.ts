import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { applyRateLimit } from "@/utils/rateLimit";

const bodySchema = z.object({
  pin: z.string().min(4).max(32),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = typeof req.query.slug === "string" ? req.query.slug : "";
  if (!slug) return res.status(400).json({ error: "slug is required" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const rl = applyRateLimit(req, res, { windowMs: 60_000, max: 30, keyPrefix: `pub-products:${slug}` });
  if (!rl.ok) return res.status(429).json({ error: "Rate limit exceeded" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const access = await prisma.publicRequestAccess.findFirst({
    where: { slug, isActive: true },
    select: { id: true, tenantId: true },
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

  await prisma.publicRequestPin.update({
    where: { id: matchedPinId },
    data: { lastUsedAt: new Date() },
  });

  const products = await prisma.product.findMany({
    where: { tenantId: access.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, sku: true, status: true },
  });

  return res.status(200).json({
    products,
  });
}
