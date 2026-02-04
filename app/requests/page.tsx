"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/authContext";
import { useProductStore } from "@/app/useProductStore";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeComponent } from "@/components/ui/qr-code";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import AttachmentsDialog from "@/app/components/AttachmentsDialog";
import { Paperclip, Plus, Printer, QrCode, RefreshCcw, Trash2 } from "lucide-react";

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  unit?: string | null;
  reference?: string | null;
  destination?: string | null;
  product?: { id: string; name: string; sku: string };
  createdAt: string;
  updatedAt: string;
};

type GoodsType = "MATERIALS_SERVICES" | "WAREHOUSE_MATERIALS" | "OTHER_PRODUCTS";

type RequestDto = {
  id: string;
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  title?: string | null;
  notes?: string | null;
  gtmiYear: number;
  gtmiSeq: number;
  gtmiNumber: string;
  requestedAt: string;
  requestingService?: string | null;
  requesterName?: string | null;
  requesterEmployeeNo?: string | null;
  deliveryLocation?: string | null;
  expectedDeliveryFrom?: string | null;
  expectedDeliveryTo?: string | null;
  goodsTypes: GoodsType[];
  supplierOption1?: string | null;
  supplierOption2?: string | null;
  supplierOption3?: string | null;

  signedAt?: string | null;
  signedByName?: string | null;
  signedByTitle?: string | null;
  signedByUserId?: string | null;
  signedBy?: { id: string; name: string; email: string } | null;

  createdAt: string;
  updatedAt: string;
  items: RequestItemDto[];
  invoices?: Array<{ id: string; invoiceNumber: string; issuedAt: string; productId: string }>;
  user?: { id: string; name: string; email: string };
  createdBy?: { id: string; name: string; email: string };
};

type UserDto = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

