import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

const schema = z.object({
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
  const canDispatch =
    session.role === "ADMIN" ||
    hasPermission(grants, "requests.approve") ||
    hasPermission(grants, "finance.manage") ||
    hasPermission(grants, "presidency.approve");

  if (!canDispatch) return res.status(403).json({ error: "Forbidden" });

  const reqRow = await prisma.request.findFirst({ where: { id: requestId, tenantId: session.tenantId }, select: { id: true } });
  if (!reqRow) return res.status(404).json({ error: "Request not found" });

  const dispatch = await db.presidencyDispatch.upsert({
    where: { requestId },
    create: {
      tenantId: session.tenantId,
      requestId,
      status: "PENDING",
      note: parsed.data.note?.trim() || null,
    },
    update: {
      status: "PENDING",
      note: parsed.data.note?.trim() || null,
      decidedAt: null,
      decidedByUserId: null,
    },
  });

  return res.status(200).json({
    id: dispatch.id,
    status: dispatch.status,
    note: dispatch.note,
    dispatchedAt: dispatch.dispatchedAt.toISOString(),
  });
}
