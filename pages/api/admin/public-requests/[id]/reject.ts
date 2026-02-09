import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { requireAdmin } from "../../_admin";

const bodySchema = z.object({
  note: z.string().max(500).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) return;

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "id is required" });

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid body" });

  const row = await prisma.publicRequest.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true, status: true },
  });

  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.status !== "RECEIVED") return res.status(400).json({ error: "Request already handled" });

  await prisma.publicRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      handledAt: new Date(),
      handledByUserId: session.id,
      handledNote: parsed.data.note?.trim() || null,
    },
  });

  return res.status(200).json({ ok: true });
}
