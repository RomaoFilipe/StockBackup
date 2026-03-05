"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import EmptyState from "@/app/components/EmptyState";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  ChevronDown,
  Filter,
  HardDrive,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Settings2,
  ShieldAlert,
  UserRound,
  Wrench,
} from "lucide-react";
import Papa from "papaparse";

type RequestingServiceDto = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type EquipmentStatus = "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";

type EquipmentItemDto = {
  unitId: string;
  code: string;
  status: EquipmentStatus;
  product: { id: string; name: string; sku: string };
  assignedTo: { id: string; name: string; email: string } | null;
  request: { id: string; gtmiNumber: string; title: string | null } | null;
  lastOutAt: string | null;
};

type EquipmentGroupDto = {
  key: string;
  label: string;
  requestingServiceId: number | null;
  requestingService: RequestingServiceDto | null;
  count: number;
  items: EquipmentItemDto[];
};

type ApiResponse = {
  generatedAt: string;
  limit: number;
  statuses: string[];
  totalUnits: number;
  groups: EquipmentGroupDto[];
};

type ScopeType = "OUT" | "ALL";
type StatusFilter = "ALL" | EquipmentStatus;

const serviceLabel = (svc: RequestingServiceDto) => `${svc.codigo} - ${svc.designacao}`;

const statusMeta = (s: EquipmentStatus) => {
  switch (s) {
    case "ACQUIRED":
      return {
        label: "Atribuído",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      };
    case "IN_REPAIR":
      return {
        label: "Em reparação",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "LOST":
      return {
        label: "Perdido",
        className: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    case "SCRAPPED":
      return {
        label: "Abatido",
        className: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
      };
    default:
      return {
        label: s,
        className: "border-border/60 bg-muted/60 text-muted-foreground",
      };
  }
};

function Sparkline({ values }: { values: number[] }) {
  return (
    <div className="mt-2 flex h-8 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500/70"
          style={{ height: `${Math.max(15, Math.min(100, v))}%` }}
        />
      ))}
    </div>
  );
}

