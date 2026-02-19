import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getSessionServer } from "@/utils/auth";
import { prisma } from "@/prisma/client";
import { buildBusinessInsightsReportData, type BusinessInsightsReportFilters } from "@/utils/businessInsightsReport";

const querySchema = z
  .object({
    period: z.enum(["7d", "30d", "90d", "12m", "custom"]).default("30d"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    serviceId: z
      .string()
      .optional()
      .transform((v) => {
        if (!v) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      }),
    categoryId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.period === "custom" && (!v.startDate || !v.endDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "custom period requires startDate and endDate", path: ["period"] });
    }
  });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const session = await getSessionServer(req, res);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  if (!session.tenantId) return res.status(500).json({ error: "Session missing tenant" });

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid query parameters" });

  const filters: BusinessInsightsReportFilters = {
    period: parsed.data.period,
    ...(parsed.data.startDate ? { startDate: parsed.data.startDate } : {}),
    ...(parsed.data.endDate ? { endDate: parsed.data.endDate } : {}),
    ...(typeof parsed.data.serviceId === "number" ? { serviceId: parsed.data.serviceId } : {}),
    ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
  };

  try {
    if (typeof filters.serviceId === "number") {
      const service = await prisma.requestingService.findUnique({
        where: { id: filters.serviceId },
        select: { id: true, ativo: true },
      });
      if (!service || !service.ativo) return res.status(400).json({ error: "Invalid or inactive serviceId" });
    }

    if (filters.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: filters.categoryId, tenantId: session.tenantId },
        select: { id: true },
      });
      if (!category) return res.status(400).json({ error: "Invalid categoryId" });
    }

    const reportData = await buildBusinessInsightsReportData({
      tenantId: session.tenantId,
      generatedBy: {
        id: session.id,
        name: session.name ?? "Utilizador",
        email: session.email,
      },
      filters,
    });

    return res.status(200).json(reportData);
  } catch (error: any) {
    console.error("GET /api/reports/business-insights/data error:", error);
    return res.status(500).json({ error: error?.message || "Failed to build report data" });
  }
}
