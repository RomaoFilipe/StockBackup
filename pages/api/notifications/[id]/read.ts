import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Invalid id" });

  const row = await prisma.notification.findFirst({
    where: {
      id,
      tenantId: session.tenantId,
      ...(session.role === "ADMIN" ? {} : { recipientUserId: session.id }),
    },
    select: { id: true, readAt: true },
  });

  if (!row) return res.status(404).json({ error: "Not found" });

  await prisma.notification.update({
    where: { id },
    data: { readAt: row.readAt ? row.readAt : new Date() },
  });

  return res.status(200).json({ ok: true });
}
