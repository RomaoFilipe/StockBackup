"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import AttachmentsDialog from "@/app/components/AttachmentsDialog";
import { QRCodeComponent } from "@/components/ui/qr-code";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import EmptyState from "@/app/components/EmptyState";

type ProductDetails = {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  price: number;
  quantity: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  supplier?: string;
};

type ProductInvoice = {
  id: string;
  productId: string;
  requestId?: string | null;
  reqNumber?: string | null;
  invoiceNumber: string;
  issuedAt: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  request?:
    | {
        id: string;
        title?: string | null;
        status: string;
        createdAt: string;
        user: { id: string; name: string; email: string };
      }
    | null;
};

type ProductUnit = {
  id: string;
  code: string;
  status: "IN_STOCK" | "ACQUIRED";
  serialNumber?: string | null;
  partNumber?: string | null;
  assetTag?: string | null;
  notes?: string | null;
  createdAt: string;
  acquiredAt?: string | null;
  productId: string;
  invoiceId?: string | null;
  acquiredByUserId?: string | null;
};

type StockMovement = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  reason?: string | null;
  costCenter?: string | null;
  notes?: string | null;
  createdAt: string;
  unitId?: string | null;
  unit?: { code: string } | null;
  invoiceId?: string | null;
  invoice?: { id: string; invoiceNumber: string; reqNumber: string | null } | null;
  requestId?: string | null;
  request?: { id: string; title: string | null } | null;
  performedBy?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

