import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const where = {
    tenantId: session.tenantId,
    readAt: null,
    ...(session.role === "ADMIN" ? {} : { recipientUserId: session.id }),
  };

  const updated = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return res.status(200).json({ ok: true, count: updated.count });
}
