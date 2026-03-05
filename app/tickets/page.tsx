"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TicketListRow = {
  id: string;
  code: string;
  title: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "ESCALATED" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  level: "L1" | "L2" | "L3";
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  assignedTo?: { id: string; name?: string | null; email: string } | null;
  _count?: { messages?: number };
};

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-PT");
}

export default function TicketsListPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "ALL" | "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "ESCALATED" | "RESOLVED" | "CLOSED"
  >("ALL");

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/tickets");
      setTickets(Array.isArray(res.data) ? (res.data as TicketListRow[]) : []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar tickets.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/tickets");
      return;
    }
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      if (status !== "ALL" && t.status !== status) return false;
      if (!q) return true;
      return (
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        (t.createdBy?.name || "").toLowerCase().includes(q)
      );
    });
  }, [tickets, query, status]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Meus Tickets</h1>
            <p className="text-sm text-muted-foreground">Histórico completo dos teus tickets (abertos e fechados).</p>
          </div>
          {user?.role === "ADMIN" ? (
            <Button variant="outline" onClick={() => router.push("/DB?tab=tickets")}>
              Ir para gestão
            </Button>
          ) : null}
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr,220px,120px]">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar por nº ticket/título" />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ALL">Todos estados</option>
            <option value="OPEN">Aberto</option>
            <option value="IN_PROGRESS">Em progresso</option>
            <option value="WAITING_CUSTOMER">A aguardar</option>
            <option value="ESCALATED">Escalado</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="CLOSED">Fechado</option>
          </select>
          <Button variant="outline" onClick={() => void loadTickets()} disabled={loading}>
            {loading ? "A carregar..." : "Recarregar"}
          </Button>
        </div>

        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            Sem tickets para os filtros selecionados.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((ticket) => (
              <article key={ticket.id} className="rounded-xl border border-border/70 bg-[hsl(var(--surface-1)/0.84)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground">{ticket.code}</div>
                    <div className="text-base font-semibold">{ticket.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDateTime(ticket.createdAt)} · {ticket.createdBy?.name || ticket.createdBy?.email || "Sem criador"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ticket.level}</Badge>
                    <Badge variant="outline">{ticket.priority}</Badge>
                    <Badge variant="outline">{ticket.status}</Badge>
                    <Badge variant="outline">Msgs {ticket._count?.messages ?? 0}</Badge>
                    <Button size="sm" variant="outline" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                      Abrir
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
