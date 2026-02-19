import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getSessionServer } from "@/utils/auth";
import { getSubstitutionEventById } from "@/utils/substitutionEvents";

const querySchema = z.object({
  id: z.string().uuid(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  try {
    const event = await getSubstitutionEventById(session.tenantId, parsed.data.id);
    if (!event) return res.status(404).json({ error: "Substitution not found" });
    return res.status(200).json(event);
  } catch (error) {
    console.error("GET /api/units/substitutions/[id] error:", error);
    return res.status(500).json({ error: "Failed to fetch substitution" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
