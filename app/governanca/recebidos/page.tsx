"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type PublicRequestStatus = "RECEIVED" | "ACCEPTED" | "REJECTED";

type PublicRequestRow = {
  id: string;
  status: PublicRequestStatus;
  createdAt: string;
  handledAt: string | null;
  requesterName: string | null;
  requesterIp: string | null;
  requesterUserId: string | null;
  deliveryLocation: string | null;
  title: string | null;
  notes: string;
  handledNote: string | null;
  handledBy: { id: string; name: string | null; email: string } | null;
  requestingService: { id: number; codigo: string; designacao: string } | null;
  acceptedRequest: { id: string; gtmiNumber: string } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unit: string | null;
    notes: string | null;
    product: { id: string; name: string; sku: string } | null;
  }>;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-PT");
}

function statusBadge(s: PublicRequestStatus) {
  switch (s) {
    case "RECEIVED":
      return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">Recebido</Badge>;
    case "ACCEPTED":
      return <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">Aceite</Badge>;
    case "REJECTED":
      return <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20">Recusado</Badge>;
    default:
      return <Badge variant="outline">{s}</Badge>;
  }
}

function originBadge(r: Pick<PublicRequestRow, "requesterUserId" | "requesterIp">) {
  if (r.requesterUserId) {
    return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Legado</Badge>;
  }
  return <Badge className="bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20">Portal</Badge>;
}