export default function EquipamentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<EquipmentGroupDto[]>([]);
  const [services, setServices] = useState<RequestingServiceDto[]>([]);

  const [globalSearch, setGlobalSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("__all__");
  const [personSearch, setPersonSearch] = useState("");
  const [personFilter, setPersonFilter] = useState<string>("__all__");
  const [scope, setScope] = useState<ScopeType>("OUT");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const statuses =
        scope === "OUT" ? "ACQUIRED,IN_REPAIR" : "ACQUIRED,IN_REPAIR,LOST,SCRAPPED";

      const [resGroups, resServices] = await Promise.all([
        axiosInstance.get<ApiResponse>("/equipment/by-service", {
          params: { statuses, limit: 2000 },
        }),
        axiosInstance.get<RequestingServiceDto[]>("/requesting-services"),
      ]);

      setGroups(resGroups.data?.groups ?? []);
      setServices((resServices.data ?? []).slice().sort((a, b) => a.codigo.localeCompare(b.codigo)));
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar equipamentos.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const serviceOptionsFiltered = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => serviceLabel(s).toLowerCase().includes(q));
  }, [services, serviceSearch]);

  const groupsAfterService = useMemo(() => {
    if (serviceFilter === "__all__") return groups;
    if (serviceFilter === "__unknown__") {
      return groups.filter((g) => g.key === "unknown" || g.key.startsWith("txt:"));
    }
    const id = Number(serviceFilter);
    if (!Number.isFinite(id)) return groups;
    return groups.filter((g) => g.requestingServiceId === id);
  }, [groups, serviceFilter]);

  const allItems = useMemo(() => {
    const list: Array<{ group: EquipmentGroupDto; item: EquipmentItemDto }> = [];
    for (const g of groupsAfterService) {
      for (const it of g.items) list.push({ group: g, item: it });
    }
    return list;
  }, [groupsAfterService]);

  const personOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const { item } of allItems) {
      if (item.assignedTo?.id) {
        map.set(item.assignedTo.id, {
          id: item.assignedTo.id,
          label: `${item.assignedTo.name} • ${item.assignedTo.email}`,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt"));
  }, [allItems]);

  const personOptionsFiltered = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return personOptions;
    return personOptions.filter((p) => p.label.toLowerCase().includes(q));
  }, [personOptions, personSearch]);

  const detailItems = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();

    return allItems.filter(({ group, item }) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (personFilter !== "__all__") {
        if (personFilter === "__unassigned__") {
          if (item.assignedTo?.id) return false;
        } else if (item.assignedTo?.id !== personFilter) {
          return false;
        }
      }
      if (dateFrom && item.lastOutAt) {
        const d = new Date(item.lastOutAt);
        const from = new Date(`${dateFrom}T00:00:00`);
        if (d < from) return false;
      }
      if (dateTo && item.lastOutAt) {
        const d = new Date(item.lastOutAt);
        const to = new Date(`${dateTo}T23:59:59`);
        if (d > to) return false;
      }
      if (!q) return true;
      const hay = [
        group.label,
        item.product.name,
        item.product.sku,
        item.code,
        item.request?.gtmiNumber || "",
        item.assignedTo?.name || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, globalSearch, statusFilter, personFilter, dateFrom, dateTo]);

  const summaryByService = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; requestingServiceId: number | null; total: number }
    >();

    for (const { group } of detailItems) {
      const current = map.get(group.key);
      if (current) {
        current.total += 1;
      } else {
        map.set(group.key, {
          key: group.key,
          label: group.label,
          requestingServiceId: group.requestingServiceId,
          total: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [detailItems]);

  const kpis = useMemo(() => {
    const total = detailItems.length;
    const inRepair = detailItems.filter((x) => x.item.status === "IN_REPAIR").length;
    const assigned = detailItems.filter((x) => x.item.status === "ACQUIRED").length;
    const topService = summaryByService[0]?.label || "Sem dados";
    const byPerson = new Map<string, number>();
    for (const { item } of detailItems) {
      const key = item.assignedTo?.name || "Sem pessoa atribuída";
      byPerson.set(key, (byPerson.get(key) ?? 0) + 1);
    }
    const topPerson = Array.from(byPerson.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sem dados";
    return { total, inRepair, assigned, topService, topPerson };
  }, [detailItems, summaryByService]);

  const summaryByPerson = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; personId: string | null }>();
    for (const { item } of detailItems) {
      const key = item.assignedTo?.id || "__unassigned__";
      const label = item.assignedTo?.name
        ? `${item.assignedTo.name}${item.assignedTo.email ? ` • ${item.assignedTo.email}` : ""}`
        : "Sem pessoa atribuída";
      const current = map.get(key);
      if (current) current.total += 1;
      else map.set(key, { key, label, total: 1, personId: item.assignedTo?.id || null });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [detailItems]);

  const clearFilters = () => {
    setServiceFilter("__all__");
    setPersonFilter("__all__");
    setStatusFilter("ALL");
    setDateFrom("");
    setDateTo("");
    setGlobalSearch("");
  };

  const activeFilterCount =
    Number(serviceFilter !== "__all__") +
    Number(personFilter !== "__all__") +
    Number(statusFilter !== "ALL") +
    Number(Boolean(dateFrom || dateTo)) +
    Number(Boolean(globalSearch.trim()));

  const exportCsv = () => {
    const rows = detailItems.map(({ group, item }) => ({
      servico: group.label,
      produto: item.product.name,
      sku: item.product.sku,
      codigo: item.code,
      estado: statusMeta(item.status).label,
      requisicao: item.request?.gtmiNumber || "",
      destinatario: item.assignedTo?.name || "",
      email: item.assignedTo?.email || "",
      ultimaSaida: item.lastOutAt || "",
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `equipamentos-servico-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-5">
        <div className="glass-panel sticky top-3 z-30 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-[hsl(var(--surface-1)/0.85)] px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Pesquisa global por serviço, produto, código..."
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button
              variant="outline"
              className="hidden rounded-xl md:inline-flex"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              Filtro rápido
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="rounded-full px-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">{user?.name || "Conta"}</span>
            </Button>
          </div>
        </div>

        <section className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Equipamentos por Serviço</h1>
              <p className="text-sm text-muted-foreground">
                Resumo e detalhe dos equipamentos fora do stock
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => load(true)}
                disabled={loading || refreshing}
                className="h-11 rounded-2xl"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="outline" onClick={exportCsv} className="h-11 rounded-2xl" disabled={loading || detailItems.length === 0}>
                Exportar
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span>Total Fora de Stock</span>
              <HardDrive className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-3xl font-semibold text-primary">{kpis.total}</div>
            <Sparkline values={[22, 40, 33, 48, 42, 55, 60]} />
          </article>
          <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span>Em Reparação</span>
              <Wrench className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-3xl font-semibold text-amber-600">{kpis.inRepair}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${Math.max(8, Math.min(100, (kpis.inRepair / Math.max(1, kpis.total)) * 100))}%` }}
              />
            </div>
          </article>
          <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span>Atribuídos</span>
              <ShieldAlert className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-3xl font-semibold text-blue-600">{kpis.assigned}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${Math.max(8, Math.min(100, (kpis.assigned / Math.max(1, kpis.total)) * 100))}%` }}
              />
            </div>
          </article>
          <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <span>Maior Utilização</span>
              <Settings2 className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="mt-2 truncate text-lg font-semibold text-indigo-600">{kpis.topService}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">Pessoa: {kpis.topPerson}</div>
            <Sparkline values={[18, 28, 35, 30, 42, 55, 52]} />
          </article>
        </section>

        <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <Filter className="h-4 w-4" />
              Filtros avançados
              <Badge variant="secondary" className="rounded-full">{activeFilterCount}</Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
            </Button>

            <Button
              variant="outline"
              className="h-10 rounded-xl md:hidden"
              onClick={() => setMobileFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              Filtrar
            </Button>
          </div>

          {filtersOpen ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              <div className="space-y-2 lg:col-span-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Serviço</div>
                <div className="space-y-2">
                  <Input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Pesquisar serviço..."
                    className="h-10 rounded-xl"
                  />
                  <Select value={serviceFilter} onValueChange={setServiceFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel">
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="__unknown__">Sem serviço / Texto livre</SelectItem>
                      {serviceOptionsFiltered.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {serviceLabel(s)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pessoa</div>
                <div className="space-y-2">
                  <Input
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    placeholder="Pesquisar pessoa..."
                    className="h-10 rounded-xl"
                  />
                  <Select value={personFilter} onValueChange={setPersonFilter}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="glass-panel">
                      <SelectItem value="__all__">Todas</SelectItem>
                      <SelectItem value="__unassigned__">Sem pessoa atribuída</SelectItem>
                      {personOptionsFiltered.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Âmbito</div>
                <div className="flex h-11 items-center gap-1 rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.72)] p-1">
                  <button
                    type="button"
                    className={`h-full flex-1 rounded-lg text-xs ${scope === "OUT" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                    onClick={() => setScope("OUT")}
                  >
                    Fora stock
                  </button>
                  <button
                    type="button"
                    className={`h-full flex-1 rounded-lg text-xs ${scope === "ALL" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                    onClick={() => setScope("ALL")}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Estado</div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-panel">
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="ACQUIRED">Atribuído</SelectItem>
                    <SelectItem value="IN_REPAIR">Em reparação</SelectItem>
                    <SelectItem value="LOST">Perdido</SelectItem>
                    <SelectItem value="SCRAPPED">Abatido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Data saída</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 rounded-xl" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="ghost" className="h-11 rounded-xl" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[300px_300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-3">
            <div className="mb-2 text-sm font-semibold">Resumo por Serviço</div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
                ))
              ) : summaryByService.length === 0 ? (
                <EmptyState title="Sem serviços" description="Sem dados para os filtros selecionados." />
              ) : (
                summaryByService.map((service) => (
                  <article
                    key={service.key}
                    className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.75)] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="text-sm font-semibold">{service.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Quantidade: {service.total}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                        style={{ width: `${Math.max(10, Math.min(100, (service.total / Math.max(1, kpis.total)) * 100))}%` }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 rounded-lg"
                      onClick={() => {
                        if (service.requestingServiceId) setServiceFilter(String(service.requestingServiceId));
                        else setServiceFilter("__unknown__");
                      }}
                    >
                      Ver detalhes
                    </Button>
                  </article>
                ))
              )}
            </div>
          </aside>

          <aside className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-3">
            <div className="mb-2 text-sm font-semibold">Resumo por Pessoa</div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
                ))
              ) : summaryByPerson.length === 0 ? (
                <EmptyState title="Sem pessoas" description="Sem dados para os filtros selecionados." />
              ) : (
                summaryByPerson.map((person) => (
                  <article
                    key={person.key}
                    className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.75)] p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="truncate text-sm font-semibold" title={person.label}>{person.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Quantidade: {person.total}</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500"
                        style={{ width: `${Math.max(10, Math.min(100, (person.total / Math.max(1, kpis.total)) * 100))}%` }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 h-8 rounded-lg"
                      onClick={() => setPersonFilter(person.personId || "__unassigned__")}
                    >
                      Ver detalhes
                    </Button>
                  </article>
                ))
              )}
            </div>
          </aside>

          <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-3">
            <div className="sticky top-[5.2rem] z-10 mb-2 rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.84)] px-3 py-2 text-sm font-semibold backdrop-blur">
              Detalhe de Equipamentos
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/60" />
                ))}
              </div>
            ) : detailItems.length === 0 ? (
              <EmptyState title="Sem equipamentos" description="Não há equipamentos para o filtro atual." />
            ) : (
              <div className="space-y-2">
                {detailItems.map(({ group, item }) => (
                  <details key={item.unitId} className="group rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.75)] p-3 transition-colors open:bg-[hsl(var(--surface-2)/0.7)]">
                    <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{item.product.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">SKU: {item.product.sku}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`rounded-full border ${statusMeta(item.status).className}`}>
                          {statusMeta(item.status).label}
                        </Badge>
                        <Badge variant="secondary" className="rounded-full">{group.label}</Badge>
                      </div>
                    </summary>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div><span className="text-muted-foreground">Serviço:</span> {group.label || "—"}</div>
                      <div><span className="text-muted-foreground">Pessoa:</span> {item.assignedTo?.name || "Sem atribuição"}</div>
                      <div><span className="text-muted-foreground">Requisição:</span> {item.request?.gtmiNumber || "—"}</div>
                      <div><span className="text-muted-foreground">Destinatário:</span> {item.assignedTo?.name || "—"}</div>
                      <div><span className="text-muted-foreground">Última saída:</span> {item.lastOutAt ? new Date(item.lastOutAt).toLocaleString("pt-PT") : "—"}</div>
                      <div><span className="text-muted-foreground">UUID:</span> <span className="font-mono text-xs">{item.code}</span></div>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg"
                        disabled={!item.request?.id}
                        onClick={() => item.request?.id && router.push(`/requests/${item.request.id}`)}
                      >
                        Ver Requisição
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg"
                        disabled={!item.assignedTo?.id}
                        onClick={() => item.assignedTo?.id && router.push(`/users?focus=${item.assignedTo.id}`)}
                      >
                        Ver Utilizador
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-panel">
                          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(item.code)}>
                            Copiar UUID
                          </DropdownMenuItem>
                          {item.request?.id ? (
                            <DropdownMenuItem onClick={() => router.push(`/requests/${item.request!.id}`)}>
                              Abrir pedido
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>

        <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6 sm:hidden">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
              <DialogDescription>Ajuste rápido no mobile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="__unknown__">Sem serviço / Texto livre</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {serviceLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={personFilter} onValueChange={setPersonFilter}>
                <SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  <SelectItem value="__unassigned__">Sem pessoa atribuída</SelectItem>
                  {personOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACQUIRED">Atribuído</SelectItem>
                  <SelectItem value="IN_REPAIR">Em reparação</SelectItem>
                  <SelectItem value="LOST">Perdido</SelectItem>
                  <SelectItem value="SCRAPPED">Abatido</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={clearFilters}>Limpar</Button>
                <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>Aplicar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {isMobile ? (
          <Button
            onClick={() => setMobileFiltersOpen(true)}
            className="fixed bottom-6 right-5 z-40 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-white shadow-2xl"
          >
            <Filter className="mr-1 h-4 w-4" />
            Filtrar
          </Button>
        ) : null}

        {refreshing ? (
          <div className="fixed bottom-6 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-border/70 bg-[hsl(var(--surface-1)/0.9)] px-3 py-2 text-xs shadow-lg backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Atualizando dados...
          </div>
        ) : null}
      </div>
    </AuthenticatedLayout>
  );
}
