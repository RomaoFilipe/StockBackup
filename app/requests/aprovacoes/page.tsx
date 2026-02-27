"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
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

type PendingApprovalRow = {
  id: string;
  gtmiNumber: string;
  status: "SUBMITTED";
  title: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  dueAt: string | null;
  requestedAt: string;
  requesterName: string | null;
  requestingService: string | null;
  requestingServiceId: number | null;
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-PT");
}

function priorityBadge(p?: PendingApprovalRow["priority"]) {
  switch (p) {
    case "URGENT":
      return <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20">Urgente</Badge>;
    case "HIGH":
      return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20">Alta</Badge>;
    case "LOW":
      return <Badge className="bg-muted/50 text-muted-foreground border-border/60">Baixa</Badge>;
    case "NORMAL":
      return <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">Normal</Badge>;
    default:
      return <Badge className="bg-muted/50 text-muted-foreground border-border/60">—</Badge>;
  }
}

export default function PendingApprovalsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PendingApprovalRow[]>([]);
  const [q, setQ] = useState("");

  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decisionMode, setDecisionMode] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [decisionRow, setDecisionRow] = useState<PendingApprovalRow | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/requests/pending-approvals");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      toast({
        title: "Aprovações",
        description: e?.response?.data?.error || "Não foi possível carregar pendentes.",
        variant: "destructive",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = [
        r.gtmiNumber,
        r.title ?? "",
        r.requesterName ?? "",
        r.requestingService ?? "",
        String(r.requestingServiceId ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [q, rows]);

  const openDecision = (mode: "APPROVED" | "REJECTED", row: PendingApprovalRow) => {
    setDecisionMode(mode);
    setDecisionRow(row);
    setDecisionNote("");
    setDecisionOpen(true);
  };

  const submitDecision = async () => {
    if (!decisionRow) return;
    setDeciding(true);
    try {
      await axiosInstance.post(`/workflows/requests/${decisionRow.id}/action`, {
        targetStatus: decisionMode,
        note: decisionNote.trim() ? decisionNote.trim() : undefined,
      });
      toast({
        title: "Aprovações",
        description: decisionMode === "APPROVED"
          ? "Aprovação (chefia) registada. Encaminhado para aprovação final."
          : "Pedido rejeitado.",
      });
      setDecisionOpen(false);
      await load();
    } catch (e: any) {
      toast({
        title: "Aprovações",
        description: e?.response?.data?.error || "Falha ao registar decisão.",
        variant: "destructive",
      });
    } finally {
      setDeciding(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Pendentes para mim"
          description="Pedidos submetidos que aguardam decisão no âmbito do teu serviço/departamento."
          actions={
            <div className="flex gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Pesquisar (GTMI, título, serviço...)"
                className="w-[280px]"
              />
              <Button variant="outline" onClick={() => void load()} disabled={loading}>
                Recarregar
              </Button>
            </div>
          }
        />

        <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar...</div>
          ) : filtered.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GTMI</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.gtmiNumber}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.title || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.requesterName || "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm">{r.requestingService || "—"}</TableCell>
                      <TableCell>{priorityBadge(r.priority)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(r.dueAt)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(r.requestedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/requests/${r.id}`)}>
                            Abrir
                          </Button>
                          <Button size="sm" onClick={() => openDecision("APPROVED", r)}>
                            Aprovar
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => openDecision("REJECTED", r)}>
                            Rejeitar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Sem pedidos pendentes para ti.</div>
          )}
        </div>
      </main>

      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decisionMode === "APPROVED" ? "Aprovar pedido" : "Rejeitar pedido"}</DialogTitle>
            <DialogDescription>
              {decisionRow ? `${decisionRow.gtmiNumber} — ${decisionRow.title || "Sem título"}` : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <div className="text-sm font-medium">Nota (opcional)</div>
            <Textarea
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder="Escreve um motivo/nota para auditoria…"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionOpen(false)} disabled={deciding}>
              Cancelar
            </Button>
            <Button
              variant={decisionMode === "APPROVED" ? "default" : "destructive"}
              onClick={() => void submitDecision()}
              disabled={deciding}
            >
              {deciding ? "A guardar..." : decisionMode === "APPROVED" ? "Confirmar aprovação" : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
}
