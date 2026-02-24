import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { prisma } from "@/prisma/client";
import { getUserPermissionGrants, hasPermission } from "@/utils/rbac";

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (session.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  if (!session.tenantId) {
    res.status(500).json({ error: "Session missing tenant" });
    return null;
  }

  return session;
}

export async function requireAdminOrPermission(
  req: NextApiRequest,
  res: NextApiResponse,
  permissionKey: string
) {
  const session = await getSessionServer(req, res);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (!session.tenantId) {
    res.status(500).json({ error: "Session missing tenant" });
    return null;
  }

  if (session.role === "ADMIN") {
    return session;
  }

  const grants = await getUserPermissionGrants(prisma, {
    id: session.id,
    tenantId: session.tenantId,
    role: session.role,
  });

  if (!hasPermission(grants, permissionKey)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return session;
}

// This file is also treated as an API route by Next.js because it's under pages/api.
// Provide a default export to satisfy route module expectations.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).end();
}
