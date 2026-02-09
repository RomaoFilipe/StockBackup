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
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/authContext";

type ApiNotificationRequest = {
  id: string;
  gtmiNumber: string;
  title: string | null;
  requesterName: string | null;
  deliveryLocation: string | null;
  createdAt: string;
  requestedAt: string;
  requestingServiceRef: null | {
    id: number;
    codigo: string;
    designacao: string;
  };
  createdBy: { id: string; name: string | null; email: string | null };
};

type ApiNotificationPublicRequest = {
  id: string;
  status: "RECEIVED" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  requesterName: string | null;
  deliveryLocation: string | null;
  itemsCount: number;
  requestingService: { id: number; codigo: true | string; designacao: string } | null;
};

type StoredNotification = {
  kind: "REQUEST" | "PUBLIC_REQUEST";
  requestId: string;
  createdAt: string;
  gtmiNumber: string;
  title: string | null;
  requesterName: string | null;
  requestingServiceName: string | null;
  deliveryLocation: string | null;
  createdByName: string | null;
  read: boolean;
};

const LS_ITEMS_KEY = "stockly:requestNotifications:items";
const LS_LAST_SEEN_REQ_KEY = "stockly:requestNotifications:lastSeenCreatedAt";
const LS_LAST_SEEN_PUBLIC_KEY = "stockly:publicRequestNotifications:lastSeenCreatedAt";

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function uniqueByRequestId(items: StoredNotification[]) {
  const seen = new Set<string>();
  const out: StoredNotification[] = [];
  for (const it of items) {
    if (seen.has(it.requestId)) continue;
    seen.add(it.requestId);
    out.push(it);
  }
  return out;
}

