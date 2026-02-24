"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";
import { Button } from "@/components/ui/button";

type PresenceStatus = "ONLINE" | "AWAY" | "BUSY" | "MEETING" | "OFFLINE";

type PresenceRow = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  status: PresenceStatus;
  slaCritical: boolean;
  slaCriticalCount: number;
  lastSeenAt?: string | null;
};

type PresencePayload = {
  me: { id: string; manualStatus: "ONLINE" | "BUSY" | "MEETING" | null };
  users: PresenceRow[];
};

const statusMeta: Record<PresenceStatus, { label: string; dotClass: string; order: number }> = {
  ONLINE: { label: "Online", dotClass: "bg-emerald-500", order: 1 },
  AWAY: { label: "Ausente", dotClass: "bg-amber-400", order: 2 },
  BUSY: { label: "Ocupado", dotClass: "bg-rose-500", order: 3 },
  MEETING: { label: "Em reunião", dotClass: "bg-violet-500", order: 4 },
  OFFLINE: { label: "Offline", dotClass: "bg-zinc-400", order: 5 },
};

export default function PresenceWidget() {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PresenceRow[]>([]);
  const [search, setSearch] = useState("");
  const [manualStatus, setManualStatus] = useState<"AUTO" | "ONLINE" | "BUSY" | "MEETING">("AUTO");
  const [savingStatus, setSavingStatus] = useState(false);
  const lastActivePingRef = useRef(0);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const orderDiff = statusMeta[a.status].order - statusMeta[b.status].order;
        if (orderDiff !== 0) return orderDiff;
        return (a.name || a.email).localeCompare(b.name || b.email, "pt-PT");
      }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter((p) => {
      const name = (p.name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [sortedRows, search]);

  const fetchPresence = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/presence");
      const data = res.data as PresencePayload;
      setRows(Array.isArray(data?.users) ? data.users : []);
      setManualStatus(data?.me?.manualStatus ?? "AUTO");
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const pingHeartbeat = async (active: boolean) => {
    try {
      await axiosInstance.post("/presence/heartbeat", { active });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    void fetchPresence();

    const refreshId = window.setInterval(() => {
      void fetchPresence();
    }, 20000);

    const seenId = window.setInterval(() => {
      void pingHeartbeat(false);
    }, 30000);

    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(seenId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;

    const onActiveSignal = () => {
      const now = Date.now();
      if (now - lastActivePingRef.current < 10000) return;
      lastActivePingRef.current = now;
      void pingHeartbeat(true);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onActiveSignal();
    };

    window.addEventListener("mousemove", onActiveSignal, { passive: true });
    window.addEventListener("keydown", onActiveSignal);
    window.addEventListener("touchstart", onActiveSignal, { passive: true });
    window.addEventListener("focus", onActiveSignal);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("mousemove", onActiveSignal);
      window.removeEventListener("keydown", onActiveSignal);
      window.removeEventListener("touchstart", onActiveSignal);
      window.removeEventListener("focus", onActiveSignal);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  const updateManualStatus = async (value: "AUTO" | "ONLINE" | "BUSY" | "MEETING") => {
    setSavingStatus(true);
    try {
      await axiosInstance.patch("/presence", { manualStatus: value });
      setManualStatus(value);
      await fetchPresence();
    } finally {
      setSavingStatus(false);
    }
  };

  if (isAuthLoading || !isLoggedIn) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-primary/30 bg-[hsl(var(--surface-1)/0.94)] px-4 text-foreground shadow-lg hover:bg-[hsl(var(--surface-1)/0.98)]"
          variant="outline"
        >
          {open ? "Fechar equipa" : "Equipa e estado"}
        </Button>
      </div>

      {open ? (
        <div className="mt-2 w-[min(92vw,360px)] rounded-2xl border border-border/70 bg-[hsl(var(--surface-1)/0.96)] p-3 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Estado da Equipa</div>
            <div className="text-xs text-muted-foreground">{loading ? "A atualizar..." : `${rows.length} pessoas`}</div>
          </div>

          <div className="mb-3 rounded-xl border border-border/60 p-2">
            <div className="mb-1 text-xs text-muted-foreground">O meu estado</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={manualStatus}
              onChange={(e) => void updateManualStatus(e.target.value as typeof manualStatus)}
              disabled={savingStatus}
            >
              <option value="AUTO">Automático</option>
              <option value="ONLINE">🟢 Online</option>
              <option value="BUSY">🔴 Ocupado</option>
              <option value="MEETING">🟣 Em reunião</option>
            </select>
          </div>

          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar pessoa por nome/email"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {filteredRows.map((p) => (
              <div key={p.id} className="rounded-xl border border-border/60 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{p.name || p.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 text-[11px]">
                      <span className={`inline-block h-2 w-2 rounded-full ${statusMeta[p.status].dotClass}`} />
                      <span>{statusMeta[p.status].label}</span>
                    </div>
                    {p.slaCritical ? (
                      <div className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                        ⏳ SLA crítico ({p.slaCriticalCount})
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!filteredRows.length ? (
              <div className="text-sm text-muted-foreground">
                {rows.length ? "Sem resultados para a pesquisa." : "Sem dados de presença."}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
