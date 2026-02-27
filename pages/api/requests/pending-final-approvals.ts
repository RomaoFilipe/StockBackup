import type { NextApiRequest, NextApiResponse } from "next";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition } from "@/utils/workflow";

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

  // Final approvals are global (not scoped by requestingServiceId).
  if (!hasPermission(grants, "requests.final_approve", null) && !hasPermission(grants, "requests.final_reject", null)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const instances = await (prisma as any).workflowInstance.findMany({
    where: {
      tenantId,
      requestId: { not: null },
      currentState: { is: { code: "AWAITING_ADMIN_APPROVAL" } },
      request: {
        is: {
          tenantId,
          status: "SUBMITTED",
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

