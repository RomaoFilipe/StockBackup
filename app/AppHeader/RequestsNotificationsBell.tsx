"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  kind:
    | "REQUEST_CREATED"
    | "REQUEST_STATUS_CHANGED"
    | "REQUEST_UPDATED"
    | "PUBLIC_REQUEST_RECEIVED"
    | "PUBLIC_REQUEST_ACCEPTED"
    | "PUBLIC_REQUEST_REJECTED"
    | "SECURITY_ALERT"
    | "STORAGE_ALERT";
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  request: null | {
    id: string;
    gtmiNumber: string;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
    title: string | null;
    requestedAt: string;
  };
  data?: any;
};

function resolveRequestId(it: NotificationItem): string | null {
  if (typeof it.request?.id === "string" && it.request.id.trim()) return it.request.id;
  const fromData = it.data && typeof it.data === "object" ? (it.data as Record<string, unknown>).requestId : null;
  if (typeof fromData === "string" && fromData.trim()) return fromData;
  return null;
}

function resolveTicketId(it: NotificationItem): string | null {
  const fromData = it.data && typeof it.data === "object" ? (it.data as Record<string, unknown>).ticketId : null;
  if (typeof fromData === "string" && fromData.trim()) return fromData;
  return null;
}

function kindLabel(kind: NotificationItem["kind"]) {
  switch (kind) {
    case "REQUEST_CREATED":
      return "Novo pedido";
    case "REQUEST_STATUS_CHANGED":
      return "Estado atualizado";
    case "REQUEST_UPDATED":
      return "Pedido atualizado";
    case "PUBLIC_REQUEST_RECEIVED":
      return "Novo recebido";
    case "PUBLIC_REQUEST_ACCEPTED":
      return "Recebido aceite";
    case "PUBLIC_REQUEST_REJECTED":
      return "Recebido recusado";
    case "SECURITY_ALERT":
      return "Alerta segurança";
    case "STORAGE_ALERT":
      return "Alerta storage";
    default:
      return kind;
  }
}

export function RequestsNotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const latestSeenIdRef = useRef<string | null>(null);

  const unreadCount = useMemo(() => items.filter((it) => !it.readAt).length, [items]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=30", { method: "GET" });
      if (!res.ok) return;
      const data = await res.json();
      const nextItems = Array.isArray(data?.items) ? (data.items as NotificationItem[]) : [];
      setItems(nextItems);
      if (!latestSeenIdRef.current && nextItems.length > 0) {
        latestSeenIdRef.current = nextItems[0].id;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, readAt: it.readAt || new Date().toISOString() } : it)));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt || new Date().toISOString() })));
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const es = new EventSource("/api/realtime/stream");
    const onRealtime = () => {
      void loadNotifications();
    };

    es.addEventListener("notification.created", onRealtime);
    es.addEventListener("request.created", onRealtime);
    es.addEventListener("request.updated", onRealtime);
    es.addEventListener("request.status_changed", onRealtime);
    es.addEventListener("public-request.received", onRealtime);
    es.addEventListener("public-request.accepted", onRealtime);
    es.addEventListener("public-request.rejected", onRealtime);

    return () => {
      es.removeEventListener("notification.created", onRealtime);
      es.removeEventListener("request.created", onRealtime);
      es.removeEventListener("request.updated", onRealtime);
      es.removeEventListener("request.status_changed", onRealtime);
      es.removeEventListener("public-request.received", onRealtime);
      es.removeEventListener("public-request.accepted", onRealtime);
      es.removeEventListener("public-request.rejected", onRealtime);
      es.close();
    };
  }, [loadNotifications]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 rounded-full bg-rose-600 text-white text-[10px] px-1.5 py-0.5 leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[380px] max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notificações</span>
          {unreadCount > 0 ? (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.preventDefault(); void markAllRead(); }}>
              Marcar tudo lido
            </Button>
          ) : null}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {loading && items.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">A carregar...</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">Sem notificações.</div>
        ) : (
          items.map((it) => {
            const requestId = resolveRequestId(it);
            const ticketId = resolveTicketId(it);
            const canOpen = Boolean(requestId || ticketId);

            return (
              <DropdownMenuItem
                key={it.id}
                className="flex cursor-pointer flex-col items-start gap-1 py-2"
                onSelect={(e) => {
                  e.preventDefault();
                  void markRead(it.id);
                  if (!canOpen) return;
                  setOpen(false);
                  if (ticketId) {
                    router.push(`/tickets/${ticketId}`);
                    return;
                  }
                  if (requestId) {
                    router.push(`/requests/${requestId}`);
                  }
                }}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">{kindLabel(it.kind)}</div>
                  {!it.readAt ? <span className="h-2 w-2 rounded-full bg-blue-600" /> : null}
                </div>
                <div className="text-sm font-medium line-clamp-1">{it.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{it.message}</div>
                {canOpen ? <div className="text-[11px] font-medium text-blue-700">{ticketId ? "Abrir ticket" : "Abrir pedido"}</div> : null}
                <div className="text-[11px] text-muted-foreground">
                  {new Date(it.createdAt).toLocaleString("pt-PT")}
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
