"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type ReportSummary = {
  totalTickets: number;
  closedCount: number;
  resolvedCount: number;
  escalatedCount: number;
  breachedCount: number;
  withLinkedRequestsCount: number;
};

type ReportItem = {
  id: string;
  code: string;
  title: string;
  status: string;
  priority: string;
  level: string;
  createdAt: string;
  assignedTo?: { name?: string | null; email: string } | null;
  counts?: { messages: number; audits: number; linkedRequests: number };
};

type TicketOperationsReport = {
  generatedAt: string;
  summary: ReportSummary;
  items: ReportItem[];
};

const statusOptions = [
  { value: "ALL", label: "Todos estados" },
  { value: "OPEN", label: "OPEN" },
  { value: "IN_PROGRESS", label: "IN_PROGRESS" },
  { value: "WAITING_CUSTOMER", label: "WAITING_CUSTOMER" },
  { value: "ESCALATED", label: "ESCALATED" },
  { value: "RESOLVED", label: "RESOLVED" },
  { value: "CLOSED", label: "CLOSED" },
] as const;

const levelOptions = [
  { value: "ALL", label: "Todos níveis" },
  { value: "L1", label: "L1" },
  { value: "L2", label: "L2" },
  { value: "L3", label: "L3" },
] as const;

const priorityOptions = [
  { value: "ALL", label: "Todas prioridades" },
  { value: "LOW", label: "LOW" },
  { value: "NORMAL", label: "NORMAL" },
  { value: "HIGH", label: "HIGH" },
  { value: "CRITICAL", label: "CRITICAL" },
] as const;

export default function TicketOperationsReportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<TicketOperationsReport | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]["value"]>("ALL");
  const [level, setLevel] = useState<(typeof levelOptions)[number]["value"]>("ALL");
  const [priority, setPriority] = useState<(typeof priorityOptions)[number]["value"]>("ALL");
  const [includeClosed, setIncludeClosed] = useState(true);
  const [limit, setLimit] = useState("200");

  const params = useMemo(() => {
    const parsedLimit = Number(limit);
    return {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(status !== "ALL" ? { status } : {}),
      ...(level !== "ALL" ? { level } : {}),
      ...(priority !== "ALL" ? { priority } : {}),
      includeClosed: includeClosed ? "1" : "0",
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? String(Math.floor(parsedLimit)) : "200",
    };
  }, [from, to, status, level, priority, includeClosed, limit]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/reports/ticket-operations", { params });
      setReport(res.data as TicketOperationsReport);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível gerar o relatório.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-operations-report-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/reports/ticket-operations");
      return;
    }
    if (user?.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, user?.role, router]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatório de Tickets</h1>
          <p className="text-sm text-muted-foreground">Consolidado de tickets, requisições e intervenções</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
                <SelectTrigger>
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Limite" />
              <div className="flex items-center gap-2">
                <Button variant={includeClosed ? "default" : "outline"} onClick={() => setIncludeClosed((v) => !v)}>
                  {includeClosed ? "Inclui fechados" : "Sem fechados"}
                </Button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={loadReport} disabled={loading}>
                {loading ? "A gerar..." : "Gerar relatório"}
              </Button>
              <Button variant="outline" onClick={exportJson} disabled={!report}>
                Exportar JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {report ? (
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Card><CardContent className="p-4 text-sm">Total: <b>{report.summary.totalTickets}</b></CardContent></Card>
            <Card><CardContent className="p-4 text-sm">Fechados: <b>{report.summary.closedCount}</b></CardContent></Card>
            <Card><CardContent className="p-4 text-sm">Resolvidos: <b>{report.summary.resolvedCount}</b></CardContent></Card>
            <Card><CardContent className="p-4 text-sm">Escalados: <b>{report.summary.escalatedCount}</b></CardContent></Card>
            <Card><CardContent className="p-4 text-sm">SLA violado: <b>{report.summary.breachedCount}</b></CardContent></Card>
            <Card><CardContent className="p-4 text-sm">Com requisições: <b>{report.summary.withLinkedRequestsCount}</b></CardContent></Card>
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {!report?.items?.length ? (
              <div className="text-sm text-muted-foreground">Sem dados para os filtros selecionados.</div>
            ) : (
              <div className="space-y-2">
                {report.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{item.code} · {item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("pt-PT")} · {item.assignedTo?.name || item.assignedTo?.email || "Sem técnico"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.status}</Badge>
                        <Badge variant="outline">{item.level}</Badge>
                        <Badge variant="outline">{item.priority}</Badge>
                        <Badge variant="outline">Msgs {item.counts?.messages ?? 0}</Badge>
                        <Badge variant="outline">Logs {item.counts?.audits ?? 0}</Badge>
                        <Badge variant="outline">Reqs {item.counts?.linkedRequests ?? 0}</Badge>
                        <Button size="sm" variant="outline" onClick={() => router.push(`/tickets/${item.id}`)}>
                          Abrir
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