export function RequestsNotificationsBell() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [items, setItems] = useState<StoredNotification[]>([]);
  const [lastSeenRequestCreatedAt, setLastSeenRequestCreatedAt] = useState<string | null>(null);
  const [lastSeenPublicCreatedAt, setLastSeenPublicCreatedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const isInitialHydrationRef = useRef(true);

  const unreadCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.read ? 0 : 1), 0),
    [items]
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    []
  );

  const persist = useCallback((nextItems: StoredNotification[], nextLastSeen: string | null) => {
    try {
      localStorage.setItem(LS_ITEMS_KEY, JSON.stringify(nextItems));
    } catch {
      // ignore
    }
  }, []);

  const persistLastSeen = useCallback((kind: StoredNotification["kind"], value: string | null) => {
    try {
      const key = kind === "PUBLIC_REQUEST" ? LS_LAST_SEEN_PUBLIC_KEY : LS_LAST_SEEN_REQ_KEY;
      if (value) localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const rawItems = safeParseJson<any[]>(localStorage.getItem(LS_ITEMS_KEY)) || [];
    const storedItems = (Array.isArray(rawItems) ? rawItems : []).map((it) => {
      const kind = it?.kind === "PUBLIC_REQUEST" ? "PUBLIC_REQUEST" : "REQUEST";
      return { ...it, kind } as StoredNotification;
    });

    const storedLastSeenReq = localStorage.getItem(LS_LAST_SEEN_REQ_KEY);
    const storedLastSeenPublic = localStorage.getItem(LS_LAST_SEEN_PUBLIC_KEY);

    setItems(Array.isArray(storedItems) ? storedItems : []);
    setLastSeenRequestCreatedAt(storedLastSeenReq);
    setLastSeenPublicCreatedAt(storedLastSeenPublic);
  }, []);

  const fetchLatest = useCallback(async () => {
    const res = await fetch("/api/requests/notifications?limit=30", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiNotificationRequest[];
    return Array.isArray(data) ? data : null;
  }, []);

  const fetchLatestPublic = useCallback(async () => {
    const res = await fetch("/api/admin/public-requests/notifications?limit=30", { method: "GET" });
    if (!res.ok) return null;
    const data = (await res.json()) as ApiNotificationPublicRequest[];
    return Array.isArray(data) ? data : null;
  }, []);

  const applyNew = useCallback(
    (args:
      | { kind: "REQUEST"; latest: ApiNotificationRequest[] }
      | { kind: "PUBLIC_REQUEST"; latest: ApiNotificationPublicRequest[] }) => {
      const { kind } = args;
      const latestMaxCreatedAt = args.latest[0]?.createdAt ?? null;

      const lastSeenCreatedAt =
        kind === "PUBLIC_REQUEST" ? lastSeenPublicCreatedAt : lastSeenRequestCreatedAt;

      // First run: set baseline, don't spam existing requests.
      if (isInitialHydrationRef.current) {
        // Only mark hydration done after we processed both sources at least once.
        // We keep it simple: first tick sets baselines if missing.
        if (!lastSeenCreatedAt && latestMaxCreatedAt) {
          if (kind === "PUBLIC_REQUEST") setLastSeenPublicCreatedAt(latestMaxCreatedAt);
          else setLastSeenRequestCreatedAt(latestMaxCreatedAt);
          persistLastSeen(kind, latestMaxCreatedAt);
        }
        return;
      }

      const lastSeenMs = lastSeenCreatedAt ? new Date(lastSeenCreatedAt).getTime() : 0;

      const newOnes: StoredNotification[] =
        kind === "PUBLIC_REQUEST"
          ? (args.latest as ApiNotificationPublicRequest[])
              .filter((r) => new Date(r.createdAt).getTime() > lastSeenMs)
              .map((r) => ({
                kind,
                requestId: r.id,
                createdAt: r.createdAt,
                gtmiNumber: "(Pedido público)",
                title: null,
                requesterName: r.requesterName,
                requestingServiceName: r.requestingService?.designacao ?? null,
                deliveryLocation: r.deliveryLocation,
                createdByName: null,
                read: false,
              }))
          : (args.latest as ApiNotificationRequest[])
              .filter((r) => new Date(r.createdAt).getTime() > lastSeenMs)
              .map((r) => ({
                kind,
                requestId: r.id,
                createdAt: r.createdAt,
                gtmiNumber: r.gtmiNumber,
                title: r.title,
                requesterName: r.requesterName,
                requestingServiceName: r.requestingServiceRef?.designacao ?? null,
                deliveryLocation: r.deliveryLocation,
                createdByName: r.createdBy?.name ?? null,
                read: false,
              }));

      if (newOnes.length === 0) {
        if (latestMaxCreatedAt && latestMaxCreatedAt !== lastSeenCreatedAt) {
          if (kind === "PUBLIC_REQUEST") setLastSeenPublicCreatedAt(latestMaxCreatedAt);
          else setLastSeenRequestCreatedAt(latestMaxCreatedAt);
          persistLastSeen(kind, latestMaxCreatedAt);
        }
        return;
      }

      const nextLastSeen = latestMaxCreatedAt || lastSeenCreatedAt;

      setItems((prev) => {
        const merged = uniqueByRequestId([...newOnes, ...prev]).slice(0, 50);
        persist(merged, null);
        return merged;
      });

      if (kind === "PUBLIC_REQUEST") setLastSeenPublicCreatedAt(nextLastSeen);
      else setLastSeenRequestCreatedAt(nextLastSeen);
      persistLastSeen(kind, nextLastSeen);

      toast({
        title: kind === "PUBLIC_REQUEST" ? "Novo pedido recebido" : "Novo pedido",
        description:
          newOnes.length === 1
            ? `Recebeste 1 novo pedido (${newOnes[0].gtmiNumber}).`
            : `Recebeste ${newOnes.length} novos pedidos.`,
      });
    },
    [
      lastSeenPublicCreatedAt,
      lastSeenRequestCreatedAt,
      persist,
      persistLastSeen,
      toast,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const latest = await fetchLatest();
        if (!cancelled && latest && latest.length > 0) {
          applyNew({ kind: "REQUEST", latest });
        }

        if (user?.role === "ADMIN") {
          const latestPublic = await fetchLatestPublic();
          if (!cancelled && latestPublic && latestPublic.length > 0) {
            applyNew({ kind: "PUBLIC_REQUEST", latest: latestPublic });
          }
        }

        // Mark hydration done after first tick.
        if (isInitialHydrationRef.current) {
          isInitialHydrationRef.current = false;
        }
      } catch {
        // ignore
      }
    };

    // Run once after mount, then poll.
    tick();
    const interval = window.setInterval(tick, 25000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyNew, fetchLatest, fetchLatestPublic, user?.role]);

  useEffect(() => {
    if (!open) return;
    // Mark all read when opening dropdown.
    setItems((prev) => {
      const next = prev.map((it) => (it.read ? it : { ...it, read: true }));
      persist(next, null);
      return next;
    });
  }, [open, persist]);

  const handleOpenRequest = (notification: StoredNotification) => {
    if (notification.kind === "PUBLIC_REQUEST") {
      router.push(`/admin?tab=received&publicRequestId=${encodeURIComponent(notification.requestId)}`);
      return;
    }
    router.push(`/requests/${notification.requestId}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <span className="relative">
            <Bell className="h-[1.2rem] w-[1.2rem]" />
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </span>
          <span className="sr-only">Abrir notificações</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px]">
        <DropdownMenuLabel>Notificações de pedidos</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Sem notificações.
          </div>
        ) : (
          items.map((it) => {
            const when = (() => {
              const d = new Date(it.createdAt);
              return Number.isNaN(d.getTime()) ? "" : timeFormatter.format(d);
            })();

            const titleParts = [it.gtmiNumber];
            if (it.requestingServiceName) titleParts.push(it.requestingServiceName);
            const subtitleParts = [
              it.requesterName ? `Por: ${it.requesterName}` : null,
              it.deliveryLocation ? `Entrega: ${it.deliveryLocation}` : null,
              when ? when : null,
            ].filter(Boolean);

            return (
              <DropdownMenuItem
                key={it.requestId}
                onSelect={(e) => {
                  e.preventDefault();
                  handleOpenRequest(it);
                }}
                className="flex flex-col items-start gap-1"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {titleParts.join(" • ")}
                  </div>
                  {!it.read ? (
                    <span className="h-2 w-2 rounded-full bg-destructive" />
                  ) : null}
                </div>
                {subtitleParts.length > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {subtitleParts.join(" • ")}
                  </div>
                ) : null}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
