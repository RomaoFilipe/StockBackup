import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { prisma } from "@/prisma/client";
import { getSessionServer } from "@/utils/auth";
import {
  buildBusinessInsightsReportData,
  resolvePeriodRange,
  type BusinessInsightsReportFilters,
} from "@/utils/businessInsightsReport";
import { renderBusinessInsightsReportHtml } from "@/utils/businessInsightsReportTemplate";
import { launchPdfBrowser } from "@/utils/puppeteer";

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
    if (v.period === "custom") {
      if (!v.startDate || !v.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "custom period requires startDate and endDate",
          path: ["period"],
        });
      }
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
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters", issues: parsed.error.flatten() });
  }

  const filters: BusinessInsightsReportFilters = {
    period: parsed.data.period,
    ...(parsed.data.startDate ? { startDate: parsed.data.startDate } : {}),
    ...(parsed.data.endDate ? { endDate: parsed.data.endDate } : {}),
    ...(typeof parsed.data.serviceId === "number" ? { serviceId: parsed.data.serviceId } : {}),
    ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
  };

  try {
    // Validates custom period consistency early.
    resolvePeriodRange(filters);

    if (typeof filters.serviceId === "number") {
      const service = await prisma.requestingService.findUnique({
        where: { id: filters.serviceId },
        select: { id: true, ativo: true },
      });
      if (!service || !service.ativo) {
        return res.status(400).json({ error: "Invalid or inactive serviceId" });
      }
    }

    if (filters.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: filters.categoryId, tenantId: session.tenantId },
        select: { id: true },
      });
      if (!category) {
        return res.status(400).json({ error: "Invalid categoryId" });
      }
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

    const html = renderBusinessInsightsReportHtml(reportData);

    let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;
    let page: Awaited<ReturnType<Awaited<ReturnType<typeof launchPdfBrowser>>["newPage"]>> | null = null;

    try {
      browser = await launchPdfBrowser();
      page = await browser.newPage();

      await page.setContent(html, { waitUntil: ["domcontentloaded", "networkidle0"] });
      if (page.emulateMediaType) {
        await page.emulateMediaType("print");
      }

      const footerTemplate = `
        <div style="font-size:9px;color:#6b7280;width:100%;padding:0 16px;display:flex;justify-content:space-between;">
          <span>Hash: ${reportData.meta.documentHash}</span>
          <span>Página <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`;

      const pdfBytes = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate,
        margin: {
          top: "18mm",
          right: "10mm",
          bottom: "16mm",
          left: "10mm",
        },
      });

      await (prisma as any).report.create({
        data: {
          tenantId: session.tenantId,
          generatedById: session.id,
          period: filters.period,
          filters,
          documentHash: reportData.meta.documentHash,
          filePath: null,
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="stockly-business-insights.pdf"');
      return res.status(200).send(Buffer.from(pdfBytes));
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
      if (browser) {
        try {
          await browser.close();
        } catch {
          // ignore
        }
      }
    }
  } catch (error: any) {
    console.error("GET /api/reports/business-insights error:", error);
    const msg = typeof error?.message === "string" ? error.message : "Failed to generate report";
    return res.status(500).json({ error: msg });
  }
}
