"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";
import { renderBusinessInsightsReportHtml } from "@/utils/businessInsightsReportTemplate";
import type { BusinessInsightsReportData } from "@/utils/businessInsightsReport";

export default function BusinessInsightsReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [report, setReport] = useState<BusinessInsightsReportData | null>(null);

  const period = searchParams?.get("period") || "30d";
  const startDate = searchParams?.get("startDate") || "";
  const endDate = searchParams?.get("endDate") || "";
  const serviceId = searchParams?.get("serviceId") || "";
  const categoryId = searchParams?.get("categoryId") || "";

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/reports/business-insights");
      return;
    }
    if (user?.role !== "ADMIN") {
      router.replace("/");
      return;
    }

    setLoading(true);
    setError("");
    void axiosInstance
      .get("/reports/business-insights/data", {
        params: {
          period,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(serviceId ? { serviceId } : {}),
          ...(categoryId ? { categoryId } : {}),
        },
      })
      .then((res) => setReport(res.data as BusinessInsightsReportData))
      .catch((err: any) => setError(err?.response?.data?.error || "Falha ao gerar preview do relatório."))
      .finally(() => setLoading(false));
  }, [isAuthLoading, isLoggedIn, user?.role, router, period, startDate, endDate, serviceId, categoryId]);

  const srcDoc = useMemo(() => {
    if (!report) return "";
    return renderBusinessInsightsReportHtml(report);
  }, [report]);

  if (loading) {
    return <div style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>A gerar preview...</div>;
  }

  if (error) {
    return <div style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>Erro: {error}</div>;
  }

  if (!report) {
    return <div style={{ background: "#fff", minHeight: "100vh", padding: 24 }}>Sem dados para gerar relatório.</div>;
  }

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <iframe
        title="Business Insights Report"
        srcDoc={srcDoc}
        style={{ width: "100%", height: "100vh", border: "none", background: "#fff" }}
      />
    </div>
  );
}
