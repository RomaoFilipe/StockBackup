"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import EmptyState from "@/app/components/EmptyState";
import axiosInstance from "@/utils/axiosInstance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Reservation = {
  id: string;
  quantity: number;
  destination?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    supplier?: { id: string; name: string } | null;
    category?: { id: string; name: string } | null;
  };
  reservedUnit?: {
    id: string;
    code: string;
    status: string;
    serialNumber?: string | null;
    partNumber?: string | null;
    assetTag?: string | null;
  } | null;
  request: {
    id: string;
    gtmiNumber: string;
    title?: string | null;
    status: "DRAFT" | "SUBMITTED" | "APPROVED";
    requesterName?: string | null;
    deliveryLocation?: string | null;
    requestedAt: string;
    user?: { id: string; name: string; email: string } | null;
  };
};

function statusLabel(status: Reservation["request"]["status"]) {
  switch (status) {
    case "DRAFT":
      return "Rascunho";
    case "SUBMITTED":
      return "Submetida";
    case "APPROVED":
      return "Aprovada";
    default:
      return status;
  }
}

function statusClass(status: Reservation["request"]["status"]) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "SUBMITTED":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700";
    default:
      return "border-slate-500/30 bg-slate-500/10 text-slate-700";
  }
}

export default function UnitReservationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Reservation[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = async (query = q) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "200");
      const res = await axiosInstance.get<{ items: Reservation[] }>(`/units/reservations?${params.toString()}`);
      setItems(res.data.items || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Não foi possível carregar reservas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchReservations("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.request.status] += 1;
        return acc;
      },
      { total: 0, DRAFT: 0, SUBMITTED: 0, APPROVED: 0 } as Record<Reservation["request"]["status"] | "total", number>
    );
  }, [items]);

  return (
    <AuthenticatedLayout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title="Reservas abertas"
          description="Unidades QR presas em pedidos que ainda não foram cumpridos."
          actions={
            <Button variant="outline" onClick={() => void fetchReservations()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          }
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
            <div className="mt-1 text-2xl font-semibold">{counts.total}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rascunho</div>
            <div className="mt-1 text-2xl font-semibold">{counts.DRAFT}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Submetidas</div>
            <div className="mt-1 text-2xl font-semibold">{counts.SUBMITTED}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Aprovadas</div>
            <div className="mt-1 text-2xl font-semibold">{counts.APPROVED}</div>
          </div>
        </div>

        <SectionCard
          title="Unidades reservadas"
          description="Procure por QR, produto, SKU, GTMI ou requerente."
          actions={
            <form
              className="flex w-full min-w-0 items-center gap-2 sm:w-[420px]"
              onSubmit={(e) => {
                e.preventDefault();
                void fetchReservations();
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Pesquisar..." />
              </div>
              <Button type="submit">Filtrar</Button>
            </form>
          }
        >
          {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">A carregar reservas...</div>
          ) : items.length === 0 ? (
            <EmptyState title="Sem reservas abertas" description="Não há QR reservados em pedidos por concluir." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Requerente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const unit = item.reservedUnit;
                    const code = unit?.code || item.destination || "Sem código";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-[260px]">
                          <div className="font-mono text-xs break-all">{code}</div>
                          {unit?.serialNumber ? <div className="text-xs text-muted-foreground">SN: {unit.serialNumber}</div> : null}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            SKU: {item.product.sku}
                            {item.product.supplier?.name ? ` • ${item.product.supplier.name}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{item.request.gtmiNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.request.requestedAt).toLocaleDateString("pt-PT")}
                            {item.request.deliveryLocation ? ` • ${item.request.deliveryLocation}` : ""}
                          </div>
                        </TableCell>
                        <TableCell>{item.request.requesterName || item.request.user?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusClass(item.request.status)}>
                            {statusLabel(item.request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {unit?.id ? (
                              <Button variant="outline" size="sm" onClick={() => router.push(`/units/${unit.id}`)}>
                                QR
                                <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                            <Button variant="outline" size="sm" onClick={() => router.push(`/requests/${item.request.id}`)}>
                              Pedido
                              <ArrowUpRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
