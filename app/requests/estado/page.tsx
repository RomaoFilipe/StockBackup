"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RequestDto = {
  id: string;
  gtmiNumber: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  requestedAt: string;
  workflowState?: { code: string; name: string } | null;
  items?: any[];
  requestingService?: string | null;
  title?: string | null;
  userId?: string;
  source?: "REQUEST";
};

const statusMeta = (s: RequestDto["status"]) => {
  switch (s) {
    case "DRAFT":
      return { label: "Rascunho" };
    case "SUBMITTED":
      return { label: "Submetida" };
    case "APPROVED":
      return { label: "Aprovado" };
    case "REJECTED":
      return { label: "Rejeitada" };
    case "FULFILLED":
      return { label: "Cumprida" };
    default:
      return { label: s };
  }
};

const pickupMeta = (r: Pick<RequestDto, "status" | "workflowState">) => {
  switch (r.status) {
    case "SUBMITTED":
      return r.workflowState?.code === "AWAITING_ADMIN_APPROVAL" ? "Aguarda aprovação final" : "Em validação (chefia)";
    case "APPROVED":
      return "Por levantar";
    case "FULFILLED":
      return "Levantando / Aprovado";
    case "REJECTED":
      return "Rejeitado";
    case "DRAFT":
      return "Por submeter";
    default:
      return r.status;
  }
};

const pickupBadgeClass = (s: RequestDto["status"]) => {
  switch (s) {
    case "SUBMITTED":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "FULFILLED":
      return "bg-emerald-600/10 text-emerald-800 border-emerald-600/20";
    case "REJECTED":
      return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    case "DRAFT":
      return "bg-muted/50 text-muted-foreground border-border/60";
    default:
      return "bg-muted/50 text-muted-foreground border-border/60";
  }
};

export default function RequestsStatusPage() {
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestDto[]>([]);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "READY" | "DONE" | "REJECTED">("ALL");

  const loadRequests = useCallback(async () => {
    if (!isLoggedIn || !user) return;
    setLoading(true);
    try {
      if (user.role === "USER") {
        const [reqRes] = await Promise.all([
          axiosInstance.get("/requests?mine=1"),
        ]);

        const reqData = Array.isArray(reqRes.data) ? reqRes.data : [];
        const myRequests: RequestDto[] = reqData.map((r: any) => ({ ...r, source: "REQUEST" as const }));
        setRequests(myRequests);
      } else {
        const res = await axiosInstance.get("/requests");
        const data = Array.isArray(res.data) ? res.data : [];
        setRequests(data);
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível carregar pedidos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, toast, user]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    void loadRequests();
  }, [isAuthLoading, isLoggedIn, loadRequests, router]);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    const es = new EventSource("/api/realtime/stream");
    const reload = () => {
      void loadRequests();
    };
    es.addEventListener("request.created", reload);
    es.addEventListener("request.updated", reload);
    es.addEventListener("request.status_changed", reload);
    es.addEventListener("public-request.accepted", reload);
    es.addEventListener("public-request.rejected", reload);
    return () => {
      es.removeEventListener("request.created", reload);
      es.removeEventListener("request.updated", reload);
      es.removeEventListener("request.status_changed", reload);
      es.removeEventListener("public-request.accepted", reload);
      es.removeEventListener("public-request.rejected", reload);
      es.close();
    };
  }, [isAuthLoading, isLoggedIn, loadRequests]);

  useEffect(() => {
    const submitted = searchParams?.get("submitted");
    if (!submitted) return;
    toast({ title: "Pedido recebido", description: `ID: ${submitted}` });
  }, [searchParams, toast]);

  const sortedRequests = [...requests].sort((a, b) => {
    const at = new Date(a.requestedAt).getTime();
    const bt = new Date(b.requestedAt).getTime();
    return bt - at;
  });

  const filterCounts = useMemo(() => {
    const counts = { ALL: sortedRequests.length, PENDING: 0, READY: 0, DONE: 0, REJECTED: 0 };
    for (const r of sortedRequests) {
      if (r.status === "SUBMITTED" || r.status === "DRAFT") counts.PENDING += 1;
      if (r.status === "APPROVED") counts.READY += 1;
      if (r.status === "FULFILLED") counts.DONE += 1;
      if (r.status === "REJECTED") counts.REJECTED += 1;
    }
    return counts;
  }, [sortedRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "ALL") return sortedRequests;
    if (statusFilter === "PENDING") return sortedRequests.filter((r) => r.status === "SUBMITTED" || r.status === "DRAFT");
    if (statusFilter === "READY") return sortedRequests.filter((r) => r.status === "APPROVED");
    if (statusFilter === "DONE") return sortedRequests.filter((r) => r.status === "FULFILLED");
    return sortedRequests.filter((r) => r.status === "REJECTED");
  }, [sortedRequests, statusFilter]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Estado do Pedido"
          description="Acompanhe o estado das suas requisições"
          actions={
            user?.role === "USER" ? (
              <Button onClick={() => router.push("/requests/estado/novo")}>+ Novo Pedido</Button>
            ) : null
          }
        />
        {user?.role === "USER" ? (
          <Card>
            <CardHeader>
              <CardTitle>Todos os meus pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">A carregar...</div>
              ) : (
                <>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" variant={statusFilter === "ALL" ? "default" : "outline"} onClick={() => setStatusFilter("ALL")}>
                  Todos ({filterCounts.ALL})
                </Button>
                <Button size="sm" variant={statusFilter === "PENDING" ? "default" : "outline"} onClick={() => setStatusFilter("PENDING")}>
                  A preparar ({filterCounts.PENDING})
                </Button>
                <Button size="sm" variant={statusFilter === "READY" ? "default" : "outline"} onClick={() => setStatusFilter("READY")}>
                  Por levantar ({filterCounts.READY})
                </Button>
                <Button size="sm" variant={statusFilter === "DONE" ? "default" : "outline"} onClick={() => setStatusFilter("DONE")}>
                  Concluídos ({filterCounts.DONE})
                </Button>
                <Button size="sm" variant={statusFilter === "REJECTED" ? "default" : "outline"} onClick={() => setStatusFilter("REJECTED")}>
                  Rejeitados ({filterCounts.REJECTED})
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GTMI</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-sm text-muted-foreground">
                          Sem pedidos.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((r) => {
                        const meta = statusMeta(r.status);
                        return (
                          <TableRow key={`row-${r.id}`}>
                            <TableCell className="font-mono text-xs">{r.gtmiNumber}</TableCell>
                            <TableCell className="max-w-[320px]">
                              <div className="truncate">{r.title ?? "—"}</div>
                            </TableCell>
                            <TableCell>{r.requestingService ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{meta.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={pickupBadgeClass(r.status)}>
                                {pickupMeta(r)}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(r.requestedAt).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => router.push(`/requests/${r.id}`)}>
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AuthenticatedLayout>
  );
}
