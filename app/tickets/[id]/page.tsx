"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "ESCALATED" | "RESOLVED" | "CLOSED";
type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
type TicketType = "INCIDENT" | "REQUEST" | "QUESTION" | "CHANGE";
type TicketLevel = "L1" | "L2" | "L3";

type TicketUser = { id: string; name?: string | null; email: string; role?: "USER" | "ADMIN" };

type TicketMessage = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: TicketUser;
};

type TicketDetails = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
  level: TicketLevel;
  escalationReason?: string | null;
  dueAt?: string | null;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaBreachedAt?: string | null;
  lastEscalatedAt?: string | null;
  slaEscalationCount?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketUser;
  assignedTo?: TicketUser | null;
  requests?: Array<{
    id: string;
    gtmiNumber: string;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
    title?: string | null;
    requestedAt?: string | null;
    linkedAt?: string | null;
  }>;
  audits?: Array<{
    id: string;
    action: string;
    note?: string | null;
    createdAt: string;
    actor?: { id: string; name?: string | null; email: string } | null;
    data?: any;
  }>;
  messages: TicketMessage[];
};

type AdminUserRow = { id: string; name: string; email: string; role: "USER" | "ADMIN"; isActive: boolean };
type MyRequestRow = {
  id: string;
  gtmiNumber?: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  title?: string | null;
  requestedAt?: string | null;
};

function fmtDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-PT");
}

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "OPEN", label: "Aberto" },
  { value: "IN_PROGRESS", label: "Em progresso" },
  { value: "WAITING_CUSTOMER", label: "A aguardar cliente" },
  { value: "ESCALATED", label: "Escalado" },
  { value: "RESOLVED", label: "Resolvido" },
  { value: "CLOSED", label: "Fechado" },
];

const priorityOptions: Array<{ value: TicketPriority; label: string }> = [
  { value: "LOW", label: "Baixa" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "Alta" },
  { value: "CRITICAL", label: "Crítica" },
];

const typeOptions: Array<{ value: TicketType; label: string }> = [
  { value: "INCIDENT", label: "Incidente" },
  { value: "REQUEST", label: "Pedido" },
  { value: "QUESTION", label: "Dúvida" },
  { value: "CHANGE", label: "Mudança" },
];

const levelOptions: Array<{ value: TicketLevel; label: string }> = [
  { value: "L1", label: "Nível 1" },
  { value: "L2", label: "Nível 2" },
  { value: "L3", label: "Nível 3" },
];

