import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition, transitionRequestWorkflowToStatus } from "@/utils/workflow";

const schema = z.object({
  targetStatus: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "FULFILLED"]),
  note: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid request id" });

  const request = await prisma.request.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true, status: true, requestingServiceId: true, userId: true, createdByUserId: true },
  });
  if (!request) return res.status(404).json({ error: "Request not found" });

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId: session.tenantId,
    role: session.role,
  });

  const serviceScope = request.requestingServiceId ?? null;
  const can = (perm: string) => session.role === "ADMIN" || hasPermission(grants, perm, serviceScope);
  const canViewWorkflow = session.role === "ADMIN" || request.userId === session.id || request.createdByUserId === session.id || can("requests.change_status");

  if (req.method === "GET") {
    if (!canViewWorkflow) return res.status(403).json({ error: "Forbidden" });

    await ensureRequestWorkflowDefinition(prisma, session.tenantId);
    const instance = await db.workflowInstance.findFirst({
      where: {
        tenantId: session.tenantId,
        requestId: id,
      },
      include: {
        definition: {
          select: {
            id: true,
            key: true,
            name: true,
            version: true,
          },
        },
        currentState: {
          select: {
            id: true,
            code: true,
            name: true,
            requestStatus: true,
          },
        },
        events: {
          orderBy: [{ createdAt: "desc" }],
          include: {
            actor: { select: { id: true, name: true, email: true } },
            fromState: { select: { code: true, name: true, requestStatus: true } },
            toState: { select: { code: true, name: true, requestStatus: true } },
          },
        },
      },
    });

    if (!instance) {
      return res.status(404).json({ error: "Workflow instance not found" });
    }

    return res.status(200).json({
      id: instance.id,
      completedAt: instance.completedAt ? instance.completedAt.toISOString() : null,
      definition: instance.definition,
      currentState: instance.currentState,
      events: instance.events.map((event: any) => ({
        id: event.id,
        action: event.action,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
        actor: event.actor,
        fromState: event.fromState,
        toState: event.toState,
      })),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
  }

  if (parsed.data.targetStatus === "APPROVED" && !(can("requests.approve") || can("presidency.approve"))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (parsed.data.targetStatus === "REJECTED" && !(can("requests.reject") || can("presidency.approve"))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  if (parsed.data.targetStatus === "FULFILLED" && !can("requests.pickup_sign")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  await ensureRequestWorkflowDefinition(prisma, session.tenantId);

  const moved = await transitionRequestWorkflowToStatus(prisma, {
    tenantId: session.tenantId,
    requestId: id,
    targetStatus: parsed.data.targetStatus,
    actorUserId: session.id,
    note: parsed.data.note ?? null,
  });

  if (!moved.moved) {
    return res.status(400).json({ error: "Transition not allowed" });
  }

  return res.status(200).json({ ok: true, status: moved.status, action: moved.action });
}
