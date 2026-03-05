import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const querySchema = z.object({
  status: z.enum(["RECEIVED", "ACCEPTED", "REJECTED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
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
  const take = parsed.data.limit ?? 100;

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId,
    role: session.role,
  });

  const canViewAll =
    hasPermission(grants, "public_requests.handle", null) ||
    hasPermission(grants, "public_requests.view", null);
  const allowedServiceIds = Array.from(
    new Set(
      grants
        .filter(
          (g) =>
            (g.key === "public_requests.handle" || g.key === "public_requests.view") &&
            typeof g.requestingServiceId === "number" &&
            Number.isFinite(g.requestingServiceId),
        )
        .map((g) => g.requestingServiceId as number),
    ),
  );

  if (!canViewAll && allowedServiceIds.length === 0) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await prisma.publicRequest.findMany({
    where: {
      tenantId,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(canViewAll ? {} : { requestingServiceId: { in: allowedServiceIds } }),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      requestingService: { select: { id: true, codigo: true, designacao: true } },
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
      requesterUserId: (r as any).requesterUserId ?? null,
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
