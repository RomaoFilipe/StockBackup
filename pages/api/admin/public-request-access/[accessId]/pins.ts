import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";

const createSchema = z.object({
  label: z.string().max(120).optional(),
  pin: z.string().min(4).max(32).optional(),
});

const patchSchema = z.object({
  pinId: z.string().uuid(),
  isActive: z.boolean(),
});

function generatePin() {
  // 6 digits
  const n = Math.floor(100000 + Math.random() * 900000);
  return String(n);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const accessId = typeof req.query.accessId === "string" ? req.query.accessId : "";
  if (!accessId) return res.status(400).json({ error: "accessId is required" });

  const access = await prisma.publicRequestAccess.findFirst({
    where: { id: accessId, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!access) return res.status(404).json({ error: "Not found" });

  if (req.method === "GET") {
    const pins = await prisma.publicRequestPin.findMany({
      where: { accessId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, isActive: true, createdAt: true, lastUsedAt: true },
    });

    return res.status(200).json(
      pins.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

    const pin = (parsed.data.pin || generatePin()).trim();
    const pinHash = await bcrypt.hash(pin, 10);

    const created = await prisma.publicRequestPin.create({
      data: {
        accessId,
        label: parsed.data.label?.trim() || null,
        pinHash,
        isActive: true,
        createdByUserId: session.id,
      },
      select: { id: true, label: true, isActive: true, createdAt: true },
    });

    // Return plaintext PIN only once (creation response)
    return res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      pin,
    });
  }

  if (req.method === "PATCH") {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

    const updated = await prisma.publicRequestPin.updateMany({
      where: { id: parsed.data.pinId, accessId },
      data: { isActive: parsed.data.isActive },
    });

    if (!updated.count) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "PATCH"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
