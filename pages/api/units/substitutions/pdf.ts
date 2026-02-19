import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { getSessionServer } from "@/utils/auth";
import { getSubstitutionEventById } from "@/utils/substitutionEvents";
import { buildSubstitutionPdfBuffer } from "@/utils/substitutionPdf";

const querySchema = z.object({
  id: z.string().uuid(),
});

function safeFileBase(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "substitution";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query" });

  try {
    const event = await getSubstitutionEventById(session.tenantId, parsed.data.id);
    if (!event) return res.status(404).json({ error: "Substitution not found" });

    const proto = (req.headers["x-forwarded-proto"] as string) || "http";
    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3000";
    const eventUrl = `${proto}://${host}/scan/substitution/${encodeURIComponent(event.id)}`;

    const pdf = await buildSubstitutionPdfBuffer(event, eventUrl);
    const file = safeFileBase(`substitution_${event.id}.pdf`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    return res.status(200).send(pdf);
  } catch (error) {
    console.error("GET /api/units/substitutions/pdf error:", error);
    return res.status(500).json({ error: "Failed to generate substitution PDF" });
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
