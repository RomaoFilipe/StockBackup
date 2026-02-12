import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getSessionServer } from "@/utils/auth";
import { getOperationsInsights } from "@/utils/operationsInsights";
import { getCached, setCached } from "@/utils/cache";
import { logError, logInfo } from "@/utils/logger";

const querySchema = z.object({
  days: z
    .string()
    .optional()
    .transform((v) => {
      const n = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    })
    .optional(),
  top: z
    .string()
    .optional()
    .transform((v) => {
      const n = typeof v === "string" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    })
    .optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (!session.tenantId) return res.status(500).json({ error: "Session missing tenant" });

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query" });
  }

  try {
    const cacheKey = [
      "insights.operations",
      session.tenantId,
      String(parsed.data.days ?? ""),
      String(parsed.data.top ?? ""),
    ].join(":");
    const cached = getCached<any>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cached);
    }

    const insights = await getOperationsInsights({
      tenantId: session.tenantId,
      days: parsed.data.days,
      topLimit: parsed.data.top,
    });
    setCached(cacheKey, insights, 30_000);
    res.setHeader("X-Cache", "MISS");
    logInfo("Operations insights computed", { tenantId: session.tenantId, cacheKey }, req);

    return res.status(200).json(insights);
  } catch (error) {
    logError("GET /api/insights/operations error", { error: error instanceof Error ? error.message : String(error) }, req);
    return res.status(500).json({ error: "Failed to compute insights" });
  }
}
