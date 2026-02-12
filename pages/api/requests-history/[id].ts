import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid request id" });

  const request = await prisma.request.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true, userId: true },
  });

  if (!request) return res.status(404).json({ error: "Request not found" });
  if (session.role !== "ADMIN" && request.userId !== session.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rows = await prisma.requestStatusAudit.findMany({
    where: { requestId: id, tenantId: session.tenantId },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return res.status(200).json(
    rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}
