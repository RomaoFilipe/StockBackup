import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../_admin";

const createSchema = z.object({
  requestingServiceId: z.number().int(),
  slug: z.string().min(3).max(80).optional(),
});

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

async function makeUniqueSlug(base: string) {
  const cleaned = toSlug(base) || `r-${nanoid(8)}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? cleaned : `${cleaned}-${nanoid(4)}`;
    const exists = await prisma.publicRequestAccess.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${cleaned}-${nanoid(8)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const tenantId = session.tenantId;

  if (req.method === "GET") {
    const links = await prisma.publicRequestAccess.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        requestingService: { select: { id: true, codigo: true, designacao: true, ativo: true } },
        pins: { select: { id: true, label: true, isActive: true, createdAt: true, lastUsedAt: true } },
        _count: { select: { requests: true } },
      },
    });

    return res.status(200).json(
      links.map((l) => ({
        id: l.id,
        slug: l.slug,
        isActive: l.isActive,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        requestingService: l.requestingService,
        pins: l.pins.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
        })),
        pinCounts: {
          total: l.pins.length,
          active: l.pins.filter((p) => p.isActive).length,
        },
        requestsCount: l._count.requests,
        publicPath: `/r/${l.slug}`,
      }))
    );
  }

  if (req.method === "POST") {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid body" });
    }

    const requestingServiceId = parsed.data.requestingServiceId;

    const existing = await prisma.publicRequestAccess.findFirst({
      where: { tenantId, requestingServiceId },
      select: { id: true, slug: true, isActive: true },
    });
    if (existing) {
      return res.status(200).json({
        id: existing.id,
        slug: existing.slug,
        isActive: existing.isActive,
        publicPath: `/r/${existing.slug}`,
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });

    const svc = await prisma.requestingService.findUnique({
      where: { id: requestingServiceId },
      select: { id: true, codigo: true, designacao: true },
    });

    if (!svc) {
      return res.status(400).json({ error: "Serviço requisitante inválido" });
    }

    const base = parsed.data.slug
      ? parsed.data.slug
      : `r-${tenant?.slug ?? "tenant"}-${svc.codigo || "svc"}`;

    const slug = await makeUniqueSlug(base);

    const created = await prisma.publicRequestAccess.create({
      data: {
        tenantId,
        requestingServiceId,
        slug,
        isActive: true,
        createdByUserId: session.id,
      },
      select: { id: true, slug: true, isActive: true },
    });

    return res.status(201).json({
      id: created.id,
      slug: created.slug,
      isActive: created.isActive,
      publicPath: `/r/${created.slug}`,
    });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method Not Allowed" });
}
