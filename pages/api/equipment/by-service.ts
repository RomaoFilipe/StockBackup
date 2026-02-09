import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

const StatusSchema = z.enum(["IN_STOCK", "ACQUIRED", "IN_REPAIR", "SCRAPPED", "LOST"]);

const querySchema = z.object({
  statuses: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

type RequestingServiceDto = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type GroupItemDto = {
  unitId: string;
  code: string;
  status: "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
  product: { id: string; name: string; sku: string };
  assignedTo: { id: string; name: string; email: string } | null;
  request: { id: string; gtmiNumber: string; title: string | null } | null;
  lastOutAt: string | null;
};

type GroupDto = {
  key: string;
  label: string;
  requestingServiceId: number | null;
  requestingService: RequestingServiceDto | null;
  count: number;
  items: GroupItemDto[];
};

const serviceLabel = (svc: RequestingServiceDto) => `${svc.codigo} - ${svc.designacao}`;

function parseStatuses(raw: string | undefined) {
  if (!raw || !raw.trim()) {
    return ["ACQUIRED", "IN_REPAIR"] as const;
  }

  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const parsed = z.array(StatusSchema).safeParse(parts);
  if (!parsed.success) {
    return null;
  }

  // We only support reporting non-IN_STOCK states here.
  const filtered = parsed.data.filter((s) => s !== "IN_STOCK");
  if (!filtered.length) {
    return null;
  }

  return filtered as Array<"ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST">;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  const tenantId = session.tenantId;
  const limit = parsedQuery.data.limit ?? 1000;

  const statuses = parseStatuses(parsedQuery.data.statuses);
  if (!statuses) {
    return res.status(400).json({ error: "Invalid statuses" });
  }

  try {
    const prismaAny = prisma as any;

    const units = await prismaAny.productUnit.findMany({
      where: {
        tenantId,
        status: { in: statuses },
      },
      take: limit,
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        code: true,
        status: true,
        product: { select: { id: true, name: true, sku: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        stockMovements: {
          where: { type: "OUT", requestId: { not: null } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            createdAt: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            request: {
              select: {
                id: true,
                gtmiNumber: true,
                title: true,
                requestingService: true,
                requestingServiceId: true,
                requestingServiceRef: { select: { id: true, codigo: true, designacao: true, ativo: true } },
              },
            },
          },
        },
      },
    });

    const groups = new Map<string, GroupDto>();

    for (const u of units as any[]) {
      const out = (u.stockMovements?.[0] ?? null) as any | null;
      const req = out?.request ?? null;
      const svc = (req?.requestingServiceRef ?? null) as RequestingServiceDto | null;
      const fallbackServiceText = (req?.requestingService ?? "").trim();

      let key = "unknown";
      let label = "Sem serviço";
      let requestingServiceId: number | null = null;
      let requestingService: RequestingServiceDto | null = null;

      if (svc) {
        key = `svc:${svc.id}`;
        label = serviceLabel(svc);
        requestingServiceId = svc.id;
        requestingService = svc;
      } else if (fallbackServiceText) {
        key = `txt:${fallbackServiceText.toLowerCase()}`;
        label = fallbackServiceText;
      }

      const assignedTo = (u.assignedTo ?? out?.assignedTo ?? null) as
        | { id: string; name: string; email: string }
        | null;

      const item: GroupItemDto = {
        unitId: u.id,
        code: u.code,
        status: u.status,
        product: u.product,
        assignedTo,
        request: req ? { id: req.id, gtmiNumber: req.gtmiNumber, title: req.title ?? null } : null,
        lastOutAt: out?.createdAt ? new Date(out.createdAt).toISOString() : null,
      };

      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
        existing.count += 1;
      } else {
        groups.set(key, {
          key,
          label,
          requestingServiceId,
          requestingService,
          count: 1,
          items: [item],
        });
      }
    }

    const groupsArr = Array.from(groups.values())
      .map((g) => ({
        ...g,
        items: g.items.sort((a, b) => {
          const p = a.product.name.localeCompare(b.product.name);
          if (p !== 0) return p;
          return a.code.localeCompare(b.code);
        }),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      limit,
      statuses,
      totalUnits: units.length,
      groups: groupsArr,
    });
  } catch (error) {
    console.error("GET /api/equipment/by-service error:", error);
    return res.status(500).json({ error: "Failed to fetch equipment by service" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
