"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import EmptyState from "@/app/components/EmptyState";
import axiosInstance from "@/utils/axiosInstance";
import { buildUnitLookupUrl } from "@/utils/unitQrLink";
import { QRCodeComponent } from "@/components/ui/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UnitDetail = {
  id: string;
  code: string;
  status: "IN_STOCK" | "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
  serialNumber?: string | null;
  partNumber?: string | null;
  assetTag?: string | null;
  notes?: string | null;
  createdAt: string;
  acquiredAt?: string | null;
  acquiredReason?: string | null;
  costCenter?: string | null;
  acquiredNotes?: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    description?: string | null;
    category?: { id: string; name: string } | null;
    supplier?: { id: string; name: string } | null;
  };
  invoice?: {
    id: string;
    invoiceNumber: string;
    issuedAt: string;
    reqNumber?: string | null;
    reqDate?: string | null;
  } | null;
  acquiredBy?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  reservedRequestItems: Array<{
    id: string;
    quantity: number;
    destination?: string | null;
    notes?: string | null;
    createdAt: string;
    request: {
      id: string;
      gtmiNumber: string;
      title?: string | null;
      status: string;
      requesterName?: string | null;
      deliveryLocation?: string | null;
      requestedAt: string;
      user?: { id: string; name: string; email: string } | null;
    };
  }>;
  stockMovements: Array<{
    id: string;
    type: "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";
    quantity: number;
    reason?: string | null;
    costCenter?: string | null;
    notes?: string | null;
    createdAt: string;
    requestId?: string | null;
    invoiceId?: string | null;
    request?: { id: string; gtmiNumber: string; title?: string | null; status: string } | null;
    invoice?: { id: string; invoiceNumber: string; reqNumber?: string | null } | null;
    performedBy?: { id: string; name: string; email: string } | null;
    assignedTo?: { id: string; name: string; email: string } | null;
  }>;
};

