import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants } from "@/utils/rbac";

const querySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  requestingServiceId: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(20000).optional(),
});

function parseDate(raw?: string) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });

  const tenantId = session.tenantId;
  const dateFrom = parseDate(parsed.data.dateFrom);
  const dateTo = parseDate(parsed.data.dateTo);
  const limit = parsed.data.limit ?? 5000;
  const serviceId = typeof parsed.data.requestingServiceId === "number" && Number.isFinite(parsed.data.requestingServiceId)
    ? parsed.data.requestingServiceId
    : null;

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId,
    role: session.role,
  });

  const hasWildcard = grants.some((g) => g.key === "*");
  const hasGlobalReports = hasWildcard || grants.some((g) => g.key === "reports.view" && g.requestingServiceId == null);
  const allowedServiceIds = Array.from(
    new Set(
      grants
        .filter((g) => g.key === "reports.view" && typeof g.requestingServiceId === "number" && Number.isFinite(g.requestingServiceId))
        .map((g) => g.requestingServiceId as number),
    ),
  );

  if (!hasGlobalReports && allowedServiceIds.length === 0) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (serviceId != null) {
    if (!hasGlobalReports && !allowedServiceIds.includes(serviceId)) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  const where: any = {
    tenantId,
    createdAt: {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    },
    action: { in: ["SUBMIT", "APPROVE", "REJECT", "PRESIDENCY_APPROVE", "PRESIDENCY_REJECT", "FULFILL"] },
    instance: {
      is: {
        requestId: { not: null },
        request: {
          is: {
            tenantId,
            ...(serviceId != null ? { requestingServiceId: serviceId } : hasGlobalReports ? {} : { requestingServiceId: { in: allowedServiceIds } }),
          },
        },
      },
    },
  };

  const events = await (prisma as any).workflowEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      createdAt: true,
      action: true,
      note: true,
      actor: { select: { id: true, name: true, email: true } },
      fromState: { select: { code: true, name: true } },
      toState: { select: { code: true, name: true } },
      instance: {
        select: {
          request: {
            select: {
              id: true,
              gtmiNumber: true,
              requestingServiceId: true,
              requestingService: true,
              requesterName: true,
            },
          },
        },
      },
    },
  });

  const header = [
    "eventAt",
    "gtmiNumber",
    "requestId",
    "requestingServiceId",
    "requestingService",
    "requesterName",
    "action",
    "fromState",
    "toState",
    "actorName",
    "actorEmail",
    "note",
  ];

  const lines = [header.join(",")];
  for (const e of events as any[]) {
    const r = e.instance?.request;
    if (!r) continue;
    lines.push(
      [
        e.createdAt.toISOString(),
        r.gtmiNumber,
        r.id,
        r.requestingServiceId ?? "",
        r.requestingService ?? "",
        r.requesterName ?? "",
        e.action,
        e.fromState?.name || e.fromState?.code || "",
        e.toState?.name || e.toState?.code || "",
        e.actor?.name || "",
        e.actor?.email || "",
        e.note || "",
      ].map(csvEscape).join(","),
    );
  }

  const csv = lines.join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"approvals-${new Date().toISOString().slice(0, 10)}.csv\"`);
  return res.status(200).send(csv);
}

export const config = {
  api: {
    externalResolver: true,
  },
};

