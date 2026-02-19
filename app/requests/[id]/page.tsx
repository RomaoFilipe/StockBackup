"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import AttachmentsDialog from "@/app/components/AttachmentsDialog";
import { useAuth } from "@/app/authContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { QRCodeHover } from "@/components/ui/qr-code-hover";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Printer, Trash2 } from "lucide-react";
import { useProductStore } from "@/app/useProductStore";
import type { Product } from "@/app/types";

type GoodsType = "MATERIALS_SERVICES" | "WAREHOUSE_MATERIALS" | "OTHER_PRODUCTS";

type RequestingServiceDto = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  role?: "NORMAL" | "OLD" | "NEW";
  notes?: string | null;
  unit?: string | null;
  reference?: string | null;
  destination?: string | null;
  product?: { id: string; name: string; sku: string; supplier?: { id: string; name: string } | null };
  createdAt: string;
  updatedAt: string;
};

type RequestInvoiceDto = {
  id: string;
  invoiceNumber: string;
  issuedAt: string;
  productId: string;
  reqNumber?: string | null;
  reqDate?: string | null;
  requestId?: string | null;
};

type RequestDto = {
  id: string;
  userId: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "FULFILLED";
  requestType?: "STANDARD" | "RETURN";
  title?: string | null;
  notes?: string | null;

  gtmiYear: number;
  gtmiSeq: number;
  gtmiNumber: string;

  requestedAt: string;
  requestingService?: string | null;
  requestingServiceId?: number | null;
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
  signedBy?: { id: string; name: string; email: string } | null;

  signedVoidedAt?: string | null;
  signedVoidedReason?: string | null;
  signedVoidedBy?: { id: string; name: string; email: string } | null;

  pickupSignedAt?: string | null;
  pickupSignedByName?: string | null;
  pickupSignedByTitle?: string | null;
  pickupSignatureDataUrl?: string | null;
  pickupRecordedBy?: { id: string; name: string; email: string } | null;

  pickupVoidedAt?: string | null;
  pickupVoidedReason?: string | null;
  pickupVoidedBy?: { id: string; name: string; email: string } | null;

  createdAt: string;
  updatedAt: string;
  items: RequestItemDto[];

  invoices?: RequestInvoiceDto[];
  latestInvoices?: RequestInvoiceDto[];

  user?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
};

const goodsTypeLabels: Record<GoodsType, string> = {
  MATERIALS_SERVICES: "Material de consumo / Serviços",
  WAREHOUSE_MATERIALS: "Material de armazém",
  OTHER_PRODUCTS: "Outros produtos",
};

function formatDatePt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT");
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

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

const needsRestockSignatureBadge = (
  r: Pick<RequestDto, "requestType" | "status" | "pickupSignedAt">
) =>
  r.requestType === "RETURN" &&
  r.status !== "FULFILLED" &&
  r.status !== "REJECTED" &&
  !r.pickupSignedAt;

