"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HardDrive, Search, Wrench } from "lucide-react";

type DesktopStatus = "ACQUIRED" | "IN_REPAIR";

type DesktopItem = {
  unitId: string;
  code: string;
  status: DesktopStatus;
  assignedAt: string | null;
  product: { id: string; name: string; sku: string };
  request: { id: string; gtmiNumber: string; title: string | null } | null;
};

type DesktopResponse = {
  generatedAt: string;
  summary: { total: number; acquired: number; inRepair: number };
  items: DesktopItem[];
};

const statusMeta = (status: DesktopStatus) => {
  if (status === "ACQUIRED") {
    return { label: "Em uso", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" };
  }
  return { label: "Em reparação", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" };
};

export default function MyDesktopPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DesktopItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, acquired: 0, inRepair: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | DesktopStatus>("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get<DesktopResponse>("/mydesktop");
      setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      setSummary(
        res.data?.summary ?? {
          total: 0,
          acquired: 0,
          inRepair: 0,
        },
      );
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar o MYDESKTOP.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login?redirect=/mydesktop");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== "ALL" && it.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${it.product.name} ${it.product.sku} ${it.code} ${it.request?.gtmiNumber ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, statusFilter]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="MYDESKTOP"
          description="Tudo o que tens em posse, num painel simples e direto."
          actions={
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              Atualizar
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total em posse</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.total}</CardContent>
          </Card>
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Em uso</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.acquired}</CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Em reparação</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{summary.inRepair}</CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Pesquisar por produto, SKU, código ou GTMI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant={statusFilter === "ALL" ? "default" : "outline"} onClick={() => setStatusFilter("ALL")}>
                Todos
              </Button>
              <Button variant={statusFilter === "ACQUIRED" ? "default" : "outline"} onClick={() => setStatusFilter("ACQUIRED")}>
                Em uso
              </Button>
              <Button variant={statusFilter === "IN_REPAIR" ? "default" : "outline"} onClick={() => setStatusFilter("IN_REPAIR")}>
                Em reparação
              </Button>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground">A carregar itens...</div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                Não há materiais em posse com os filtros atuais.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((it) => {
                  const meta = statusMeta(it.status);
                  return (
                    <Card key={it.unitId} className="border-border/70">
                      <CardHeader className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">Código</div>
                          <Badge variant="outline" className={meta.className}>
                            {meta.label}
                          </Badge>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{it.code}</div>
                        <CardTitle className="text-base">{it.product.name}</CardTitle>
                        <div className="text-xs text-muted-foreground">SKU: {it.product.sku}</div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {it.status === "ACQUIRED" ? <HardDrive className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                          {it.assignedAt ? `Atribuído em ${new Date(it.assignedAt).toLocaleDateString("pt-PT")}` : "Data de atribuição indisponível"}
                        </div>
                        {it.request ? (
                          <Button variant="outline" className="w-full" onClick={() => router.push(`/requests/${it.request!.id}`)}>
                            {it.request.gtmiNumber || "Abrir requisição"}
                          </Button>
                        ) : (
                          <div className="text-xs text-muted-foreground">Sem requisição associada.</div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}