export default function GovernancaRecebidosPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<PublicRequestStatus>("RECEIVED");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PublicRequestRow[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<PublicRequestRow | null>(null);

  const [handleOpen, setHandleOpen] = useState(false);
  const [handleMode, setHandleMode] = useState<"accept" | "reject">("accept");
  const [handleRow, setHandleRow] = useState<PublicRequestRow | null>(null);
  const [handleNote, setHandleNote] = useState("");
  const [handling, setHandling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/public-requests", { params: { status, limit: 200 } });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      toast({
        title: "Recebidos",
        description: e?.response?.data?.error || "Não foi possível carregar requerimentos recebidos.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [
        r.id,
        r.title ?? "",
        r.notes ?? "",
        r.requesterName ?? "",
        r.requestingService ? `${r.requestingService.codigo} ${r.requestingService.designacao}` : "",
        r.acceptedRequest?.gtmiNumber ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [q, rows]);

  const openDetails = (r: PublicRequestRow) => {
    setDetailsRow(r);
    setDetailsOpen(true);
  };

  const openHandle = (mode: "accept" | "reject", r: PublicRequestRow) => {
    setHandleMode(mode);
    setHandleRow(r);
    setHandleNote("");
    setHandleOpen(true);
  };

  const submitHandle = async () => {
    if (!handleRow) return;
    setHandling(true);
    try {
      if (handleMode === "accept") {
        const res = await axiosInstance.post(`/admin/public-requests/${handleRow.id}/accept`, {
          note: handleNote.trim() ? handleNote.trim() : undefined,
        });
        toast({ title: "Recebidos", description: "Pedido aceite e convertido em requisição." });
        setHandleOpen(false);
        await load();
        const requestId = String(res.data?.requestId ?? "");
        if (requestId) {
          router.push(`/requests/${requestId}`);
        }
      } else {
        await axiosInstance.post(`/admin/public-requests/${handleRow.id}/reject`, {
          note: handleNote.trim() ? handleNote.trim() : undefined,
        });
        toast({ title: "Recebidos", description: "Pedido recusado." });
        setHandleOpen(false);
        await load();
      }
    } catch (e: any) {
      toast({
        title: "Recebidos",
        description: e?.response?.data?.error || "Falha ao processar pedido.",
        variant: "destructive",
      });
    } finally {
      setHandling(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Recebidos (externos)"
          description="Triagem de requerimentos recebidos via portal público (/api/portal/requests) e histórico de entradas externas legadas."
          actions={
            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value as PublicRequestStatus)}
              >
                <option value="RECEIVED">Recebidos</option>
                <option value="ACCEPTED">Aceites</option>
                <option value="REJECTED">Recusados</option>
              </select>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar..." className="w-[260px]" />
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                Recarregar
              </Button>
            </div>
          }
        />

        <SectionCard title="Lista" description="Pedidos recebidos por serviço requisitante (RBAC por âmbito).">
          <div className="mb-3 text-xs text-muted-foreground">
            Nota: “Portal” são pedidos do endpoint público `/api/portal/requests`. “Legado” são registos antigos criados pelo intake interno (antes da unificação).
          </div>
          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar...</div>
          ) : filtered.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Requerente</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell>{originBadge(r)}</TableCell>
                      <TableCell className="text-sm">
                        {r.requestingService ? `${r.requestingService.codigo} — ${r.requestingService.designacao}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.requesterName || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.deliveryLocation || "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.title || "—"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{r.notes}</div>
                        {r.acceptedRequest ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Requisição:{" "}
                            <Button
                              size="sm"
                              variant="link"
                              className="h-auto p-0"
                              onClick={() => router.push(`/requests/${r.acceptedRequest!.id}`)}
                            >
                              {r.acceptedRequest.gtmiNumber}
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">{fmtDateTime(r.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                            Ver
                          </Button>
                          {r.status === "RECEIVED" ? (
                            <>
                              <Button size="sm" onClick={() => openHandle("accept", r)}>
                                Aceitar
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openHandle("reject", r)}>
                                Recusar
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem itens.</div>
          )}
        </SectionCard>
      </main>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes</DialogTitle>
            <DialogDescription>{detailsRow ? `ID: ${detailsRow.id}` : null}</DialogDescription>
          </DialogHeader>
          {detailsRow ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(detailsRow.status)}
                <div className="text-xs text-muted-foreground">
                  {detailsRow.requestingService
                    ? `${detailsRow.requestingService.codigo} — ${detailsRow.requestingService.designacao}`
                    : "—"}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background p-3">
                <div className="text-sm font-medium">{detailsRow.title || "—"}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm">{detailsRow.notes}</div>
              </div>
              {detailsRow.items?.length ? (
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="text-sm font-medium mb-2">Itens</div>
                  <div className="space-y-2">
                    {detailsRow.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.product?.name || it.productId}</div>
                          <div className="text-xs text-muted-foreground">
                            {it.product?.sku ? `SKU: ${it.product.sku} • ` : ""}
                            {it.unit ? `Unid: ${it.unit} • ` : ""}
                            {it.notes || ""}
                          </div>
                        </div>
                        <div className="font-medium">x{it.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {detailsRow.handledAt ? (
                <div className="text-xs text-muted-foreground">
                  Tratado em {fmtDateTime(detailsRow.handledAt)} por {detailsRow.handledBy?.name || detailsRow.handledBy?.email || "—"}
                </div>
              ) : null}
              {detailsRow.handledNote ? (
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="text-sm font-medium">Nota</div>
                  <div className="mt-1 whitespace-pre-wrap text-sm">{detailsRow.handledNote}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={handleOpen} onOpenChange={setHandleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{handleMode === "accept" ? "Aceitar pedido" : "Recusar pedido"}</DialogTitle>
            <DialogDescription>
              {handleRow ? `${handleRow.title || "Sem título"} • ${handleRow.requesterName || "—"}` : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">Nota (opcional)</div>
            <Textarea
              value={handleNote}
              onChange={(e) => setHandleNote(e.target.value)}
              placeholder="Motivo/nota para auditoria…"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHandleOpen(false)} disabled={handling}>
              Cancelar
            </Button>
            <Button
              variant={handleMode === "accept" ? "default" : "destructive"}
              onClick={() => void submitHandle()}
              disabled={handling}
            >
              {handling ? "A guardar..." : handleMode === "accept" ? "Confirmar aceitação" : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
}
