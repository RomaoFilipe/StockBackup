import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";
import { transitionRequestWorkflowByAction } from "@/utils/workflow";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = prisma as any;
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const requestId = typeof req.query.id === "string" ? req.query.id : "";
  if (!requestId) return res.status(400).json({ error: "Invalid request id" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId: session.tenantId,
    role: session.role,
  });
  const canDecide = session.role === "ADMIN" || hasPermission(grants, "presidency.approve");
  if (!canDecide) return res.status(403).json({ error: "Forbidden" });

  const dispatch = await db.presidencyDispatch.findFirst({
    where: { requestId, tenantId: session.tenantId },
    select: { id: true, status: true },
  });
  if (!dispatch) return res.status(404).json({ error: "Dispatch not found" });

  const action = parsed.data.decision === "APPROVE" ? "PRESIDENCY_APPROVE" : "PRESIDENCY_REJECT";
  const transition = await transitionRequestWorkflowByAction(prisma, {
    tenantId: session.tenantId,
    requestId,
    action,
    actorUserId: session.id,
    note: parsed.data.note ?? null,
  });
  if (!transition.moved) {
    return res.status(400).json({ error: "Transition not allowed" });
  }

  const updated = await db.presidencyDispatch.update({
    where: { id: dispatch.id },
    data: {
      status: parsed.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      note: parsed.data.note?.trim() || null,
      decidedAt: new Date(),
      decidedByUserId: session.id,
    },
  });

  return res.status(200).json({
    id: updated.id,
    status: updated.status,
    decidedAt: updated.decidedAt?.toISOString() ?? null,
  });
}