export default function TicketDetailsPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params?.id;
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequestRow[]>([]);
  const [selectedMyRequestId, setSelectedMyRequestId] = useState("");
  const [sending, setSending] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "online" | "offline">("connecting");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  const [type, setType] = useState<TicketType>("QUESTION");
  const [level, setLevel] = useState<TicketLevel>("L1");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [escalationReason, setEscalationReason] = useState("");
  const [linkedRequestId, setLinkedRequestId] = useState("");
  const [linkingRequest, setLinkingRequest] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  const isTicketClosed = ticket?.status === "CLOSED";
  const canSend = Boolean(messageBody.trim());

  const loadTicket = async () => {
    if (!ticketId) return;
    try {
      const res = await axiosInstance.get(`/tickets/${ticketId}`);
      const data = res.data as TicketDetails;
      setTicket(data);
      setTitle(data.title || "");
      setDescription(data.description || "");
      setStatus(data.status);
      setPriority(data.priority);
      setType(data.type);
      setLevel(data.level);
      setAssignedToUserId(data.assignedTo?.id || "");
      setEscalationReason(data.escalationReason || "");
      setLinkedRequestId("");
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      router.push("/DB?tab=tickets");
    }
  };

  const loadAssignableUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await axiosInstance.get("/users");
      const rows = Array.isArray(res.data) ? (res.data as AdminUserRow[]) : [];
      setUsers(rows.filter((u) => u.isActive));
    } catch {
      setUsers([]);
    }
  };

  const loadMyRequests = async () => {
    if (isAdmin) return;
    try {
      const res = await axiosInstance.get("/requests", {
        params: { mine: 1, paged: 1, page: 1, pageSize: 100 },
      });
      const rows = Array.isArray(res.data?.items) ? (res.data.items as MyRequestRow[]) : [];
      setMyRequests(rows);
    } catch {
      setMyRequests([]);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    const run = async () => {
      setLoading(true);
      await Promise.all([loadTicket(), loadAssignableUsers(), loadMyRequests()]);
      setLoading(false);
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, ticketId, isAdmin]);

  useEffect(() => {
    if (!ticketId || !isLoggedIn) return;
    setRealtimeStatus("connecting");
    const es = new EventSource("/api/realtime/stream");
    es.onopen = () => setRealtimeStatus("online");
    es.onerror = () => setRealtimeStatus("offline");
    const onRealtime = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data) as { payload?: { ticketId?: string; data?: { ticketId?: string } } };
        const eventTicketId = data?.payload?.ticketId || data?.payload?.data?.ticketId;
        if (eventTicketId !== ticketId) return;
        void loadTicket();
      } catch {
        // ignore malformed payloads
      }
    };

    es.addEventListener("ticket.message_created", onRealtime);
    es.addEventListener("ticket.updated", onRealtime);
    es.addEventListener("ticket.escalated", onRealtime);
    es.addEventListener("ticket.created", onRealtime);
    es.addEventListener("notification.created", onRealtime);

    return () => {
      es.removeEventListener("ticket.message_created", onRealtime);
      es.removeEventListener("ticket.updated", onRealtime);
      es.removeEventListener("ticket.escalated", onRealtime);
      es.removeEventListener("ticket.created", onRealtime);
      es.removeEventListener("notification.created", onRealtime);
      es.close();
      setRealtimeStatus("offline");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, isLoggedIn]);

  const messages = useMemo(() => ticket?.messages ?? [], [ticket?.messages]);

  const sendMessage = async () => {
    if (!ticketId || !canSend || isTicketClosed) return;
    setSending(true);
    try {
      await axiosInstance.post(`/tickets/${ticketId}/messages`, { body: messageBody.trim() });
      setMessageBody("");
      await loadTicket();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível enviar mensagem.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const saveTicket = async () => {
    if (!ticketId || !isAdmin) return;
    setSavingTicket(true);
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        type,
        level,
        assignedToUserId: assignedToUserId || null,
        escalationReason: escalationReason.trim() || null,
      });
      await loadTicket();
      toast({ title: "Ticket atualizado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSavingTicket(false);
    }
  };

  const linkRequestById = async () => {
    if (!ticketId || !isAdmin || !linkedRequestId.trim()) return;
    setLinkingRequest(true);
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        linkRequestId: linkedRequestId.trim(),
      });
      setLinkedRequestId("");
      await loadTicket();
      toast({ title: "Requisição associada" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível associar requisição.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLinkingRequest(false);
    }
  };

  const linkMyRequest = async () => {
    if (!ticketId || !selectedMyRequestId) return;
    setLinkingRequest(true);
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        linkRequestId: selectedMyRequestId,
      });
      setSelectedMyRequestId("");
      await loadTicket();
      await loadMyRequests();
      toast({ title: "Pedido associado ao ticket" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível associar pedido.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLinkingRequest(false);
    }
  };

  const unlinkRequest = async (requestId: string) => {
    if (!ticketId || !isAdmin) return;
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        unlinkRequestId: requestId,
      });
      await loadTicket();
      toast({ title: "Requisição removida do ticket" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover associação.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const closeTicket = async () => {
    if (!ticketId || !isAdmin) return;
    setClosingTicket(true);
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        status: "CLOSED",
        closeNote: "Finalizado pelo técnico/admin.",
      });
      await loadTicket();
      toast({ title: "Ticket finalizado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível finalizar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setClosingTicket(false);
    }
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-6">A carregar ticket...</div>
      </AuthenticatedLayout>
    );
  }

  if (!ticket) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-6">Ticket não encontrado.</div>
      </AuthenticatedLayout>
    );
  }

  const linkedRequestIds = new Set((ticket.requests || []).map((r) => r.id));
  const availableMyRequests = myRequests.filter((r) => !linkedRequestIds.has(r.id));

  return (
    <AuthenticatedLayout>
      <div className="space-y-4">
        <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-mono text-xs text-muted-foreground">{ticket.code}</div>
              <h1 className="text-2xl font-semibold">{ticket.title}</h1>
              <div className="text-xs text-muted-foreground">
                Criado por {ticket.createdBy?.name || ticket.createdBy?.email} em {fmtDateTime(ticket.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  realtimeStatus === "online"
                    ? "border-emerald-500/30 text-emerald-700"
                    : realtimeStatus === "connecting"
                      ? "border-amber-500/30 text-amber-700"
                      : "border-rose-500/30 text-rose-700"
                }
              >
                {realtimeStatus === "online" ? "Realtime ligado" : realtimeStatus === "connecting" ? "A ligar realtime..." : "Realtime offline"}
              </Badge>
              <Badge variant="outline">{ticket.level}</Badge>
              <Badge variant="outline">{ticket.type}</Badge>
              <Badge variant="outline">{ticket.status}</Badge>
              <Badge variant="outline">Reqs: {ticket.requests?.length || 0}</Badge>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
            <div className="mb-3 text-sm font-semibold">Chat do Ticket</div>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {messages.map((m) => {
                const mine = m.author.id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 ${mine ? "border-primary/30 bg-primary/5" : "border-border/60 bg-[hsl(var(--surface-2)/0.5)]"}`}
                  >
                    <div className="text-xs text-muted-foreground">
                      {m.author.name || m.author.email} · {fmtDateTime(m.createdAt)}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm">{m.body}</div>
                  </div>
                );
              })}
              {!messages.length ? <div className="text-sm text-muted-foreground">Sem mensagens ainda.</div> : null}
            </div>

            <div className="mt-3 space-y-2">
              {isTicketClosed ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                  Este ticket está fechado. O envio de mensagens foi desativado.
                </div>
              ) : null}
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Escreve uma mensagem..."
                rows={4}
                disabled={isTicketClosed}
              />
              <div className="flex justify-end">
                <Button onClick={sendMessage} disabled={!canSend || sending || isTicketClosed}>
                  {sending ? "A enviar..." : "Enviar mensagem"}
                </Button>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
            <div className="mb-3 text-sm font-semibold">Gestão</div>
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 p-3">
                <div className="mb-1 text-xs text-muted-foreground">Requisições associadas</div>
                {ticket.requests?.length ? (
                  <div className="space-y-2">
                    {ticket.requests.map((req) => (
                      <div key={req.id} className="rounded-md border border-border/50 p-2">
                        <div className="text-sm font-medium">{req.gtmiNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          Estado: {req.status} · {fmtDateTime(req.requestedAt)} · ligado em {fmtDateTime(req.linkedAt)}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => router.push(`/requests/${req.id}`)}>
                            Abrir
                          </Button>
                          {isAdmin ? (
                            <Button size="sm" variant="outline" onClick={() => void unlinkRequest(req.id)}>
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Sem requisições ligadas.</div>
                )}
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/requests?openCreate=1&ticketId=${ticket.id}`)}
                  >
                    Criar novo pedido associado
                  </Button>
                </div>
                {isAdmin ? (
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-muted-foreground">Associar requisição existente (ID)</div>
                    <div className="flex gap-2">
                      <Input
                        value={linkedRequestId}
                        onChange={(e) => setLinkedRequestId(e.target.value)}
                        placeholder="UUID da requisição"
                      />
                      <Button size="sm" variant="outline" onClick={() => void linkRequestById()} disabled={linkingRequest || !linkedRequestId.trim()}>
                        {linkingRequest ? "A ligar..." : "Ligar"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-muted-foreground">Associar um pedido teu existente</div>
                    <div className="flex gap-2">
                      <select
                        className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                        value={selectedMyRequestId}
                        onChange={(e) => setSelectedMyRequestId(e.target.value)}
                        disabled={linkingRequest || availableMyRequests.length === 0}
                      >
                        <option value="">
                          {availableMyRequests.length ? "Seleciona um pedido" : "Sem pedidos teus por associar"}
                        </option>
                        {availableMyRequests.map((req) => (
                          <option key={req.id} value={req.id}>
                            {(req.gtmiNumber || req.id).slice(0, 28)} · {req.status}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void linkMyRequest()}
                        disabled={linkingRequest || !selectedMyRequestId}
                      >
                        {linkingRequest ? "A ligar..." : "Associar"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Estado</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  disabled={!isAdmin}
                >
                  {statusOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Prioridade</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  disabled={!isAdmin}
                >
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Tipo</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as TicketType)}
                  disabled={!isAdmin}
                >
                  {typeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Nível</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as TicketLevel)}
                  disabled={!isAdmin}
                >
                  {levelOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Título</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isAdmin} />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Descrição</div>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isAdmin} rows={4} />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Razão de escalonamento</div>
                <Input value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} disabled={!isAdmin} />
              </div>

              <div>
                <div className="mb-1 text-xs text-muted-foreground">Responsável</div>
                <select
                  className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="">Sem responsável</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <Button className="w-full" onClick={saveTicket} disabled={!isAdmin || savingTicket || !title.trim()}>
                  {savingTicket ? "A guardar..." : "Guardar alterações"}
                </Button>
              </div>

              {isAdmin ? (
                <div>
                  <Button
                    variant="outline"
                    className="w-full border-rose-300 text-rose-700"
                    onClick={() => void closeTicket()}
                    disabled={closingTicket || ticket.status === "CLOSED"}
                  >
                    {closingTicket ? "A finalizar..." : ticket.status === "CLOSED" ? "Ticket já finalizado" : "Finalizar ticket"}
                  </Button>
                </div>
              ) : null}

              <div className="rounded-xl border border-border/60 p-3 text-xs text-muted-foreground">
                <div>SLA 1ª resposta: {fmtDateTime(ticket.firstResponseDueAt)}</div>
                <div>SLA resolução: {fmtDateTime(ticket.resolutionDueAt)}</div>
                <div>SLA breached em: {fmtDateTime(ticket.slaBreachedAt)}</div>
                <div>Último escalonamento: {fmtDateTime(ticket.lastEscalatedAt)}</div>
                <div>Nº escalonamentos: {ticket.slaEscalationCount ?? 0}</div>
                <div>Primeira resposta: {fmtDateTime(ticket.firstResponseAt)}</div>
                <div>Resolvido em: {fmtDateTime(ticket.resolvedAt)}</div>
                <div>Fechado em: {fmtDateTime(ticket.closedAt)}</div>
                <div>Atualizado em: {fmtDateTime(ticket.updatedAt)}</div>
              </div>

              {isAdmin ? (
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="mb-2 text-xs text-muted-foreground">Logs de auditoria (persistentes)</div>
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {(ticket.audits || []).length ? (
                      ticket.audits?.map((a) => (
                        <div key={a.id} className="rounded-md border border-border/50 p-2 text-xs">
                          <div className="font-medium">{a.action}</div>
                          <div className="text-muted-foreground">
                            {fmtDateTime(a.createdAt)} · {a.actor?.name || a.actor?.email || "sistema"}
                          </div>
                          {a.note ? <div className="mt-1">{a.note}</div> : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">Sem logs.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </AuthenticatedLayout>
  );
}