function makeClientKey() {
  try {
    const c: any = (globalThis as any)?.crypto;
    if (c && typeof c.randomUUID === "function") return String(c.randomUUID());
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function RequestDetailsPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const requestId = routeParams?.id;

  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const envBase = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    setOrigin(envBase || window.location.origin);
  }, []);

  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const { allProducts, loadProducts } = useProductStore();
  const productsList = useMemo(() => (Array.isArray(allProducts) ? allProducts : []), [allProducts]);

  const [request, setRequest] = useState<RequestDto | null>(null);
  const [loading, setLoading] = useState(true);

  const isSignedLocked = Boolean(request?.signedAt);

  const invoiceByProductId = useMemo(() => {
    const map: Record<string, RequestInvoiceDto> = {};
    const invoices = request?.latestInvoices?.length ? request.latestInvoices : request?.invoices || [];
    for (const inv of invoices) {
      if (!inv?.productId) continue;
      // API orders by issuedAt desc; first wins.
      if (!map[inv.productId]) map[inv.productId] = inv;
    }
    return map;
  }, [request?.invoices, request?.latestInvoices]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (isLoggedIn) return;

    const redirectTo = requestId ? `/requests/${requestId}` : "/requests";
    router.replace(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }, [isAuthLoading, isLoggedIn, requestId, router]);

  const loadRequest = async () => {
    if (!requestId) return;
    if (isAuthLoading || !isLoggedIn) return;

    setLoading(true);
    try {
      const res = await axiosInstance.get(`/requests/${requestId}`);
      setRequest(res.data);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar a requisição.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setRequest(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, isAuthLoading, isLoggedIn]);

  const [requestingServices, setRequestingServices] = useState<RequestingServiceDto[]>([]);
  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    (async () => {
      try {
        const res = await axiosInstance.get("/requesting-services");
        setRequestingServices(res.data || []);
      } catch {
        setRequestingServices([]);
      }
    })();
  }, [isAuthLoading, isLoggedIn]);

  // Edição foi movida para o modal na listagem (/requests).



  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    loadProducts();
  }, [isAuthLoading, isLoggedIn, loadProducts]);

  const [signOpen, setSignOpen] = useState(false);
  const [signSaving, setSignSaving] = useState(false);
  const [signName, setSignName] = useState("");
  const [signTitle, setSignTitle] = useState("");

  const openSign = () => {
    if (!isAdmin) return;
    setSignName((request?.signedByName || user?.name || "").trim());
    setSignTitle((request?.signedByTitle || "").trim());
    setSignOpen(true);
  };

  const submitSign = async () => {
    if (!requestId) return;
    if (!signName.trim()) return;

    setSignSaving(true);
    try {
      const res = await axiosInstance.patch(`/requests/${requestId}`, {
        sign: {
          name: signName.trim(),
          title: signTitle.trim() ? signTitle.trim() : undefined,
        },
      });
      setRequest(res.data);
      setSignOpen(false);
      toast({ title: "Assinado", description: "A requisição foi assinada." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível assinar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSignSaving(false);
    }
  };

  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupName, setPickupName] = useState("");
  const [pickupTitle, setPickupTitle] = useState("");
  const pickupPadRef = useRef<SignaturePadHandle | null>(null);

  const openPickupSign = () => {
    if (!isAdmin) return;
    setPickupName((request?.pickupSignedByName || "").trim());
    setPickupTitle((request?.pickupSignedByTitle || "").trim());
    setPickupOpen(true);
    setTimeout(() => pickupPadRef.current?.clear(), 0);
  };

  const submitPickupSign = async () => {
    if (!requestId) return;
    if (!pickupName.trim()) return;

    const sigPad = pickupPadRef.current;
    const signatureDataUrl = sigPad?.toDataURL?.() || "";
    if (!signatureDataUrl || sigPad?.isEmpty?.()) {
      toast({
        title: "Assinatura em falta",
        description: "Desenhe a assinatura antes de confirmar.",
        variant: "destructive",
      });
      return;
    }

    setPickupSaving(true);
    try {
      const res = await axiosInstance.patch(`/requests/${requestId}`, {
        pickupSign: {
          name: pickupName.trim(),
          title: pickupTitle.trim() ? pickupTitle.trim() : undefined,
          signatureDataUrl,
        },
      });

      setRequest(res.data);
      setPickupOpen(false);
      toast({ title: "Levantamento assinado", description: "A assinatura foi registada." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível assinar o levantamento.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setPickupSaving(false);
    }
  };

  const [voidSignOpen, setVoidSignOpen] = useState(false);
  const [voidSignSaving, setVoidSignSaving] = useState(false);
  const [voidSignReason, setVoidSignReason] = useState("");

  const submitVoidSign = async () => {
    if (!requestId) return;
    if (!voidSignReason.trim()) return;

    setVoidSignSaving(true);
    try {
      const res = await axiosInstance.patch(`/requests/${requestId}`, {
        voidSign: { reason: voidSignReason.trim() },
      });
      setRequest(res.data);
      setVoidSignOpen(false);
      toast({ title: "Assinatura anulada", description: "A assinatura foi anulada." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível anular.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setVoidSignSaving(false);
    }
  };

  const [voidPickupOpen, setVoidPickupOpen] = useState(false);
  const [voidPickupSaving, setVoidPickupSaving] = useState(false);
  const [voidPickupReason, setVoidPickupReason] = useState("");

  const submitVoidPickup = async () => {
    if (!requestId) return;
    if (!voidPickupReason.trim()) return;

    setVoidPickupSaving(true);
    try {
      const res = await axiosInstance.patch(`/requests/${requestId}`, {
        voidPickupSign: { reason: voidPickupReason.trim() },
      });
      setRequest(res.data);
      setVoidPickupOpen(false);
      toast({ title: "Levantamento anulado", description: "A assinatura de levantamento foi anulada." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível anular.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setVoidPickupSaving(false);
    }
  };

  const printRequest = () => {
    if (!requestId || !request) return;
    window.open(`/requests/${requestId}/print` + (isAdmin ? `?asUserId=${request.userId}` : ""), "_blank");
  };

  return (
    <AuthenticatedLayout>
      <div className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Requisição</h1>
            <p className="text-sm text-muted-foreground">
              {request?.gtmiNumber || (loading ? "A carregar…" : "—")}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {request ? (
              <AttachmentsDialog
                kind="REQUEST"
                requestId={request.id}
                title={`Anexos • ${request.gtmiNumber}`}
                description="Ficheiros ligados a esta requisição."
              />
            ) : null}

            <Button variant="outline" onClick={printRequest} disabled={!requestId || !request}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>

            {isAdmin ? (
              <>
                <Button
                  variant={request?.pickupSignedAt ? "outline" : "default"}
                  onClick={openPickupSign}
                  disabled={!request || Boolean(request.pickupSignedAt)}
                  title={request?.pickupSignedAt ? "Levantamento já assinado" : "Assinar levantamento"}
                >
                  <PenLine className="h-4 w-4 mr-2" />
                  {request?.pickupSignedAt ? "Levantamento assinado" : "Assinar levantamento"}
                </Button>

                <Button
                  onClick={openSign}
                  disabled={!request || Boolean(request.signedAt)}
                  title={request?.signedAt ? "Já assinada" : "Assinar"}
                >
                  <PenLine className="h-4 w-4 mr-2" />
                  {request?.signedAt ? "Assinada" : "Assinar"}
                </Button>
              </>
            ) : null}

            {isAdmin && request?.pickupSignedAt ? (
              <Button
                variant="outline"
                onClick={() => {
                  setVoidPickupReason("");
                  setVoidPickupOpen(true);
                }}
                title="Anular levantamento"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Anular levantamento
              </Button>
            ) : null}

            {isAdmin && request?.signedAt ? (
              <Button
                variant="outline"
                onClick={() => {
                  setVoidSignReason("");
                  setVoidSignOpen(true);
                }}
                title="Anular assinatura (Técnico GTMI)"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Anular assinatura
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">A carregar…</div>
        ) : !request ? (
          <div className="text-sm text-muted-foreground">Requisição não encontrada.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={formatStatus(request.status).className}>
                {formatStatus(request.status).label}
              </Badge>
              {needsRestockSignatureBadge(request) ? (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  Aguarda assinatura para repor stock
                </Badge>
              ) : null}
              <div className="text-sm text-muted-foreground">{new Date(request.requestedAt).toLocaleString()}</div>
              {request.user?.name ? (
                <div className="text-sm text-muted-foreground">• Pedido de {request.user.name}</div>
              ) : null}
              {request.createdBy?.name ? (
                <div className="text-sm text-muted-foreground">• Criado por {request.createdBy.name}</div>
              ) : null}
            </div>

            <div className="text-sm text-muted-foreground">
              {request.pickupSignedAt ? (
                <div className="mb-2">
                  Levantamento assinado por <span className="font-medium">{request.pickupSignedByName || "—"}</span>
                  {request.pickupSignedByTitle ? ` • ${request.pickupSignedByTitle}` : ""}
                  {" • "}
                  {new Date(request.pickupSignedAt).toLocaleString()}
                  {request.pickupRecordedBy ? (
                    <span className="text-xs text-muted-foreground"> (registado por {request.pickupRecordedBy.name})</span>
                  ) : null}
                </div>
              ) : request.pickupVoidedAt ? (
                <div className="mb-2 text-rose-700 dark:text-rose-300">
                  Levantamento anulado
                  {request.pickupVoidedReason ? ` • ${request.pickupVoidedReason}` : ""}
                  {" • "}
                  {new Date(request.pickupVoidedAt).toLocaleString()}
                  {request.pickupVoidedBy ? (
                    <span className="text-xs text-muted-foreground"> (por {request.pickupVoidedBy.name})</span>
                  ) : null}
                </div>
              ) : (
                <div className="mb-2">Levantamento ainda não assinado.</div>
              )}

              {request.pickupSignatureDataUrl ? (
                <div className="mt-2">
                  <div className="text-xs text-muted-foreground mb-1">Assinatura (preview)</div>
                  <div className="rounded-md border border-border/60 bg-background p-2">
                    <Image
                      src={request.pickupSignatureDataUrl}
                      alt="Assinatura de levantamento"
                      width={900}
                      height={240}
                      className="h-16 w-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-2">
                {request.signedAt ? (
                  <span>
                    Assinada por <span className="font-medium">{request.signedByName || request.signedBy?.name || "—"}</span>
                    {request.signedByTitle ? ` • ${request.signedByTitle}` : ""}
                    {" • "}
                    {new Date(request.signedAt).toLocaleString()}
                  </span>
                ) : request.signedVoidedAt ? (
                  <span className="text-rose-700 dark:text-rose-300">
                    Assinatura (Técnico GTMI) anulada
                    {request.signedVoidedReason ? ` • ${request.signedVoidedReason}` : ""}
                    {" • "}
                    {new Date(request.signedVoidedAt).toLocaleString()}
                    {request.signedVoidedBy ? (
                      <span className="text-xs text-muted-foreground"> (por {request.signedVoidedBy.name})</span>
                    ) : null}
                  </span>
                ) : (
                  <span>Ainda não assinada.</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Identificação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Serviço:</span>{" "}
                    <span>{request.requestingService || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Funcionário/Órgão:</span>{" "}
                    <span>
                      {request.requesterName || "—"}
                      {request.requesterEmployeeNo ? ` (${request.requesterEmployeeNo})` : ""}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Local de entrega:</span>{" "}
                    <span>{request.deliveryLocation || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Previsto:</span>{" "}
                    <span>
                      {request.expectedDeliveryFrom ? request.expectedDeliveryFrom.slice(0, 10) : "—"} → {request.expectedDeliveryTo ? request.expectedDeliveryTo.slice(0, 10) : "—"}
                    </span>
                  </div>

                  <div className="text-sm">
                    <span className="text-muted-foreground">Fundamento do Pedido:</span>
                    <div className="mt-1 whitespace-pre-wrap">{request.notes?.trim() ? request.notes : "—"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">Tipo / Fornecedores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Modalidade:</span>{" "}
                    <span>{request.requestType === "RETURN" ? "Devolução / Substituição" : "Normal"}</span>
                  </div>
                  {needsRestockSignatureBadge(request) ? (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reposição stock:</span>{" "}
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      >
                        Aguarda assinatura para repor stock
                      </Badge>
                    </div>
                  ) : null}
                  <div className="text-sm">
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    <span>
                      {request.goodsTypes?.length ? request.goodsTypes.map((g) => goodsTypeLabels[g]).join(" • ") : "—"}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fornecedor 1:</span>{" "}
                    <span>{request.supplierOption1 || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fornecedor 2:</span>{" "}
                    <span>{request.supplierOption2 || "—"}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fornecedor 3:</span>{" "}
                    <span>{request.supplierOption3 || "—"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                Itens {request.requestType === "RETURN" ? "(Devolução/Substituição)" : ""}
              </div>
              {request.requestType === "RETURN" ? (
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">Itens antigos (a devolver)</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[48px]">#</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-[110px]">Qtd</TableHead>
                          <TableHead className="w-[140px]">Unid.</TableHead>
                          <TableHead className="w-[160px]">Referência</TableHead>
                          <TableHead className="w-[180px]">QR</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {request.items.filter((it) => it.role === "OLD").map((it, idx) => (
                          <TableRow key={it.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium">{it.product?.name || it.productId}</div>
                              {it.product?.sku ? <div className="text-xs text-muted-foreground">SKU: {it.product.sku}</div> : null}
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
                  <div>
                    <div className="mb-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">Itens novos (a substituir)</div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[48px]">#</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-[110px]">Qtd</TableHead>
                          <TableHead className="w-[140px]">Unid.</TableHead>
                          <TableHead className="w-[160px]">Referência</TableHead>
                          <TableHead className="w-[180px]">QR</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {request.items.filter((it) => it.role === "NEW").map((it, idx) => (
                          <TableRow key={it.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              <div className="font-medium">{it.product?.name || it.productId}</div>
                              {it.product?.sku ? <div className="text-xs text-muted-foreground">SKU: {it.product.sku}</div> : null}
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
                </div>
              ) : (
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[48px]">#</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-[110px]">Qtd</TableHead>
                    <TableHead className="w-[140px]">Unid.</TableHead>
                    <TableHead className="w-[160px]">Referência</TableHead>
                    <TableHead className="w-[180px]">QR</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.items.map((it, idx) => (
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
                      <TableCell>
                        {it.destination?.trim() ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 font-mono text-xs"
                              onClick={() => router.push(`/scan/${encodeURIComponent(it.destination!.trim())}`)}
                              title="Abrir detalhe do QR"
                            >
                              {it.destination.trim()}
                            </Button>
                            {origin ? (
                              <QRCodeHover
                                data={`${origin}/scan/${encodeURIComponent(it.destination.trim())}`}
                                title={`QR: ${it.destination.trim()}`}
                                size={220}
                              />
                            ) : null}
                          </div>
                        ) : (
                          ""
                        )}
                      </TableCell>
                      <TableCell>{it.notes || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium">Fornecedores / Faturas</div>
                <div className="text-xs text-muted-foreground">
                  Informação por item (empresa do produto + fatura associada à requisição, quando existe).
                </div>
              </div>

              {/* Mobile */}
              <div className="space-y-3 md:hidden">
                {request.items.map((it, idx) => {
                  const supplierName = it.product?.supplier?.name || "";
                  const meta = it.productId ? invoiceByProductId[it.productId] : undefined;

                  const reqNumber = meta?.reqNumber || request.gtmiNumber;
                  const reqDate = meta?.reqDate || request.requestedAt;

                  return (
                    <div key={`sup-m-${it.id || idx}`} className="rounded-md border border-border/60 p-3 space-y-2">
                      <div className="text-sm font-medium truncate">
                        {it.product?.name ? `${it.product.name}${it.product.sku ? ` (${it.product.sku})` : ""}` : it.productId}
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Empresa</span>
                          <div className="truncate">{supplierName || "—"}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-muted-foreground">Fatura Nº</span>
                            <div>
                              {meta?.invoiceNumber ? (
                                <Button
                                  variant="link"
                                  className="h-auto p-0 font-medium"
                                  onClick={() => {
                                    if (!meta?.id) return;
                                    const q = new URLSearchParams();
                                    q.set("invoiceId", meta.id);
                                    q.set("tab", "invoices");
                                    q.set("requestId", request.id);
                                    const suffix = q.toString() ? `?${q.toString()}` : "";
                                    router.push(`/products/${it.productId}${suffix}`);
                                  }}
                                  title="Abrir produto e fatura"
                                >
                                  {meta.invoiceNumber}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Data</span>
                            <div>{meta?.issuedAt ? formatDatePt(meta.issuedAt) : "—"}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-muted-foreground">REQ</span>
                            <div className="font-mono text-xs">{reqNumber || "—"}</div>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Data REQ</span>
                            <div>{reqDate ? formatDatePt(reqDate) : "—"}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden md:block">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[240px]">Produto</TableHead>
                      <TableHead className="min-w-[200px]">Empresa</TableHead>
                      <TableHead className="min-w-[140px]">Fatura Nº</TableHead>
                      <TableHead className="min-w-[130px]">Data</TableHead>
                      <TableHead className="min-w-[160px]">REQ</TableHead>
                      <TableHead className="min-w-[130px]">Data REQ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {request.items.map((it, idx) => {
                      const supplierName = it.product?.supplier?.name || "";
                      const meta = it.productId ? invoiceByProductId[it.productId] : undefined;

                      const reqNumber = meta?.reqNumber || request.gtmiNumber;
                      const reqDate = meta?.reqDate || request.requestedAt;

                      return (
                        <TableRow key={`sup-${it.id || idx}`}>
                          <TableCell className="max-w-[280px] truncate">
                            {it.product?.name
                              ? `${it.product.name}${it.product.sku ? ` (${it.product.sku})` : ""}`
                              : it.productId}
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">{supplierName || "—"}</TableCell>
                          <TableCell>
                            {meta?.invoiceNumber ? (
                              <Button
                                variant="link"
                                className="h-auto p-0 font-medium"
                                onClick={() => {
                                  if (!meta?.id) return;
                                  const q = new URLSearchParams();
                                  q.set("invoiceId", meta.id);
                                  q.set("tab", "invoices");
                                  q.set("requestId", request.id);
                                  const suffix = q.toString() ? `?${q.toString()}` : "";
                                  router.push(`/products/${it.productId}${suffix}`);
                                }}
                                title="Abrir produto e fatura"
                              >
                                {meta.invoiceNumber}
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{meta?.issuedAt ? formatDatePt(meta.issuedAt) : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{reqNumber || "—"}</TableCell>
                          <TableCell>{reqDate ? formatDatePt(reqDate) : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {request.title?.trim() ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Título</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {request.title?.trim() ? request.title : "—"}
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        )}

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

        <Dialog open={pickupOpen} onOpenChange={setPickupOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
            <DialogHeader>
              <DialogTitle>Assinar levantamento</DialogTitle>
              <DialogDescription>
                A pessoa que levanta o material deve assinar no ecrã. Esta assinatura vai aparecer na impressão (PDF).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Nome</div>
                  <Input value={pickupName} onChange={(e) => setPickupName(e.target.value)} placeholder="Nome de quem levanta" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Cargo (opcional)</div>
                  <Input value={pickupTitle} onChange={(e) => setPickupTitle(e.target.value)} placeholder="Ex: Funcionário / Prestador" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Assinatura</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => pickupPadRef.current?.clear()} disabled={pickupSaving}>
                    Limpar
                  </Button>
                </div>
                <SignaturePad ref={pickupPadRef} height={180} disabled={pickupSaving} />
                <div className="text-xs text-muted-foreground">Dica: use o dedo (mobile/tablet) ou o rato.</div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPickupOpen(false)} disabled={pickupSaving}>
                Cancelar
              </Button>
              <Button onClick={submitPickupSign} disabled={pickupSaving || !pickupName.trim()}>
                {pickupSaving ? "A guardar..." : "Confirmar assinatura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={voidSignOpen} onOpenChange={setVoidSignOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Anular assinatura (Técnico GTMI)</DialogTitle>
              <DialogDescription>Introduza um motivo. Esta ação é registada.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm font-medium">Motivo</div>
              <Textarea value={voidSignReason} onChange={(e) => setVoidSignReason(e.target.value)} placeholder="Motivo" />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setVoidSignOpen(false)} disabled={voidSignSaving}>
                Cancelar
              </Button>
              <Button onClick={submitVoidSign} disabled={voidSignSaving || voidSignReason.trim().length < 3}>
                {voidSignSaving ? "A anular..." : "Anular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={voidPickupOpen} onOpenChange={setVoidPickupOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Anular levantamento</DialogTitle>
              <DialogDescription>Introduza um motivo. Esta ação é registada.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm font-medium">Motivo</div>
              <Textarea value={voidPickupReason} onChange={(e) => setVoidPickupReason(e.target.value)} placeholder="Motivo" />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setVoidPickupOpen(false)} disabled={voidPickupSaving}>
                Cancelar
              </Button>
              <Button onClick={submitVoidPickup} disabled={voidPickupSaving || voidPickupReason.trim().length < 3}>
                {voidPickupSaving ? "A anular..." : "Anular"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
