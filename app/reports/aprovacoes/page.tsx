"use client";

import { useEffect, useMemo, useState } from "react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type RequestingServiceRow = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ApprovalsReportPage() {
  const { toast } = useToast();

  const [services, setServices] = useState<RequestingServiceRow[]>([]);
  const [serviceId, setServiceId] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toDateInputValue(d);
  });
  const [dateTo, setDateTo] = useState<string>(() => toDateInputValue(new Date()));
  const [limit, setLimit] = useState<string>("5000");
  const [loadingServices, setLoadingServices] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingServices(true);
    (async () => {
      try {
        const res = await axiosInstance.get("/requesting-services");
        if (!alive) return;
        setServices(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!alive) return;
        setServices([]);
      } finally {
        if (!alive) return;
        setLoadingServices(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const downloadUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    const nLimit = Number(limit);
    if (Number.isFinite(nLimit) && nLimit > 0) qs.set("limit", String(nLimit));
    if (serviceId !== "ALL") qs.set("requestingServiceId", serviceId);
    return `/api/reports/approvals/csv?${qs.toString()}`;
  }, [dateFrom, dateTo, limit, serviceId]);

  const download = () => {
    try {
      window.open(downloadUrl, "_blank");
    } catch {
      toast({ title: "Relatórios", description: "Não foi possível abrir o download.", variant: "destructive" });
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Relatório de aprovações"
          description="Exporta quem aprovou/rejeitou o quê e quando (CSV) a partir do histórico do workflow."
          actions={<Button onClick={download}>Download CSV</Button>}
        />

        <SectionCard title="Filtros" description="Se não tiveres scope global, a exportação será limitada aos teus serviços permitidos.">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Data (início)</div>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Data (fim)</div>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Serviço</div>
              <select
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                disabled={loadingServices}
              >
                <option value="ALL">Todos (permitidos)</option>
                {services
                  .slice()
                  .sort((a, b) => a.codigo.localeCompare(b.codigo))
                  .map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {s.codigo} — {s.designacao}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-medium">Limite</div>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="5000" />
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground break-all">
            Endpoint: {downloadUrl}
          </div>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}

