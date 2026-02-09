"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import EmptyState from "@/app/components/EmptyState";
import SectionCard from "@/app/components/SectionCard";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw } from "lucide-react";

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

const statusLabel = (s: EquipmentStatus) => {
  switch (s) {
    case "ACQUIRED":
      return "Atribuído";
    case "IN_REPAIR":
      return "Em reparação";
    case "LOST":
      return "Perdido";
    case "SCRAPPED":
      return "Abatido";
    default:
      return s;
  }
};

const serviceLabel = (svc: RequestingServiceDto) => `${svc.codigo} - ${svc.designacao}`;

export default function EquipamentosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<EquipmentGroupDto[]>([]);
  const [services, setServices] = useState<RequestingServiceDto[]>([]);

  const [serviceFilter, setServiceFilter] = useState<string>("__all__");
  const [scope, setScope] = useState<"OUT" | "ALL">("OUT");

  const load = async () => {
    setLoading(true);
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

  const filteredGroups = useMemo(() => {
    if (serviceFilter === "__all__") return groups;
    if (serviceFilter === "__unknown__") {
      return groups.filter((g) => g.key === "unknown" || g.key.startsWith("txt:"));
    }
    const id = Number(serviceFilter);
    if (!Number.isFinite(id)) return groups;
    return groups.filter((g) => g.requestingServiceId === id);
  }, [groups, serviceFilter]);

  const allItems = useMemo(() => {
    const items: Array<{ groupLabel: string; item: EquipmentItemDto }> = [];
    for (const g of filteredGroups) {
      for (const it of g.items) items.push({ groupLabel: g.label, item: it });
    }
    return items;
  }, [filteredGroups]);

  const summaryGroups = useMemo(() => {
    return serviceFilter === "__all__" ? groups : filteredGroups;
  }, [groups, filteredGroups, serviceFilter]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Equipamentos por Serviço"
          description="Resumo e detalhe dos equipamentos fora do stock, agrupados por serviço requisitante (a partir do último movimento OUT)."
        />

        <SectionCard
          title="Filtros"
          description="Escolhe o serviço e o âmbito do estado."
          className="border-border/60 bg-card/60"
          actions={
            <Button
              variant="outline"
              onClick={() => load()}
              disabled={loading}
              className="h-10 rounded-xl"
            >
              <RefreshCcw className="h-4 w-4" />
              {loading ? "A carregar..." : "Atualizar"}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Serviço</div>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Âmbito</div>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUT">Fora do stock (Atribuído + Reparação)</SelectItem>
                  <SelectItem value="ALL">Incluir Perdidos/Abatidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {!loading && !groups.length ? (
          <EmptyState title="Sem dados" description="Não existem equipamentos fora do stock." />
        ) : null}

        <SectionCard
          title="Resumo"
          description="Quantidade de equipamentos por serviço."
          className="border-border/60 bg-card/60"
        >
          <div className="overflow-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="w-[120px]">Qtde</TableHead>
                  <TableHead className="w-[120px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryGroups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="font-medium">{g.label}</TableCell>
                    <TableCell>{g.count}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        className="h-9 rounded-xl"
                        onClick={() => {
                          if (g.requestingServiceId) setServiceFilter(String(g.requestingServiceId));
                          else setServiceFilter("__unknown__");
                        }}
                      >
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        <SectionCard
          title="Detalhe"
          description="Lista de equipamentos no serviço selecionado (ou todos, se não filtrar)."
          className="border-border/60 bg-card/60"
        >
          {!loading && !allItems.length ? (
            <EmptyState title="Sem equipamentos" description="Não há equipamentos para o filtro atual." />
          ) : (
            <div className="overflow-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Requisição</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Última saída</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allItems.map(({ groupLabel, item }) => (
                    <TableRow key={item.unitId}>
                      <TableCell className="whitespace-nowrap">{groupLabel}</TableCell>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell className="min-w-[260px]">{item.product.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.product.sku}</TableCell>
                      <TableCell className="whitespace-nowrap">{statusLabel(item.status)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.request?.gtmiNumber ?? "—"}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        {item.assignedTo ? (
                          <div className="space-y-0.5">
                            <div>{item.assignedTo.name}</div>
                            <div className="text-xs text-muted-foreground">{item.assignedTo.email}</div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.lastOutAt ? new Date(item.lastOutAt).toLocaleString("pt-PT") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </div>
    </AuthenticatedLayout>
  );
}
