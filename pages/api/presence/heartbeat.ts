import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getSessionServer } from "@/utils/auth";
import { touchPresence } from "@/utils/presenceStore";

const bodySchema = z.object({
  active: z.boolean().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Invalid request body" });

  touchPresence({
    tenantId: session.tenantId,
    userId: session.id,
    active: Boolean(parsed.data.active),
  });

  return res.status(200).json({ ok: true });
}

