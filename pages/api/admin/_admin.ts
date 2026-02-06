import type { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";

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

// This file is also treated as an API route by Next.js because it's under pages/api.
// Provide a default export to satisfy route module expectations.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  return res.status(404).end();
}