export default function ProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tabParam = searchParams?.get("tab");
  const invoiceIdFromQuery = searchParams?.get("invoiceId");
  const requestIdFromQuery = searchParams?.get("requestId");
  const asUserIdFromQuery = searchParams?.get("asUserId") ?? searchParams?.get("userId");
  const [origin, setOrigin] = useState("");

  const initialTab = useMemo(() => {
    const allowed = new Set(["details", "invoices", "units", "movements"]);
    if (tabParam && allowed.has(tabParam)) return tabParam;
    if (invoiceIdFromQuery) return "invoices";
    return "details";
  }, [tabParam, invoiceIdFromQuery]);

  const [tab, setTab] = useState<string>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [invoices, setInvoices] = useState<ProductInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [reqNumber, setReqNumber] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceRepoQuery, setInvoiceRepoQuery] = useState("");
  const [invoiceAttachment, setInvoiceAttachment] = useState<File | null>(null);
  const [requestAttachment, setRequestAttachment] = useState<File | null>(null);

  const [requestPickOpen, setRequestPickOpen] = useState(false);
  const [requestCandidates, setRequestCandidates] = useState<
    Array<{ id: string; gtmiNumber: string; title: string | null; requestedAt: string }>
  >([]);
  const [pickedRequestId, setPickedRequestId] = useState<string>("");

  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsNextCursor, setUnitsNextCursor] = useState<string | null>(null);
  const [unitsQuery, setUnitsQuery] = useState("");
  const [unitsPageSize, setUnitsPageSize] = useState<number>(12);
  const [unitsPageIndex, setUnitsPageIndex] = useState<number>(0);
  const [unitDrafts, setUnitDrafts] = useState<
    Record<
      string,
      {
        serialNumber: string;
        partNumber: string;
        assetTag: string;
        notes: string;
      }
    >
  >({});
  const [unitSaving, setUnitSaving] = useState<Record<string, boolean>>({});

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsNextCursor, setMovementsNextCursor] = useState<string | null>(null);
  const [movementsQuery, setMovementsQuery] = useState("");
  const [movementsType, setMovementsType] = useState<"" | "IN" | "OUT">("");
  const [movementsFrom, setMovementsFrom] = useState("");
  const [movementsTo, setMovementsTo] = useState("");

  const total = useMemo(() => {
    const q = Number.isFinite(quantity) ? quantity : 0;
    const p = Number.isFinite(unitPrice) ? unitPrice : 0;
    return q * p;
  }, [quantity, unitPrice]);

  const loadAll = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const [productRes, invoicesRes] = await Promise.all([
        axiosInstance.get(`/products/${productId}`, {
          params: asUserIdFromQuery ? { asUserId: asUserIdFromQuery } : undefined,
        }),
        axiosInstance.get(`/invoices`, {
          params: asUserIdFromQuery ? { productId, asUserId: asUserIdFromQuery } : { productId },
        }),
      ]);

      setProduct(productRes.data);
      setInvoices(invoicesRes.data);
    } catch (error) {
      toast({
        title: "Falha ao carregar produto",
        description: "Verifique a sessão e tente novamente.",
        variant: "destructive",
      });
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const loadUnits = async (opts?: { reset?: boolean }) => {
    if (!productId) return;
    const reset = opts?.reset ?? false;

    setUnitsLoading(true);
    try {
      const res = await axiosInstance.get("/units", {
        params: {
          productId,
          asUserId: asUserIdFromQuery || undefined,
          limit: 100,
          cursor: reset ? undefined : unitsNextCursor ?? undefined,
        },
      });

      const incoming: ProductUnit[] = res.data?.items ?? [];
      const next: string | null = res.data?.nextCursor ?? null;

      setUnits((prev) => (reset ? incoming : [...prev, ...incoming]));
      setUnitsNextCursor(next);

      if (reset) {
        setUnitsPageIndex(0);
      }

      setUnitDrafts((prev) => {
        const updated = { ...prev };
        for (const u of incoming) {
          if (!updated[u.id]) {
            updated[u.id] = {
              serialNumber: u.serialNumber ?? "",
              partNumber: u.partNumber ?? "",
              assetTag: u.assetTag ?? "",
              notes: u.notes ?? "",
            };
          }
        }
        return updated;
      });
    } catch (error) {
      toast({
        title: "Falha ao carregar unidades",
        description: "Não foi possível obter os QRs por unidade.",
        variant: "destructive",
      });
    } finally {
      setUnitsLoading(false);
    }
  };

  const loadMovements = async (opts?: { reset?: boolean }) => {
    if (!productId) return;
    const reset = opts?.reset ?? false;

    const toIsoStart = (dateOnly: string) =>
      dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`).toISOString() : undefined;
    const toIsoEnd = (dateOnly: string) =>
      dateOnly ? new Date(`${dateOnly}T23:59:59.999Z`).toISOString() : undefined;

    setMovementsLoading(true);
    try {
      const res = await axiosInstance.get("/stock-movements", {
        params: {
          productId,
          asUserId: asUserIdFromQuery || undefined,
          limit: 50,
          cursor: reset ? undefined : movementsNextCursor ?? undefined,
          q: movementsQuery.trim() ? movementsQuery.trim() : undefined,
          type: movementsType || undefined,
          from: movementsFrom ? toIsoStart(movementsFrom) : undefined,
          to: movementsTo ? toIsoEnd(movementsTo) : undefined,
        },
      });

      const incoming: StockMovement[] = res.data?.items ?? [];
      const next: string | null = res.data?.nextCursor ?? null;

      setMovements((prev) => (reset ? incoming : [...prev, ...incoming]));
      setMovementsNextCursor(next);
    } catch (error) {
      toast({
        title: "Falha ao carregar movimentos",
        description: "Não foi possível obter o histórico de movimentos.",
        variant: "destructive",
      });
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    setOrigin(window.location.origin);
    loadAll();
    setUnits([]);
    setUnitsNextCursor(null);
    setUnitDrafts({});
    setUnitsPageIndex(0);
    loadUnits({ reset: true });

    setMovements([]);
    setMovementsNextCursor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    const handle = setTimeout(() => {
      setMovements([]);
      setMovementsNextCursor(null);
      loadMovements({ reset: true });
    }, 250);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, asUserIdFromQuery, movementsQuery, movementsType, movementsFrom, movementsTo]);

  const filteredUnits = useMemo(() => {
    const q = unitsQuery.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => {
      const hay = [u.code, u.serialNumber ?? "", u.partNumber ?? "", u.assetTag ?? "", u.notes ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [units, unitsQuery]);

  const totalUnits = filteredUnits.length;
  const totalPages = Math.max(1, Math.ceil(totalUnits / Math.max(1, unitsPageSize)));

  useEffect(() => {
    // Reset pagination when search changes.
    setUnitsPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitsQuery, unitsPageSize]);

  useEffect(() => {
    // Clamp page index when data shrinks.
    setUnitsPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  const pagedUnits = useMemo(() => {
    const start = unitsPageIndex * unitsPageSize;
    const end = start + unitsPageSize;
    return filteredUnits.slice(start, end);
  }, [filteredUnits, unitsPageIndex, unitsPageSize]);

  const handleNextUnitsPage = async () => {
    const nextIndex = unitsPageIndex + 1;
    const needCount = (nextIndex + 1) * unitsPageSize;
    // If user is navigating beyond loaded items and there's more on the server, pull the next chunk.
    // Use filteredUnits length so search + pagination can still pull more from the server.
    if (needCount > filteredUnits.length && unitsNextCursor && !unitsLoading) {
      await loadUnits({ reset: false });
    }
    setUnitsPageIndex(nextIndex);
  };

  const saveUnit = async (unitId: string) => {
    const draft = unitDrafts[unitId];
    if (!draft) return;

    const normalize = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    };

    setUnitSaving((prev) => ({ ...prev, [unitId]: true }));
    try {
      const res = await axiosInstance.patch(
        `/units/${unitId}`,
        {
          serialNumber: normalize(draft.serialNumber),
          partNumber: normalize(draft.partNumber),
          assetTag: normalize(draft.assetTag),
          notes: normalize(draft.notes),
        },
        {
          params: asUserIdFromQuery ? { asUserId: asUserIdFromQuery } : undefined,
        }
      );

      const updated: ProductUnit = res.data;
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...updated } : u)));

      toast({
        title: "Unidade atualizada",
        description: "Os identificadores foram guardados.",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar a unidade.";
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setUnitSaving((prev) => ({ ...prev, [unitId]: false }));
    }
  };

  const addInvoice = async (overrideRequestId?: string) => {
    if (!productId) return;
    setSaving(true);
    try {
      const effectiveRequestId = overrideRequestId || requestIdFromQuery || undefined;
      const payload = {
        asUserId: asUserIdFromQuery || undefined,
        productId,
        requestId: effectiveRequestId,
        invoiceNumber,
        reqNumber: reqNumber.trim() ? reqNumber.trim() : undefined,
        reqDate: reqDate ? new Date(reqDate).toISOString() : undefined,
        issuedAt: issuedAt ? new Date(issuedAt).toISOString() : undefined,
        quantity,
        unitPrice,
        notes: notes || undefined,
      };

      const res = await axiosInstance.post("/intake", payload);
      const createdInvoice: ProductInvoice = res.data?.invoice;
      const updatedProduct: ProductDetails = res.data?.product;

      if (updatedProduct) setProduct(updatedProduct);
      if (createdInvoice) setInvoices((prev) => [createdInvoice, ...prev]);

      if (createdInvoice?.id && invoiceAttachment) {
        const fd = new FormData();
        fd.append("kind", "INVOICE");
        fd.append("invoiceId", createdInvoice.id);
        fd.append("file", invoiceAttachment);

        const uploadRes = await fetch("/api/storage", {
          method: "POST",
          body: fd,
          credentials: "include",
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data?.error || "Falha ao enviar anexo");
        }
      }

      if (createdInvoice?.id && requestAttachment) {
        const fd = new FormData();
        fd.append("kind", "INVOICE");
        fd.append("invoiceId", createdInvoice.id);
        fd.append("file", requestAttachment);

        const uploadRes = await fetch("/api/storage", {
          method: "POST",
          body: fd,
          credentials: "include",
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json().catch(() => ({}));
          throw new Error(data?.error || "Falha ao enviar anexo");
        }
      }

      setInvoiceNumber("");
      setReqNumber("");
      setReqDate("");
      setIssuedAt("");
      setQuantity(1);
      setUnitPrice(0);
      setNotes("");
      setInvoiceAttachment(null);
      setRequestAttachment(null);

      setInvoiceDialogOpen(false);

      // Refresh units to include newly generated QRs (stock intake creates ProductUnits)
      loadUnits({ reset: true });

      toast({
        title: "Fatura adicionada",
        description:
          invoiceAttachment || requestAttachment
            ? "Stock e anexos registados."
            : "Stock registado.",
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const candidates = error?.response?.data?.candidates;
      if (status === 409 && Array.isArray(candidates) && candidates.length > 0) {
        setRequestCandidates(candidates);
        setPickedRequestId(String(candidates[0]?.id ?? ""));
        setRequestPickOpen(true);
        toast({
          title: "Selecionar requisição",
          description: "Existem múltiplas requisições possíveis para este produto. Escolha uma.",
        });
      } else {
        const msg = error?.response?.data?.error || error?.message || "Não foi possível criar a fatura.";
        toast({
          title: "Erro",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    const q = invoiceRepoQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const hay = [
        inv.invoiceNumber,
        inv.reqNumber ?? "",
        inv.request?.id ?? "",
        inv.request?.title ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [invoices, invoiceRepoQuery]);

  useEffect(() => {
    if (!invoiceIdFromQuery) return;
    if (loading) return;

    // Ensure invoices tab is open, then scroll to the invoice card.
    if (tab !== "invoices") {
      setTab("invoices");
    }

    // Defer to allow TabsContent to render.
    const id = invoiceIdFromQuery;
    const handle = window.setTimeout(() => {
      const el = document.getElementById(`invoice-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    return () => window.clearTimeout(handle);
  }, [invoiceIdFromQuery, loading, tab, invoices.length]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title={product?.name ?? "Produto"}
          description="Detalhes e faturas"
          actions={
            <Button variant="outline" onClick={() => router.push("/")}>Voltar</Button>
          }
        />

        {loading ? (
          <SectionCard title="A carregar..." description="A obter detalhes do produto.">
            <p className="text-sm text-muted-foreground">Aguarde.</p>
          </SectionCard>
        ) : !product ? (
          <EmptyState
            title="Produto não encontrado"
            description="Não foi possível carregar este produto. Verifique a sessão e tente novamente."
            action={
              <Button variant="outline" onClick={() => router.push("/")}>Voltar aos produtos</Button>
            }
          />
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="invoices">Faturas</TabsTrigger>
              <TabsTrigger value="units">QR</TabsTrigger>
              <TabsTrigger value="movements">Movimentos</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <SectionCard title="Detalhes do produto" description="Informação base e metadados.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium">SKU:</span> {product.sku}</div>
                  <div><span className="font-medium">Preço:</span> ${product.price.toFixed(2)}</div>
                  <div><span className="font-medium">Quantidade:</span> {product.quantity}</div>
                  <div><span className="font-medium">Estado:</span> {product.status || "—"}</div>
                  <div><span className="font-medium">Categoria:</span> {product.category || "—"}</div>
                  <div><span className="font-medium">Fornecedor:</span> {product.supplier || "—"}</div>
                  <div className="md:col-span-2"><span className="font-medium">Descrição:</span> {product.description?.trim() ? product.description : "—"}</div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="units" className="space-y-4">
              <SectionCard
                title="QR por unidade"
                description="Cada unidade tem um QR único. Aqui pode editar S/N, P/N e Asset Tag."
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                  <Input
                    placeholder="Pesquisar por QR, S/N, P/N, Asset Tag…"
                    value={unitsQuery}
                    onChange={(e) => setUnitsQuery(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const q = new URLSearchParams();
                        if (asUserIdFromQuery) q.set("asUserId", asUserIdFromQuery);
                        const suffix = q.toString() ? `?${q.toString()}` : "";
                        router.push(`/products/${productId}/print-qr${suffix}`);
                      }}
                      disabled={!productId}
                    >
                      Imprimir QRs
                    </Button>
                    <Button variant="outline" onClick={() => loadUnits({ reset: true })} disabled={unitsLoading}>
                      {unitsLoading ? "A carregar..." : "Atualizar"}
                    </Button>
                    {unitsNextCursor ? (
                      <Button variant="outline" onClick={() => loadUnits({ reset: false })} disabled={unitsLoading}>
                        Mais
                      </Button>
                    ) : null}
                  </div>
                </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      {totalUnits === 0
                        ? "0 unidades"
                        : `A mostrar ${Math.min(totalUnits, unitsPageIndex * unitsPageSize + 1)}–${Math.min(
                            totalUnits,
                            (unitsPageIndex + 1) * unitsPageSize
                          )} de ${totalUnits} unidade(s)`}
                      {unitsNextCursor ? " • (há mais para carregar)" : ""}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">Por página</label>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={unitsPageSize}
                        onChange={(e) => setUnitsPageSize(Number(e.target.value))}
                      >
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </select>

                      <Button
                        variant="outline"
                        onClick={() => setUnitsPageIndex((p) => Math.max(0, p - 1))}
                        disabled={unitsPageIndex === 0}
                      >
                        Anterior
                      </Button>

                      <div className="text-xs text-muted-foreground px-1">
                        Página {Math.min(totalPages, unitsPageIndex + 1)} / {totalPages}
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleNextUnitsPage}
                        disabled={unitsLoading || ((unitsPageIndex + 1) >= totalPages && !unitsNextCursor)}
                      >
                        Seguinte
                      </Button>
                    </div>
                  </div>
                </div>

                {units.length === 0 && !unitsLoading ? (
                  <div className="mt-4">
                    <EmptyState
                      title="Sem unidades"
                      description="Este produto ainda não tem QRs por unidade. Crie stock através do fluxo de entrada (intake)."
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {pagedUnits.map((u) => {
                        const draft = unitDrafts[u.id] ?? {
                          serialNumber: u.serialNumber ?? "",
                          partNumber: u.partNumber ?? "",
                          assetTag: u.assetTag ?? "",
                          notes: u.notes ?? "",
                        };

                        return (
                          <div key={u.id} className="border rounded-md p-3">
                            <div className="flex flex-col lg:flex-row gap-3 lg:items-start lg:justify-between">
                              <div className="flex items-start gap-3">
                                {origin ? (
                                  <QRCodeComponent
                                    data={`${origin}/scan/${u.code}`}
                                    title="QR"
                                    size={110}
                                    showDownload={false}
                                  />
                                ) : null}
                                <div className="space-y-1">
                                  <div className="font-medium break-all">{u.code}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Estado: {u.status === "IN_STOCK" ? "Em stock" : "Adquirido"}
                                    {u.acquiredAt ? ` • ${new Date(u.acquiredAt).toLocaleDateString("pt-PT")}` : ""}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/scan/${u.code}`)}>
                                      Abrir scan
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(u.code);
                                          toast({ title: "Copiado", description: "Código copiado para a área de transferência." });
                                        } catch {
                                          toast({
                                            title: "Erro",
                                            description: "Não foi possível copiar.",
                                            variant: "destructive",
                                          });
                                        }
                                      }}
                                    >
                                      Copiar
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full lg:max-w-2xl">
                                <Input
                                  placeholder="S/N (opcional)"
                                  value={draft.serialNumber}
                                  onChange={(e) =>
                                    setUnitDrafts((prev) => ({
                                      ...prev,
                                      [u.id]: { ...draft, serialNumber: e.target.value },
                                    }))
                                  }
                                />
                                <Input
                                  placeholder="P/N (opcional)"
                                  value={draft.partNumber}
                                  onChange={(e) =>
                                    setUnitDrafts((prev) => ({
                                      ...prev,
                                      [u.id]: { ...draft, partNumber: e.target.value },
                                    }))
                                  }
                                />
                                <Input
                                  placeholder="Asset Tag (opcional)"
                                  value={draft.assetTag}
                                  onChange={(e) =>
                                    setUnitDrafts((prev) => ({
                                      ...prev,
                                      [u.id]: { ...draft, assetTag: e.target.value },
                                    }))
                                  }
                                />
                                <Textarea
                                  placeholder="Notas (opcional)"
                                  value={draft.notes}
                                  onChange={(e) =>
                                    setUnitDrafts((prev) => ({
                                      ...prev,
                                      [u.id]: { ...draft, notes: e.target.value },
                                    }))
                                  }
                                  className="md:col-span-2"
                                />

                                <div className="md:col-span-2 flex items-center justify-end">
                                  <Button onClick={() => saveUnit(u.id)} disabled={!!unitSaving[u.id]}>
                                    {unitSaving[u.id] ? "A guardar..." : "Guardar"}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="invoices" className="space-y-4">
              <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar fatura</DialogTitle>
                    <DialogDescription>
                      {requestIdFromQuery
                        ? "Esta fatura será ligada à requisição selecionada."
                        : "Registe uma nova fatura para este produto (ex.: quando entra mais stock)."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <Input
                      placeholder="Número da fatura"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />

                    <Input
                      placeholder="Nº REQ (opcional)"
                      value={reqNumber}
                      onChange={(e) => setReqNumber(e.target.value)}
                    />

                    <Input
                      type="date"
                      value={reqDate}
                      onChange={(e) => setReqDate(e.target.value)}
                      placeholder="Data da REQ (opcional)"
                    />

                    {requestIdFromQuery ? (
                      <div className="text-xs text-muted-foreground">
                        Requisição: <span className="font-medium">{requestIdFromQuery}</span>
                      </div>
                    ) : null}

                    <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="number"
                        min={0}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        placeholder="Quantidade"
                      />
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(Number(e.target.value))}
                        placeholder="Preço unitário"
                      />
                    </div>

                    <Input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Anexos (opcional)</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Cópia digitalizada da fatura</div>
                          <Input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) => setInvoiceAttachment(e.target.files?.[0] ?? null)}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Cópia do pedido/requisição (se existir)</div>
                          <Input
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) => setRequestAttachment(e.target.files?.[0] ?? null)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total: ${total.toFixed(2)}</span>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)} disabled={saving}>
                          Cancelar
                        </Button>
                        <Button onClick={() => addInvoice()} disabled={saving || !invoiceNumber.trim() || quantity <= 0}>
                          {saving ? "A guardar..." : "Adicionar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={requestPickOpen} onOpenChange={setRequestPickOpen}>
                <DialogContent className="sm:max-w-[560px]">
                  <DialogHeader>
                    <DialogTitle>Selecionar requisição</DialogTitle>
                    <DialogDescription>
                      Há mais do que uma requisição possível para este produto. Selecione qual deve ficar associada à fatura.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">Requisição</div>
                      <Select value={pickedRequestId} onValueChange={setPickedRequestId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar requisição" />
                        </SelectTrigger>
                        <SelectContent>
                          {requestCandidates.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.gtmiNumber}
                              {c.title ? ` - ${c.title}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {pickedRequestId ? (
                        <div className="text-xs text-muted-foreground">
                          {(() => {
                            const selected = requestCandidates.find((c) => c.id === pickedRequestId);
                            if (!selected) return "";
                            return selected.requestedAt
                              ? `Data: ${new Date(selected.requestedAt).toLocaleString()}`
                              : "";
                          })()}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setRequestPickOpen(false)} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => {
                        const selected = requestCandidates.find((c) => c.id === pickedRequestId);
                        if (selected?.gtmiNumber) setReqNumber(selected.gtmiNumber);
                        setRequestPickOpen(false);
                        if (pickedRequestId) addInvoice(pickedRequestId);
                      }}
                      disabled={saving || !pickedRequestId}
                    >
                      Associar e registar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <SectionCard title="Faturas" description="Repositório de faturas deste produto (pesquise por Nº FT ou Nº REQ).">
                <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
                  <Input
                    placeholder="Procurar por Nº FT ou Nº REQ…"
                    value={invoiceRepoQuery}
                    onChange={(e) => setInvoiceRepoQuery(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setInvoiceDialogOpen(true)}>
                      Adicionar fatura
                    </Button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {filteredInvoices.length} de {invoices.length} fatura(s)
                </div>

                {filteredInvoices.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState
                      title={invoices.length === 0 ? "Sem faturas" : "Sem resultados"}
                      description={
                        invoices.length === 0
                          ? "Ainda não existem faturas associadas a este produto."
                          : "Não encontrámos nenhuma fatura com esse número."
                      }
                      action={
                        invoices.length === 0 ? (
                          <Button onClick={() => setInvoiceDialogOpen(true)}>Adicionar primeira fatura</Button>
                        ) : (
                          <Button variant="outline" onClick={() => setInvoiceRepoQuery("")}>Limpar pesquisa</Button>
                        )
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                    {filteredInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        id={`invoice-${inv.id}`}
                        className={
                          "border rounded-md p-3 " +
                          (invoiceIdFromQuery && invoiceIdFromQuery === inv.id
                            ? "ring-2 ring-primary/40 bg-muted/20"
                            : "")
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{inv.invoiceNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(inv.issuedAt).toLocaleDateString("pt-PT")}
                          </div>
                        </div>

                        {inv.request ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Requisição: <span className="font-medium">{inv.request.title?.trim() ? inv.request.title : inv.request.id}</span>
                            {" • "}
                            Pessoa: <span className="font-medium">{inv.request.user.name}</span>
                          </div>
                        ) : inv.reqNumber ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Nº REQ: <span className="font-medium">{inv.reqNumber}</span>
                          </div>
                        ) : null}

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-sm text-muted-foreground">
                            {inv.quantity} × {inv.unitPrice} = ${(inv.quantity * inv.unitPrice).toFixed(2)}
                          </div>
                          <div className="flex items-center gap-2">
                            <AttachmentsDialog
                              kind="INVOICE"
                              invoiceId={inv.id}
                              buttonText="Anexos"
                              title={`Anexos • ${inv.invoiceNumber}`}
                              description="Ficheiros ligados a esta fatura (PDF, imagem, etc.)."
                            />
                            {origin ? (
                              <QRCodeComponent
                                data={`${origin}/products/${productId}?invoiceId=${inv.id}${inv.requestId ? `&requestId=${inv.requestId}` : ""}`}
                                title="QR"
                                size={110}
                                showDownload={false}
                              />
                            ) : null}
                          </div>
                        </div>

                        {inv.notes ? <div className="text-sm mt-1">{inv.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="movements" className="space-y-4">
              <SectionCard
                title="Movimentos"
                description="Histórico de entradas (IN) e saídas (OUT) deste produto (com filtros)."
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col lg:flex-row gap-2 lg:items-end lg:justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">Pesquisa</div>
                      <Input
                        placeholder="Procurar por fatura, REQ, motivo, centro de custo, notas, utilizador…"
                        value={movementsQuery}
                        onChange={(e) => setMovementsQuery(e.target.value)}
                      />
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Tipo</div>
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={movementsType}
                        onChange={(e) => setMovementsType(e.target.value as any)}
                      >
                        <option value="">Todos</option>
                        <option value="IN">IN</option>
                        <option value="OUT">OUT</option>
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">De</div>
                        <Input type="date" value={movementsFrom} onChange={(e) => setMovementsFrom(e.target.value)} />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Até</div>
                        <Input type="date" value={movementsTo} onChange={(e) => setMovementsTo(e.target.value)} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => loadMovements({ reset: true })}
                        disabled={movementsLoading}
                      >
                        {movementsLoading ? "A carregar..." : "Atualizar"}
                      </Button>
                      {movementsNextCursor ? (
                        <Button
                          variant="outline"
                          onClick={() => loadMovements({ reset: false })}
                          disabled={movementsLoading}
                        >
                          Mais
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {movements.length} movimento(s)
                    {movementsNextCursor ? " • (há mais para carregar)" : ""}
                  </div>
                </div>

                {movements.length === 0 && !movementsLoading ? (
                  <div className="mt-4">
                    <EmptyState
                      title="Sem movimentos"
                      description="Ainda não existem movimentos registados para este produto. Entradas são registadas no intake; saídas no scan/aquisição."
                    />
                  </div>
                ) : (
                  <div className="mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[160px]">Data</TableHead>
                          <TableHead className="w-[70px]">Tipo</TableHead>
                          <TableHead className="w-[70px]">Qtd</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movements.map((m) => {
                          const typeLabel = m.type === "IN" ? "IN" : "OUT";
                          const typeClass = m.type === "IN" ? "text-emerald-600" : "text-rose-600";
                          const docParts = [
                            m.invoice?.invoiceNumber ? `FT: ${m.invoice.invoiceNumber}` : null,
                            m.invoice?.reqNumber ? `REQ: ${m.invoice.reqNumber}` : null,
                            m.request
                              ? `Req: ${m.request.title?.trim() ? m.request.title : m.request.id}`
                              : null,
                          ].filter(Boolean);

                          return (
                            <TableRow key={m.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(m.createdAt).toLocaleString("pt-PT")}
                              </TableCell>
                              <TableCell className={`font-medium ${typeClass}`}>{typeLabel}</TableCell>
                              <TableCell>{m.quantity}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {docParts.length ? docParts.join(" • ") : "—"}
                                </div>
                                {m.unit?.code ? (
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground break-all">Unidade: {m.unit.code}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => router.push(`/scan/${m.unit!.code}`)}
                                    >
                                      Scan
                                    </Button>
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-xs text-muted-foreground">
                                    {m.reason ? `Motivo: ${m.reason}` : ""}
                                    {m.costCenter ? `${m.reason ? " • " : ""}CC: ${m.costCenter}` : ""}
                                  </div>
                                  {m.assignedTo ? (
                                    <div className="text-xs text-muted-foreground">
                                      Atribuído a: <span className="font-medium">{m.assignedTo.name}</span>
                                    </div>
                                  ) : null}
                                  {m.performedBy ? (
                                    <div className="text-xs text-muted-foreground">
                                      Por: <span className="font-medium">{m.performedBy.name}</span>
                                    </div>
                                  ) : null}
                                  {m.notes ? <div className="text-xs">{m.notes}</div> : null}
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
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
