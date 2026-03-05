import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";
import { ensureRequestWorkflowDefinition, ensureRequestWorkflowInstance, transitionRequestWorkflowByAction } from "@/utils/workflow";

const schema = z.union([
  z.object({
    action: z.enum(["SUBMIT", "APPROVE", "REJECT", "FULFILL", "PRESIDENCY_APPROVE", "PRESIDENCY_REJECT"]),
    note: z.string().max(500).optional(),
  }),
  z.object({
    targetStatus: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "FULFILLED"]),
    note: z.string().max(500).optional(),
  }),
]);

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
  const can = (perm: string) => hasPermission(grants, perm, serviceScope);
  const canViewWorkflow =
    request.userId === session.id ||
    request.createdByUserId === session.id ||
    can("requests.change_status") ||
    can("requests.view");

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

  await ensureRequestWorkflowDefinition(prisma, session.tenantId);
  const instance = await ensureRequestWorkflowInstance(prisma as any, {
    tenantId: session.tenantId,
    requestId: id,
  });
  const currentStateCode = (instance as any)?.currentState?.code ?? null;

  const note = "note" in parsed.data ? (parsed.data.note ?? null) : null;

  const action = (() => {
    if ("action" in parsed.data) return parsed.data.action;
    switch (parsed.data.targetStatus) {
      case "SUBMITTED":
        return "SUBMIT" as const;
      case "APPROVED":
        return "APPROVE" as const;
      case "REJECTED":
        return "REJECT" as const;
      case "FULFILLED":
        return "FULFILL" as const;
      default:
        return null;
    }
  })();

  if (!action) {
    return res.status(400).json({ error: "Invalid action" });
  }

  // Authorization:
  // - SUBMIT: owner/creator can submit their draft, or ops can force via requests.change_status.
  // - Other actions: validate required permission from the transition definition.
  if (action === "SUBMIT") {
    const isOwner = request.userId === session.id || request.createdByUserId === session.id;
    if (!isOwner && !can("requests.change_status")) {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else {
    const transitions = await db.workflowTransitionDefinition.findMany({
      where: {
        tenantId: session.tenantId,
        workflowId: instance.definitionId,
        fromStateId: instance.currentStateId,
      },
      select: { action: true, requiredPermission: true },
    });
    const transition = transitions.find((t: any) => t.action === action);
    if (!transition) {
      return res.status(400).json({ error: "Transition not allowed" });
    }

    const required = transition.requiredPermission as string | null;
    if (required) {
      const isFinal = required.startsWith("requests.final_");
      const allowed = isFinal ? hasPermission(grants, required, null) : hasPermission(grants, required, serviceScope);
      if (!allowed) return res.status(403).json({ error: "Forbidden" });
    }
  }

  const moved = await transitionRequestWorkflowByAction(prisma, {
    tenantId: session.tenantId,
    requestId: id,
    action,
    actorUserId: session.id,
    note,
  });

  if (!moved.moved) return res.status(400).json({ error: "Transition not allowed" });

  return res.status(200).json({
    ok: true,
    action: moved.action,
    from: currentStateCode,
    to: moved.toState.code,
    status: moved.toState.requestStatus,
  });
}
