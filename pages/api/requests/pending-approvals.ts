import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition } from "@/utils/workflow";

function getAllowedServiceIdsForPermission(args: {
  grants: Array<{ key: string; requestingServiceId: number | null }>;
  permissionKey: string;
}) {
  const { grants, permissionKey } = args;
  if (grants.some((g) => g.key === "*")) return { all: true as const, ids: [] as number[] };

  const hasGlobal = grants.some((g) => g.key === permissionKey && g.requestingServiceId == null);
  if (hasGlobal) return { all: true as const, ids: [] as number[] };

  const scopedIds = grants
    .filter((g) => g.key === permissionKey)
    .map((g) => g.requestingServiceId)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  return { all: false as const, ids: Array.from(new Set(scopedIds)) };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const tenantId = session.tenantId;
  await ensureRequestWorkflowDefinition(prisma, tenantId);

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId,
    role: session.role,
  });

  const approvalScope = getAllowedServiceIdsForPermission({ grants, permissionKey: "requests.approve" });
  const canApproveAnything = approvalScope.all || approvalScope.ids.length > 0;
  if (!canApproveAnything && !hasPermission(grants, "requests.approve", null)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const instances = await (prisma as any).workflowInstance.findMany({
    where: {
      tenantId,
      requestId: { not: null },
      currentState: { is: { code: "SUBMITTED" } },
      request: {
        is: {
          tenantId,
          status: "SUBMITTED",
          ...(approvalScope.all ? {} : { requestingServiceId: { in: approvalScope.ids } }),
        },
      },
    },
    orderBy: [{ updatedAt: "asc" }],
    take: 200,
    select: {
      request: {
        select: {
          id: true,
          gtmiNumber: true,
          status: true,
          title: true,
          priority: true,
          dueAt: true,
          requestedAt: true,
          requesterName: true,
          requestingService: true,
          requestingServiceId: true,
          userId: true,
          createdByUserId: true,
        },
      },
    },
  });

  return res.status(200).json(
    instances
      .map((i: any) => i.request)
      .filter(Boolean)
      .map((r: any) => ({
        ...r,
        requestedAt: r.requestedAt.toISOString(),
        dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      })),
  );
}