const formatStatus = (status: RequestDto["status"]) => {
  switch (status) {
    case "DRAFT":
      return { label: "Rascunho", className: "bg-muted/50 text-muted-foreground border-border/60" };
    case "SUBMITTED":
      return { label: "Submetida", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" };
    case "APPROVED":
      return { label: "Aprovada", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };
    case "REJECTED":
      return { label: "Rejeitada", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" };
    case "FULFILLED":
      return { label: "Cumprida", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20" };
    default:
      return { label: status, className: "bg-muted/50 text-muted-foreground border-border/60" };
  }
};

const goodsTypeLabels: Record<GoodsType, string> = {
  MATERIALS_SERVICES: "Material de consumo / Serviços",
  WAREHOUSE_MATERIALS: "Material de armazém",
  OTHER_PRODUCTS: "Outros produtos",
};

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

type NewRequestItem = {
  productId: string;
  quantity: number;
  unit?: string;
  reference?: string;
  destination?: string;
  notes?: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isLoggedIn, user } = useAuth();
  const { allProducts, loadProducts } = useProductStore();

  const [origin, setOrigin] = useState("");
  const focusId = searchParams?.get("focus");

  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState<UserDto[]>([]);
  const [asUserId, setAsUserId] = useState<string>("");

  const [requests, setRequests] = useState<RequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrRequest, setQrRequest] = useState<RequestDto | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsRequest, setDetailsRequest] = useState<RequestDto | null>(null);

  const [signOpen, setSignOpen] = useState(false);
  const [signSaving, setSignSaving] = useState(false);
  const [signName, setSignName] = useState("");
  const [signTitle, setSignTitle] = useState("");

  const [requestedAt, setRequestedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [requestingService, setRequestingService] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmployeeNo, setRequesterEmployeeNo] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [expectedDeliveryFrom, setExpectedDeliveryFrom] = useState<string>("");
  const [expectedDeliveryTo, setExpectedDeliveryTo] = useState<string>("");

  const [goodsTypes, setGoodsTypes] = useState<Record<GoodsType, boolean>>({
    MATERIALS_SERVICES: false,
    WAREHOUSE_MATERIALS: false,
    OTHER_PRODUCTS: false,
  });

  const [supplierOption1, setSupplierOption1] = useState("");
  const [supplierOption2, setSupplierOption2] = useState("");
  const [supplierOption3, setSupplierOption3] = useState("");

  const [items, setItems] = useState<NewRequestItem[]>([
    { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
  ]);

  const canCreate = useMemo(() => {
    const hasAtLeastOneItem = items.length > 0;
    const allValid = items.every((it) => Boolean(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
    return hasAtLeastOneItem && allValid;
  }, [items]);

  const loadAll = async () => {
    if (!isLoggedIn) return;

    setLoading(true);
    try {
      const effectiveAsUserId = isAdmin && asUserId ? asUserId : undefined;
      await loadProducts(effectiveAsUserId);
      const res = await axiosInstance.get("/requests", {
        params: effectiveAsUserId ? { asUserId: effectiveAsUserId } : undefined,
      });
      setRequests(res.data || []);
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as requisições.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    setOrigin(window.location.origin);

    const bootstrapAdmin = async () => {
      if (!isAdmin) return;
      try {
        const res = await axiosInstance.get("/users");
        setUsers(res.data || []);
        if (!asUserId && user?.id) {
          setAsUserId(user.id);
        }
      } catch {
        // ignore: admin features won't show without users list
      }
    };

    bootstrapAdmin();

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    if (isAdmin && asUserId) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asUserId]);

  const createRequest = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const effectiveAsUserId = isAdmin && asUserId ? asUserId : undefined;

      const requestedAtDate = requestedAt ? new Date(requestedAt) : new Date();
      if (Number.isNaN(requestedAtDate.getTime())) {
        toast({
          title: "Erro",
          description: "Data/Hora do pedido inválida.",
          variant: "destructive",
        });
        return;
      }

      const expectedFromDate = expectedDeliveryFrom ? new Date(expectedDeliveryFrom) : undefined;
      if (expectedFromDate && Number.isNaN(expectedFromDate.getTime())) {
        toast({
          title: "Erro",
          description: "Data prevista (de) inválida.",
          variant: "destructive",
        });
        return;
      }

      const expectedToDate = expectedDeliveryTo ? new Date(expectedDeliveryTo) : undefined;
      if (expectedToDate && Number.isNaN(expectedToDate.getTime())) {
        toast({
          title: "Erro",
          description: "Data prevista (até) inválida.",
          variant: "destructive",
        });
        return;
      }

      const requestedAtIso = requestedAtDate.toISOString();

      const effectiveGoodsTypes = (Object.keys(goodsTypes) as GoodsType[]).filter((k) => goodsTypes[k]);

      const payload = {
        asUserId: effectiveAsUserId,
        requestedAt: requestedAtIso,
        title: title.trim() ? title.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        requestingService: requestingService.trim() ? requestingService.trim() : undefined,
        requesterName: requesterName.trim() ? requesterName.trim() : undefined,
        requesterEmployeeNo: requesterEmployeeNo.trim() ? requesterEmployeeNo.trim() : undefined,
        deliveryLocation: deliveryLocation.trim() ? deliveryLocation.trim() : undefined,
        expectedDeliveryFrom: expectedFromDate ? expectedFromDate.toISOString() : undefined,
        expectedDeliveryTo: expectedToDate ? expectedToDate.toISOString() : undefined,
        goodsTypes: effectiveGoodsTypes,
        supplierOption1: supplierOption1.trim() ? supplierOption1.trim() : undefined,
        supplierOption2: supplierOption2.trim() ? supplierOption2.trim() : undefined,
        supplierOption3: supplierOption3.trim() ? supplierOption3.trim() : undefined,
        items: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unit: it.unit?.trim() ? it.unit.trim() : undefined,
          reference: it.reference?.trim() ? it.reference.trim() : undefined,
          destination: it.destination?.trim() ? it.destination.trim() : undefined,
          notes: it.notes?.trim() ? it.notes.trim() : undefined,
        })),
      };
      const res = await axiosInstance.post("/requests", payload);
      setRequests((prev) => [res.data, ...prev]);

      setRequestedAt(toDatetimeLocalValue(new Date()));
      setTitle("");
      setNotes("");
      setRequestingService("");
      setRequesterName("");
      setRequesterEmployeeNo("");
      setDeliveryLocation("");
      setExpectedDeliveryFrom("");
      setExpectedDeliveryTo("");
      setGoodsTypes({
        MATERIALS_SERVICES: false,
        WAREHOUSE_MATERIALS: false,
        OTHER_PRODUCTS: false,
      });
      setSupplierOption1("");
      setSupplierOption2("");
      setSupplierOption3("");
      setItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);

      setCreateOpen(false);

      toast({
        title: "Requisição criada",
        description: "A requisição foi submetida com sucesso.",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar a requisição.";
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openDetails = async (r: RequestDto) => {
    setDetailsRequest(r);
    setDetailsOpen(true);

    setDetailsLoading(true);
    try {
      const res = await axiosInstance.get(`/requests/${r.id}`, {
        params: isAdmin ? { asUserId: r.userId } : undefined,
      });
      setDetailsRequest(res.data);
    } catch {
      // Keep whatever we already have in the list.
    } finally {
      setDetailsLoading(false);
    }
  };

  const printRequest = (r: RequestDto) => {
    window.open(`/requests/${r.id}/print` + (isAdmin ? `?asUserId=${r.userId}` : ""), "_blank");
  };

  const openQr = (r: RequestDto) => {
    setQrRequest(r);
    setQrOpen(true);
  };

  const openSign = (r: RequestDto) => {
    setSignName((r.signedByName || user?.name || "").trim());
    setSignTitle((r.signedByTitle || "").trim());
    setSignOpen(true);
  };

  const submitSign = async () => {
    if (!detailsRequest) return;
    if (!signName.trim()) return;

    setSignSaving(true);
    try {
      const res = await axiosInstance.patch(
        `/requests/${detailsRequest.id}`,
        {
          sign: {
            name: signName.trim(),
            title: signTitle.trim() ? signTitle.trim() : undefined,
          },
        },
        {
          params: isAdmin ? { asUserId: detailsRequest.userId } : undefined,
        }
      );

      setDetailsRequest(res.data);
      setSignOpen(false);
      toast({ title: "Assinado", description: "A requisição foi assinada." });
      await loadAll();
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível assinar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSignSaving(false);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Requisições</h1>
            <p className="text-sm text-muted-foreground">
              Crie requisições de reposição/compra ligadas aos produtos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova requisição
            </Button>
            <Button variant="outline" onClick={() => loadAll()} disabled={loading}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              {loading ? "A carregar..." : "Atualizar"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Requisições recentes</CardTitle>
              <CardDescription>
                Lista por utilizador (escopo por sessão).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">A carregar...</p>
              ) : requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem requisições ainda.</p>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Nº</TableHead>
                        <TableHead>Status</TableHead>
                        {isAdmin ? <TableHead className="hidden lg:table-cell">Pessoa</TableHead> : null}
                        <TableHead className="max-w-[220px]">Serviço</TableHead>
                        <TableHead className="hidden md:table-cell">Pedido</TableHead>
                        <TableHead className="hidden lg:table-cell">Previsto</TableHead>
                        <TableHead className="whitespace-nowrap">Itens</TableHead>
                        <TableHead className="hidden md:table-cell">Assinatura</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((r) => (
                        <TableRow
                          key={r.id}
                          className={focusId && focusId === r.id ? "bg-muted/30" : ""}
                        >
                          <TableCell className="font-medium py-2 px-3 whitespace-nowrap">
                            <Button
                              variant="link"
                              className="h-auto p-0 font-semibold"
                              onClick={() => openDetails(r)}
                            >
                              {r.gtmiNumber}
                            </Button>
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <Badge variant="outline" className={formatStatus(r.status).className}>
                              {formatStatus(r.status).label}
                            </Badge>
                          </TableCell>
                          {isAdmin ? (
                            <TableCell className="hidden lg:table-cell py-2 px-3">
                              {r.user ? (
                                <span className="text-sm">{r.user.name}</span>
                              ) : (
                                <span className="text-sm text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="py-2 px-3 max-w-[220px]">
                            <span className="text-sm truncate block" title={r.requestingService || ""}>
                              {r.requestingService || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-2 px-3 whitespace-nowrap">
                            <span className="text-sm">{new Date(r.requestedAt).toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell py-2 px-3 whitespace-nowrap">
                            <span className="text-sm">
                              {(r.expectedDeliveryFrom ? r.expectedDeliveryFrom.slice(0, 10) : "—") +
                                " → " +
                                (r.expectedDeliveryTo ? r.expectedDeliveryTo.slice(0, 10) : "—")}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 px-3 whitespace-nowrap">
                            <span className="text-sm">{r.items?.length || 0}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-2 px-3">
                            {r.signedAt ? (
                              <div className="text-sm">
                                <div className="font-medium">{r.signedByName || r.signedBy?.name || "—"}</div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(r.signedAt).toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Por assinar</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right py-2 px-3">
                            <div className="inline-flex items-center gap-1">
                              <AttachmentsDialog
                                kind="REQUEST"
                                requestId={r.id}
                                title={`Anexos • ${r.gtmiNumber}`}
                                description="Ficheiros ligados a esta requisição."
                                trigger={
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    title="Anexos"
                                    aria-label="Anexos"
                                  >
                                    <Paperclip className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => printRequest(r)}
                                title="Imprimir"
                                aria-label="Imprimir"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openQr(r)}
                                disabled={!origin}
                                title="QR"
                                aria-label="QR"
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

            </CardContent>
          </Card>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent className="sm:max-w-[980px]">
              <DialogHeader>
                <DialogTitle>Nova requisição</DialogTitle>
                <DialogDescription>Preencha os dados e adicione pelo menos um item.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {isAdmin ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Criar em nome de</div>
                    <Select value={asUserId} onValueChange={setAsUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar utilizador" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      A requisição será criada em nome da pessoa selecionada.
                    </div>
                  </div>
                ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Data/Hora do pedido</div>
                  <Input
                    type="datetime-local"
                    value={requestedAt}
                    onChange={(e) => setRequestedAt(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Serviço requisitante</div>
                  <Input
                    placeholder="Ex: Informática / Armazém / ..."
                    value={requestingService}
                    onChange={(e) => setRequestingService(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Funcionário / Órgão (nome)</div>
                  <Input
                    placeholder="Nome"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Nº mecanográfico</div>
                  <Input
                    placeholder="Nº"
                    value={requesterEmployeeNo}
                    onChange={(e) => setRequesterEmployeeNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Local de entrega</div>
                <Input
                  placeholder="Ex: Armazém central / Piso 2 / ..."
                  value={deliveryLocation}
                  onChange={(e) => setDeliveryLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Data prevista (de)</div>
                  <Input
                    type="date"
                    value={expectedDeliveryFrom}
                    onChange={(e) => setExpectedDeliveryFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Data prevista (até)</div>
                  <Input
                    type="date"
                    value={expectedDeliveryTo}
                    onChange={(e) => setExpectedDeliveryTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Tipo de bem/serviço</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(Object.keys(goodsTypeLabels) as GoodsType[]).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={goodsTypes[k]}
                        onCheckedChange={(checked) =>
                          setGoodsTypes((prev) => ({ ...prev, [k]: Boolean(checked) }))
                        }
                      />
                      <span>{goodsTypeLabels[k]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Itens</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[320px]">Produto</TableHead>
                      <TableHead className="w-[110px]">Qtd</TableHead>
                      <TableHead className="w-[150px]">Unid.</TableHead>
                      <TableHead className="w-[160px]">Referência</TableHead>
                      <TableHead className="w-[180px]">Destino</TableHead>
                      <TableHead>Descrição / Observações</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select
                            value={it.productId}
                            onValueChange={(v) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) => (pIdx === idx ? { ...p, productId: v } : p))
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Produto" />
                            </SelectTrigger>
                            <SelectContent>
                              {allProducts
                                .slice()
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.sku})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, quantity: Number(e.target.value) } : p
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Ex: caixa / un"
                            value={it.unit || ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, unit: e.target.value } : p
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Ref / Nº série"
                            value={it.reference || ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, reference: e.target.value } : p
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Destino"
                            value={it.destination || ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, destination: e.target.value } : p
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Notas do item"
                            value={it.notes || ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, notes: e.target.value } : p
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={items.length <= 1}
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            title="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setItems((prev) => [
                        ...prev,
                        { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar linha
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Fornecedor (opção 1)</div>
                  <Input value={supplierOption1} onChange={(e) => setSupplierOption1(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Fornecedor (opção 2)</div>
                  <Input value={supplierOption2} onChange={(e) => setSupplierOption2(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Fornecedor (opção 3)</div>
                  <Input value={supplierOption3} onChange={(e) => setSupplierOption3(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Título (opcional)</div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Notas gerais (opcional)</div>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={createRequest} disabled={!canCreate || creating}>
                {creating ? "A criar..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={detailsOpen}
          onOpenChange={(o) => {
            setDetailsOpen(o);
            if (!o) setDetailsRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-[980px]">
            <DialogHeader>
              <DialogTitle>Detalhes da requisição</DialogTitle>
              <DialogDescription>
                {detailsRequest ? detailsRequest.gtmiNumber : ""}
                {detailsLoading ? " • a carregar…" : ""}
              </DialogDescription>
            </DialogHeader>

            {!detailsRequest ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={formatStatus(detailsRequest.status).className}>
                      {formatStatus(detailsRequest.status).label}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      {new Date(detailsRequest.requestedAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <AttachmentsDialog
                      kind="REQUEST"
                      requestId={detailsRequest.id}
                      title={`Anexos • ${detailsRequest.gtmiNumber}`}
                      description="Ficheiros ligados a esta requisição."
                    />
                    <Button
                      onClick={() => openSign(detailsRequest)}
                      disabled={Boolean(detailsRequest.signedAt)}
                    >
                      {detailsRequest.signedAt ? "Assinada" : "Assinar"}
                    </Button>
                    <Button variant="outline" onClick={() => printRequest(detailsRequest)}>
                      Imprimir
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  {detailsRequest.signedAt ? (
                    <span>
                      Assinada por{" "}
                      <span className="font-medium">
                        {detailsRequest.signedByName || detailsRequest.signedBy?.name || "—"}
                      </span>
                      {detailsRequest.signedByTitle ? ` • ${detailsRequest.signedByTitle}` : ""}
                      {" • "}
                      {new Date(detailsRequest.signedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span>Ainda não assinada.</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">Identificação</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Serviço:</span> {detailsRequest.requestingService || "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Funcionário/Órgão:</span>{" "}
                        {detailsRequest.requesterName || "—"}
                        {detailsRequest.requesterEmployeeNo ? ` (${detailsRequest.requesterEmployeeNo})` : ""}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Local de entrega:</span> {detailsRequest.deliveryLocation || "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Previsto:</span>{" "}
                        {detailsRequest.expectedDeliveryFrom ? detailsRequest.expectedDeliveryFrom.slice(0, 10) : "—"} →{" "}
                        {detailsRequest.expectedDeliveryTo ? detailsRequest.expectedDeliveryTo.slice(0, 10) : "—"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">Tipo / Fornecedores</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tipo:</span>{" "}
                        {detailsRequest.goodsTypes?.length
                          ? detailsRequest.goodsTypes.map((g) => goodsTypeLabels[g]).join(" • ")
                          : "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fornecedor 1:</span> {detailsRequest.supplierOption1 || "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fornecedor 2:</span> {detailsRequest.supplierOption2 || "—"}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Fornecedor 3:</span> {detailsRequest.supplierOption3 || "—"}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Itens</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[48px]">#</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-[110px]">Qtd</TableHead>
                        <TableHead className="w-[140px]">Unid.</TableHead>
                        <TableHead className="w-[160px]">Referência</TableHead>
                        <TableHead className="w-[160px]">Destino</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailsRequest.items.map((it, idx) => (
                        <TableRow key={it.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="font-medium">{it.product?.name || it.productId}</div>
                            {it.product?.sku ? (
                              <div className="text-xs text-muted-foreground">SKU: {it.product.sku}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>{it.quantity}</TableCell>
                          <TableCell>{it.unit || ""}</TableCell>
                          <TableCell>{it.reference || ""}</TableCell>
                          <TableCell>{it.destination || ""}</TableCell>
                          <TableCell>{it.notes || ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {detailsRequest.title?.trim() || detailsRequest.notes?.trim() ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Título</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        {detailsRequest.title?.trim() ? detailsRequest.title : "—"}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">Notas gerais</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {detailsRequest.notes?.trim() ? detailsRequest.notes : "—"}
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={signOpen} onOpenChange={setSignOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Assinar requisição</DialogTitle>
              <DialogDescription>
                Confirma a assinatura desta requisição. Fica registado o nome/cargo e a data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Nome</div>
                <Input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Nome de quem assina" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Cargo (opcional)</div>
                <Input value={signTitle} onChange={(e) => setSignTitle(e.target.value)} placeholder="Ex: Responsável / Chefia" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSignOpen(false)} disabled={signSaving}>
                Cancelar
              </Button>
              <Button onClick={submitSign} disabled={signSaving || !signName.trim()}>
                {signSaving ? "A assinar..." : "Assinar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={qrOpen}
          onOpenChange={(o) => {
            setQrOpen(o);
            if (!o) setQrRequest(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>QR • Requisição</DialogTitle>
              <DialogDescription>{qrRequest ? qrRequest.gtmiNumber : ""}</DialogDescription>
            </DialogHeader>
            {origin && qrRequest ? (
              <div className="flex justify-center">
                <QRCodeComponent
                  data={`${origin}/requests?focus=${qrRequest.id}`}
                  title={`QR • ${qrRequest.gtmiNumber}`}
                  size={260}
                  showDownload
                />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