function unitStatusMeta(status: UnitDetail["status"]) {
  switch (status) {
    case "IN_STOCK":
      return { label: "Em stock", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" };
    case "ACQUIRED":
      return { label: "Entregue", className: "border-sky-500/30 bg-sky-500/10 text-sky-700" };
    case "IN_REPAIR":
      return { label: "Em reparação", className: "border-amber-500/30 bg-amber-500/10 text-amber-700" };
    case "SCRAPPED":
      return { label: "Abatido", className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700" };
    case "LOST":
      return { label: "Perdido", className: "border-rose-500/30 bg-rose-500/10 text-rose-700" };
    default:
      return { label: status, className: "border-border bg-muted text-muted-foreground" };
  }
}

function movementLabel(type: UnitDetail["stockMovements"][number]["type"]) {
  switch (type) {
    case "IN":
      return "Entrada";
    case "OUT":
      return "Saída";
    case "RETURN":
      return "Devolução";
    case "REPAIR_OUT":
      return "Vai reparar";
    case "REPAIR_IN":
      return "Volta reparar";
    case "SCRAP":
      return "Abate";
    case "LOST":
      return "Perda";
    default:
      return type;
  }
}

export default function UnitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const unitId = params?.id;
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const envBase = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    setOrigin(envBase || window.location.origin);
  }, []);

  const fetchUnit = async () => {
    if (!unitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get<UnitDetail>(`/units/${unitId}`);
      setUnit(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Não foi possível carregar unidade.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUnit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId]);

  const status = useMemo(() => (unit ? unitStatusMeta(unit.status) : null), [unit]);

  return (
    <AuthenticatedLayout>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          title={unit ? unit.product.name : "Detalhe do QR"}
          description={unit ? `Unidade ${unit.code}` : "Histórico e estado de uma unidade física."}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <Button variant="outline" onClick={() => void fetchUnit()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          }
        />

        {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        {loading ? <div className="py-10 text-center text-sm text-muted-foreground">A carregar unidade...</div> : null}
        {!loading && !unit ? <EmptyState title="Unidade não encontrada" description="O QR indicado não existe ou não pertence a este tenant." /> : null}

        {unit && status ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
              <SectionCard title="Identificação" description="Dados principais da unidade física.">
                <div className="flex flex-col items-center gap-4 text-center">
                  <QRCodeComponent data={buildUnitLookupUrl({ origin, code: unit.code })} title="QR" size={180} showDownload={false} />
                  <div className="space-y-2">
                    <div className="font-mono text-sm break-all">{unit.code}</div>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Produto e origem"
                description="Produto, fornecedor e documento de entrada associado."
                actions={
                  <Button variant="outline" size="sm" onClick={() => router.push(`/products/${unit.product.id}`)}>
                    Produto
                    <ExternalLink className="ml-2 h-3.5 w-3.5" />
                  </Button>
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Info label="Produto" value={unit.product.name} />
                  <Info label="SKU" value={unit.product.sku} />
                  <Info label="Categoria" value={unit.product.category?.name || "—"} />
                  <Info label="Fornecedor" value={unit.product.supplier?.name || "—"} />
                  <Info label="S/N" value={unit.serialNumber || "—"} />
                  <Info label="P/N" value={unit.partNumber || "—"} />
                  <Info label="Asset Tag" value={unit.assetTag || "—"} />
                  <Info label="Criado em" value={new Date(unit.createdAt).toLocaleString("pt-PT")} />
                  <Info label="Fatura" value={unit.invoice?.invoiceNumber || "—"} />
                  <Info label="Data fatura" value={unit.invoice ? new Date(unit.invoice.issuedAt).toLocaleDateString("pt-PT") : "—"} />
                  <Info label="REQ" value={unit.invoice?.reqNumber || "—"} />
                  <Info label="Data REQ" value={unit.invoice?.reqDate ? new Date(unit.invoice.reqDate).toLocaleDateString("pt-PT") : "—"} />
                  <Info label="Atribuído a" value={unit.assignedTo?.name || "—"} />
                  <Info label="Entregue em" value={unit.acquiredAt ? new Date(unit.acquiredAt).toLocaleString("pt-PT") : "—"} />
                </div>
                {unit.notes ? <div className="mt-4 rounded-lg border bg-muted/30 p-3 text-sm">{unit.notes}</div> : null}
              </SectionCard>
            </div>

            <SectionCard title="Reserva aberta" description="Pedido aberto que está a segurar esta unidade.">
              {unit.reservedRequestItems.length === 0 ? (
                <EmptyState title="Sem reserva aberta" description="Esta unidade não está presa a nenhum pedido por cumprir." />
              ) : (
                <div className="space-y-3">
                  {unit.reservedRequestItems.map((item) => (
                    <div key={item.id} className="rounded-xl border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold">{item.request.gtmiNumber}</div>
                          <div className="text-sm text-muted-foreground">
                            {item.request.requesterName || item.request.user?.name || "Sem requerente"}
                            {item.request.deliveryLocation ? ` • ${item.request.deliveryLocation}` : ""}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/requests/${item.request.id}`)}>
                          Abrir pedido
                          <ExternalLink className="ml-2 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Histórico" description="Movimentos de stock registados para este QR.">
              {unit.stockMovements.length === 0 ? (
                <EmptyState title="Sem movimentos" description="Ainda não há movimentos registados para esta unidade." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Pessoa</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unit.stockMovements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{new Date(movement.createdAt).toLocaleString("pt-PT")}</TableCell>
                          <TableCell>{movementLabel(movement.type)}</TableCell>
                          <TableCell>
                            {movement.request ? (
                              <button className="font-medium text-primary hover:underline" onClick={() => router.push(`/requests/${movement.request!.id}`)}>
                                {movement.request.gtmiNumber}
                              </button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {movement.invoice?.invoiceNumber || movement.invoice?.reqNumber || "—"}
                          </TableCell>
                          <TableCell>{movement.assignedTo?.name || movement.performedBy?.name || "—"}</TableCell>
                          <TableCell className="max-w-[320px]">
                            <div className="truncate">{movement.reason || movement.notes || "—"}</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </main>
    </AuthenticatedLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-words">{value}</div>
    </div>
  );
}
