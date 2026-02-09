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
import { Paperclip, PenLine, Plus, Printer, QrCode, RefreshCcw, Trash2 } from "lucide-react";
import type { Product } from "@/app/types";
type AvailableUnitDto = { id: string; code: string };

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

type RequestingServiceDto = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

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
  requestingServiceId?: number | null;
  requestingServiceRef?: RequestingServiceDto | null;
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

type InvoiceMeta = {
  invoiceId: string;
  invoiceNumber: string;
  issuedAt: string;
  reqNumber?: string | null;
  requestId?: string | null;
  reqDate?: string | null;
} | null;

function formatDatePt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-PT");
}

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();
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
  const [editRequestId, setEditRequestId] = useState<string | null>(null);

  const [requestedAt, setRequestedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [requestingServices, setRequestingServices] = useState<RequestingServiceDto[]>([]);
  const [requestingServiceId, setRequestingServiceId] = useState<string>("");
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

  const [invoiceByProductId, setInvoiceByProductId] = useState<Record<string, InvoiceMeta>>({});
  const [invoiceLoadingByProductId, setInvoiceLoadingByProductId] = useState<Record<string, boolean>>({});
  const [unitLoadingByRow, setUnitLoadingByRow] = useState<Record<number, boolean>>({});
  const [unitHintByProductId, setUnitHintByProductId] = useState<Record<string, { availableCount: number }>>({});
  const [itemQrOpen, setItemQrOpen] = useState(false);
  const [itemQrCode, setItemQrCode] = useState<string>("");

  const [items, setItems] = useState<NewRequestItem[]>([
    { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
  ]);

  const resetForm = () => {
    setRequestedAt(toDatetimeLocalValue(new Date()));
    setTitle("");
    setNotes("");
    setRequestingServiceId("");
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
    setItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
    setInvoiceByProductId({});
    setInvoiceLoadingByProductId({});
    setUnitHintByProductId({});
    setUnitLoadingByRow({});
  };

  const openCreateModal = () => {
    setEditRequestId(null);
    resetForm();
    setCreateOpen(true);
  };

  const openEditModal = (r: RequestDto) => {
    if (!r?.id) return;
    setEditRequestId(r.id);

    setRequestedAt(toDatetimeLocalValue(new Date(r.requestedAt)));
    setTitle(r.title ?? "");
    setNotes(r.notes ?? "");
    setRequestingServiceId(r.requestingServiceId ? String(r.requestingServiceId) : "");
    setRequesterName(r.requesterName ?? "");
    setRequesterEmployeeNo(r.requesterEmployeeNo ?? "");
    setDeliveryLocation(r.deliveryLocation ?? "");
    setExpectedDeliveryFrom(r.expectedDeliveryFrom ? String(r.expectedDeliveryFrom).slice(0, 10) : "");
    setExpectedDeliveryTo(r.expectedDeliveryTo ? String(r.expectedDeliveryTo).slice(0, 10) : "");
    setGoodsTypes({
      MATERIALS_SERVICES: Boolean(r.goodsTypes?.includes("MATERIALS_SERVICES")),
      WAREHOUSE_MATERIALS: Boolean(r.goodsTypes?.includes("WAREHOUSE_MATERIALS")),
      OTHER_PRODUCTS: Boolean(r.goodsTypes?.includes("OTHER_PRODUCTS")),
    });

    setItems(
      (Array.isArray(r.items) ? r.items : []).map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.unit ?? "",
        reference: it.reference ?? "",
        destination: it.destination ?? "",
        notes: it.notes ?? "",
      }))
    );

    // Clear caches; they will repopulate based on selected items.
    setInvoiceByProductId({});
    setInvoiceLoadingByProductId({});
    setUnitHintByProductId({});
    setUnitLoadingByRow({});
    setCreateOpen(true);
  };
  async function fetchAvailableUnits(args: { productId: string; take?: number; exclude?: string[] }) {
    const res = await axiosInstance.get("/units/available", {
      params: {
        productId: args.productId,
        take: args.take ?? 1,
        ...(args.exclude?.length ? { exclude: args.exclude } : {}),
      },
    });

    const availableCount = Number(res.data?.availableCount ?? 0);
    const units = (Array.isArray(res.data?.items) ? res.data.items : []) as AvailableUnitDto[];
    return { availableCount, units };
  }

  async function autoPickUnitForRow(
    rowIndex: number,
    opts?: { force?: boolean; productId?: string; excludeCode?: string }
  ) {
    const row = items[rowIndex];
    const productId = opts?.productId ?? row?.productId;
    if (!productId) return;

    const currentCode = (opts?.excludeCode ?? row?.destination ?? "").trim();
    if (!opts?.force && currentCode) return;

    setUnitLoadingByRow((prev) => ({ ...prev, [rowIndex]: true }));
    try {
      const { availableCount, units } = await fetchAvailableUnits({
        productId,
        take: 1,
        exclude: currentCode ? [currentCode] : [],
      });
      setUnitHintByProductId((prev) => ({ ...prev, [productId]: { availableCount } }));

      const nextCode = units[0]?.code ? String(units[0].code) : "";
      if (!nextCode) {
        return;
      }

      setItems((prev) =>
        prev.map((p, idx) => {
          if (idx !== rowIndex) return p;
          // For products tracked by unit (QR), enforce quantity=1.
          return { ...p, destination: nextCode, quantity: 1 };
        })
      );
    } catch {
      // silent (avoid noisy toasts on every select)
    } finally {
      setUnitLoadingByRow((prev) => ({ ...prev, [rowIndex]: false }));
    }
  }

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of allProducts as any[]) {
      if (p?.id) map.set(p.id, p as any);
    }
    return map;
  }, [allProducts]);

  // Keep a lightweight hint of unit availability per selected product (used for UI hinting).
  useEffect(() => {
    const uniqueProductIds = Array.from(
      new Set(items.map((it) => it.productId).filter((id) => Boolean(id)))
    ) as string[];

    const missing = uniqueProductIds.filter((id) => unitHintByProductId[id] === undefined);
    if (missing.length === 0) return;

    let alive = true;
    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (productId) => {
            try {
              const { availableCount } = await fetchAvailableUnits({ productId, take: 1 });
              return [productId, { availableCount }] as const;
            } catch {
              return [productId, { availableCount: 0 }] as const;
            }
          })
        );

        if (!alive) return;
        setUnitHintByProductId((prev) => {
          const next = { ...prev };
          for (const [productId, hint] of results) next[productId] = hint;
          return next;
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [items, unitHintByProductId]);

  useEffect(() => {
    const uniqueProductIds = Array.from(
      new Set(items.map((it) => it.productId).filter((id) => Boolean(id)))
    ) as string[];

    const missing = uniqueProductIds.filter(
      (id) => invoiceByProductId[id] === undefined && !invoiceLoadingByProductId[id]
    );
    if (missing.length === 0) return;

    let alive = true;

    (async () => {
      setInvoiceLoadingByProductId((prev) => {
        const next = { ...prev };
        for (const id of missing) next[id] = true;
        return next;
      });

      try {
        const results = await Promise.all(
          missing.map(async (productId) => {
            try {
              const res = await axiosInstance.get("/invoices", { params: { productId, take: 1 } });
              const latest = Array.isArray(res.data) ? res.data[0] : null;
              const reqNumber = latest?.reqNumber ?? latest?.request?.gtmiNumber ?? null;
              const meta: InvoiceMeta = latest
                ? {
                    invoiceId: String(latest.id),
                    invoiceNumber: String(latest.invoiceNumber ?? ""),
                    issuedAt: String(latest.issuedAt ?? ""),
                    reqNumber,
                    requestId: latest.requestId ? String(latest.requestId) : latest.request?.id ? String(latest.request.id) : null,
                    reqDate: latest.reqDate ? String(latest.reqDate) : null,
                  }
                : null;
              return [productId, meta] as const;
            } catch {
              // If invoices endpoint fails, avoid refetch loop.
              return [productId, null] as const;
            }
          })
        );

        if (!alive) return;
        setInvoiceByProductId((prev) => {
          const next = { ...prev };
          for (const [productId, meta] of results) next[productId] = meta;
          return next;
        });
      } finally {
        if (!alive) return;
        setInvoiceLoadingByProductId((prev) => {
          const next = { ...prev };
          for (const id of missing) next[id] = false;
          return next;
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, [items]);

  const canCreate = useMemo(() => {
    const hasAtLeastOneItem = items.length > 0;
    const allValid = items.every((it) => Boolean(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
    const hasRequestingService = Boolean(requestingServiceId);
    return hasAtLeastOneItem && allValid && hasRequestingService;
  }, [items, requestingServiceId]);

  const loadAll = async () => {
    if (!isLoggedIn) return;

    setLoading(true);
    try {
      await loadProducts();
      const res = await axiosInstance.get("/requests");
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
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent("/requests")}`);
      return;
    }

    const envBase = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
      .trim()
      .replace(/\/+$/, "");
    setOrigin(envBase || window.location.origin);

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

    (async () => {
      try {
        const res = await axiosInstance.get("/requesting-services");
        setRequestingServices(res.data || []);
      } catch {
        setRequestingServices([]);
      }
    })();

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin]);

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

      const supplierNamesOrdered = Array.from(
        new Set(
          items
            .map((it) => (it.productId ? (productById.get(it.productId) as any)?.supplier : undefined))
            .filter((s): s is string => Boolean(s))
        )
      );

      const supplierOption1 = supplierNamesOrdered[0];
      const supplierOption2 = supplierNamesOrdered[1];
      const supplierOption3 = supplierNamesOrdered[2];

      const payload = {
        asUserId: effectiveAsUserId,
        requestedAt: requestedAtIso,
        title: title.trim() ? title.trim() : undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        requestingServiceId: requestingServiceId ? Number(requestingServiceId) : undefined,
        requesterName: requesterName.trim() ? requesterName.trim() : undefined,
        requesterEmployeeNo: requesterEmployeeNo.trim() ? requesterEmployeeNo.trim() : undefined,
        deliveryLocation: deliveryLocation.trim() ? deliveryLocation.trim() : undefined,
        expectedDeliveryFrom: expectedFromDate ? expectedFromDate.toISOString() : undefined,
        expectedDeliveryTo: expectedToDate ? expectedToDate.toISOString() : undefined,
        goodsTypes: effectiveGoodsTypes,
        supplierOption1: supplierOption1 ? supplierOption1.trim() : undefined,
        supplierOption2: supplierOption2 ? supplierOption2.trim() : undefined,
        supplierOption3: supplierOption3 ? supplierOption3.trim() : undefined,
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
      setRequestingServiceId("");
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
      setItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
      setInvoiceByProductId({});
      setInvoiceLoadingByProductId({});

      setCreateOpen(false);
      setEditRequestId(null);

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

  const updateRequest = async () => {
    if (!canCreate) return;
    if (!editRequestId) return;

    setCreating(true);
    try {
      const requestedAtDate = requestedAt ? new Date(requestedAt) : new Date();
      if (Number.isNaN(requestedAtDate.getTime())) {
        toast({
          title: "Erro",
          description: "Data/Hora do pedido inválida.",
          variant: "destructive",
        });
        return;
      }

      const serviceId = requestingServiceId ? Number(requestingServiceId) : NaN;
      if (!Number.isFinite(serviceId)) {
        toast({
          title: "Erro",
          description: "Selecione um serviço requisitante.",
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

      const effectiveGoodsTypes = (Object.keys(goodsTypes) as GoodsType[]).filter((k) => goodsTypes[k]);

      const supplierNamesOrdered = Array.from(
        new Set(
          items
            .map((it) => (it.productId ? (productById.get(it.productId) as any)?.supplier : undefined))
            .filter((s): s is string => Boolean(s))
        )
      );

      const supplierOption1 = supplierNamesOrdered[0] || null;
      const supplierOption2 = supplierNamesOrdered[1] || null;
      const supplierOption3 = supplierNamesOrdered[2] || null;

      const payload = {
        requestedAt: requestedAtDate.toISOString(),
        requestingServiceId: serviceId,
        title: title.trim() ? title.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
        requesterName: requesterName.trim() ? requesterName.trim() : null,
        requesterEmployeeNo: requesterEmployeeNo.trim() ? requesterEmployeeNo.trim() : null,
        deliveryLocation: deliveryLocation.trim() ? deliveryLocation.trim() : null,
        expectedDeliveryFrom: expectedFromDate ? expectedFromDate.toISOString() : null,
        expectedDeliveryTo: expectedToDate ? expectedToDate.toISOString() : null,
        goodsTypes: effectiveGoodsTypes,
        supplierOption1,
        supplierOption2,
        supplierOption3,
        replaceItems: items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unit: it.unit?.trim() ? it.unit.trim() : null,
          reference: it.reference?.trim() ? it.reference.trim() : null,
          destination: it.destination?.trim() ? it.destination.trim() : null,
          notes: it.notes?.trim() ? it.notes.trim() : null,
        })),
      };

      await axiosInstance.patch(`/requests/${editRequestId}`, payload);

      setCreateOpen(false);
      setEditRequestId(null);
      resetForm();
      await loadAll();

      toast({
        title: "Atualizado",
        description: "A requisição foi atualizada.",
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || "Não foi possível guardar alterações.";
      toast({
        title: "Erro",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const openDetails = (r: RequestDto) => {
    router.push(`/requests/${r.id}`);
  };

  const printRequest = (r: RequestDto) => {
    window.open(`/requests/${r.id}/print` + (isAdmin ? `?asUserId=${r.userId}` : ""), "_blank");
  };

  const openQr = (r: RequestDto) => {
    setQrRequest(r);
    setQrOpen(true);
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
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova requisição</span>
            </Button>
            <Button variant="outline" onClick={() => loadAll()} disabled={loading}>
              <RefreshCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{loading ? "A carregar..." : "Atualizar"}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Requisições recentes</CardTitle>
              <CardDescription>
                Lista do tenant (visível para todos os utilizadores).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">A carregar...</p>
              ) : requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem requisições ainda.</p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {requests.map((r) => (
                      <div
                        key={r.id}
                        className={
                          "rounded-lg border bg-background p-3 " +
                          (focusId && focusId === r.id ? "border-primary/40 bg-muted/20" : "")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Button
                              variant="link"
                              className="h-auto p-0 font-semibold"
                              onClick={() => openDetails(r)}
                            >
                              {r.gtmiNumber}
                            </Button>
                            <div className="text-xs text-muted-foreground truncate" title={r.requestingService || ""}>
                              {r.requestingService || "—"}
                              {isAdmin && r.user?.name ? ` • ${r.user.name}` : ""}
                            </div>
                          </div>

                          <Badge variant="outline" className={formatStatus(r.status).className}>
                            {formatStatus(r.status).label}
                          </Badge>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground">Pedido</div>
                            <div className="text-sm">{new Date(r.requestedAt).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Itens</div>
                            <div className="text-sm">{r.items?.length || 0}</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-muted-foreground">Previsto</div>
                            <div className="text-sm">
                              {(r.expectedDeliveryFrom ? r.expectedDeliveryFrom.slice(0, 10) : "—") +
                                " → " +
                                (r.expectedDeliveryTo ? r.expectedDeliveryTo.slice(0, 10) : "—")}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs text-muted-foreground">Assinatura</div>
                            {r.signedAt ? (
                              <div className="text-sm">
                                <span className="font-medium">{r.signedByName || r.signedBy?.name || "—"}</span>
                                <span className="text-muted-foreground"> • {new Date(r.signedAt).toLocaleString()}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Por assinar</div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditModal(r)}
                            disabled={Boolean(r.signedAt) || (!isAdmin && r.userId !== user?.id)}
                            title={r.signedAt ? "Assinada — anule a assinatura para editar" : "Editar"}
                            aria-label="Editar"
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
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
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block w-full overflow-x-auto">
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
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEditModal(r)}
                                  disabled={Boolean(r.signedAt) || (!isAdmin && r.userId !== user?.id)}
                                  title={r.signedAt ? "Assinada — anule a assinatura para editar" : "Editar"}
                                  aria-label="Editar"
                                >
                                  <PenLine className="h-4 w-4" />
                                </Button>
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
                </>
              )}

            </CardContent>
          </Card>

          <Dialog
            open={createOpen}
            onOpenChange={(o) => {
              setCreateOpen(o);
              if (!o) setEditRequestId(null);
            }}
          >
            <DialogContent className="w-[96vw] max-w-[1200px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle>{editRequestId ? "Editar requisição" : "Nova requisição"}</DialogTitle>
                <DialogDescription>
                  {editRequestId
                    ? "Atualize os dados e os itens. (Só é possível antes de assinar.)"
                    : "Preencha os dados e adicione pelo menos um item."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {isAdmin && !editRequestId ? (
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
                  <select
                    value={requestingServiceId}
                    onChange={(e) => setRequestingServiceId(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  >
                    <option value="" disabled>
                      Selecionar serviço...
                    </option>
                    {requestingServices.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.codigo} — {s.designacao}
                      </option>
                    ))}
                  </select>
                  {requestingServices.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Lista de serviços indisponível.</div>
                  ) : null}
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

              <div className="space-y-1">
                <div className="text-sm font-medium">Fundamento do Pedido</div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Escreva o motivo/fundamento do pedido..."
                />
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
                {/* Mobile */}
                <div className="space-y-3 md:hidden">
                  {items.map((it, idx) => (
                    <div key={`item-${idx}`} className="rounded-md border border-border/60 p-3 space-y-2">
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Produto</div>
                        <Select
                          value={it.productId}
                          onValueChange={(v) => {
                            setItems((prev) =>
                              prev.map((p, pIdx) =>
                                pIdx === idx
                                  ? { ...p, productId: v, destination: "" }
                                  : p
                              )
                            );
                            void autoPickUnitForRow(idx, { force: false, productId: v });
                          }}
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
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Qtd</div>
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => {
                              const nextQty = Number(e.target.value);
                              const hasQr = Boolean((it.destination || "").trim());
                              const avail = it.productId ? unitHintByProductId[it.productId]?.availableCount : 0;
                              const isUnitTracked = hasQr || (avail ?? 0) > 0;

                              if (isUnitTracked && nextQty > 1) {
                                toast({
                                  title: "Qtd inválida",
                                  description: "Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade).",
                                  variant: "destructive",
                                });
                                setItems((prev) =>
                                  prev.map((p, pIdx) => (pIdx === idx ? { ...p, quantity: 1 } : p))
                                );
                                return;
                              }

                              setItems((prev) =>
                                prev.map((p, pIdx) =>
                                  pIdx === idx ? { ...p, quantity: nextQty } : p
                                )
                              );
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Unid.</div>
                          <Input
                            placeholder="Ex: caixa / un"
                            value={it.unit || ""}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((p, pIdx) => (pIdx === idx ? { ...p, unit: e.target.value } : p))
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">Referência</div>
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
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">QR</div>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="QR / Código da unidade"
                              value={it.destination || ""}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((p, pIdx) =>
                                    pIdx === idx ? { ...p, destination: e.target.value } : p
                                  )
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!it.productId || Boolean(unitLoadingByRow[idx])}
                              title="Escolher automaticamente um QR disponível"
                              onClick={() => void autoPickUnitForRow(idx, { force: true, productId: it.productId, excludeCode: (it.destination || "").trim() })}
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={!origin || !it.destination?.trim()}
                              title="Ver imagem do QR"
                              onClick={() => {
                                const code = (it.destination || "").trim();
                                if (!code) return;
                                setItemQrCode(code);
                                setItemQrOpen(true);
                              }}
                            >
                              <QrCode className="h-4 w-4" />
                            </Button>
                          </div>
                          {it.productId && unitHintByProductId[it.productId] ? (
                            <div className="text-[11px] text-muted-foreground">
                              Unidades em stock: {unitHintByProductId[it.productId].availableCount}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">Descrição / Observações</div>
                        <Input
                          placeholder="Notas do item"
                          value={it.notes || ""}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((p, pIdx) => (pIdx === idx ? { ...p, notes: e.target.value } : p))
                            )
                          }
                        />
                      </div>

                      <div className="flex justify-end">
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[320px]">Produto</TableHead>
                        <TableHead className="w-[110px]">Qtd</TableHead>
                        <TableHead className="w-[150px]">Unid.</TableHead>
                        <TableHead className="w-[160px]">Referência</TableHead>
                        <TableHead className="w-[180px]">QR</TableHead>
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
                              onValueChange={(v) => {
                                setItems((prev) =>
                                  prev.map((p, pIdx) =>
                                    pIdx === idx
                                      ? { ...p, productId: v, destination: "" }
                                      : p
                                  )
                                );
                                void autoPickUnitForRow(idx, { force: false, productId: v });
                              }}
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
                              onChange={(e) => {
                                const nextQty = Number(e.target.value);
                                const hasQr = Boolean((it.destination || "").trim());
                                const avail = it.productId ? unitHintByProductId[it.productId]?.availableCount : 0;
                                const isUnitTracked = hasQr || (avail ?? 0) > 0;

                                if (isUnitTracked && nextQty > 1) {
                                  toast({
                                    title: "Qtd inválida",
                                    description: "Para produtos com QR (unidades), use linhas separadas (Qtd=1 por unidade).",
                                    variant: "destructive",
                                  });
                                  setItems((prev) =>
                                    prev.map((p, pIdx) => (pIdx === idx ? { ...p, quantity: 1 } : p))
                                  );
                                  return;
                                }

                                setItems((prev) =>
                                  prev.map((p, pIdx) =>
                                    pIdx === idx ? { ...p, quantity: nextQty } : p
                                  )
                                );
                              }}
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
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="QR / Código da unidade"
                                value={it.destination || ""}
                                onChange={(e) =>
                                  setItems((prev) =>
                                    prev.map((p, pIdx) =>
                                      pIdx === idx ? { ...p, destination: e.target.value } : p
                                    )
                                  )
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={!it.productId || Boolean(unitLoadingByRow[idx])}
                                title="Escolher automaticamente um QR disponível"
                                onClick={() => void autoPickUnitForRow(idx, { force: true, productId: it.productId, excludeCode: (it.destination || "").trim() })}
                              >
                                <RefreshCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={!origin || !it.destination?.trim()}
                                title="Ver imagem do QR"
                                onClick={() => {
                                  const code = (it.destination || "").trim();
                                  if (!code) return;
                                  setItemQrCode(code);
                                  setItemQrOpen(true);
                                }}
                              >
                                <QrCode className="h-4 w-4" />
                              </Button>
                            </div>
                            {it.productId && unitHintByProductId[it.productId] ? (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                Unidades em stock: {unitHintByProductId[it.productId].availableCount}
                              </div>
                            ) : null}
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
                </div>

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

              <div className="space-y-2">
                <div>
                  <div className="text-sm font-medium">Fornecedores / Faturas</div>
                  <div className="text-xs text-muted-foreground">
                    Preenchido automaticamente com base no produto selecionado (última fatura encontrada).
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-3 md:hidden">
                  {items.map((it, idx) => {
                    const product = it.productId ? productById.get(it.productId) : undefined;
                    const supplierName = (product as any)?.supplier || "";
                    const meta = it.productId ? invoiceByProductId[it.productId] : null;
                    const isLoadingInv = it.productId ? Boolean(invoiceLoadingByProductId[it.productId]) : false;

                    return (
                      <div key={`sup-m-${idx}`} className="rounded-md border border-border/60 p-3 space-y-2">
                        <div className="text-sm font-medium truncate">
                          {product ? `${(product as any).name} (${(product as any).sku})` : it.productId ? "Produto" : "—"}
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
                                {isLoadingInv ? (
                                  <span className="text-xs text-muted-foreground">a puxar...</span>
                                ) : meta?.invoiceNumber ? (
                                  meta.invoiceId && it.productId ? (
                                    <Button
                                      variant="link"
                                      className="h-auto p-0 font-medium"
                                      onClick={() => {
                                        const q = new URLSearchParams();
                                        q.set("invoiceId", meta.invoiceId);
                                        q.set("tab", "invoices");
                                        if (meta.requestId) q.set("requestId", meta.requestId);
                                        const suffix = q.toString() ? `?${q.toString()}` : "";
                                        router.push(`/products/${it.productId}${suffix}`);
                                      }}
                                      title="Abrir produto e fatura"
                                    >
                                      {meta.invoiceNumber}
                                    </Button>
                                  ) : (
                                    <span className="font-medium">{meta.invoiceNumber}</span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Data</span>
                              <div>{isLoadingInv ? "" : meta?.issuedAt ? formatDatePt(meta.issuedAt) : "—"}</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-xs text-muted-foreground">REQ</span>
                              <div className="font-mono text-xs">{isLoadingInv ? "" : meta?.reqNumber ? meta.reqNumber : "—"}</div>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Data REQ</span>
                              <div>{isLoadingInv ? "" : meta?.reqDate ? formatDatePt(meta.reqDate) : "—"}</div>
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
                      {items.map((it, idx) => {
                        const product = it.productId ? productById.get(it.productId) : undefined;
                        const supplierName = (product as any)?.supplier || "";
                        const meta = it.productId ? invoiceByProductId[it.productId] : null;
                        const isLoadingInv = it.productId ? Boolean(invoiceLoadingByProductId[it.productId]) : false;

                        return (
                          <TableRow key={`sup-${idx}`}>
                            <TableCell className="max-w-[280px] truncate">
                              {product ? `${(product as any).name} (${(product as any).sku})` : it.productId ? "Produto" : "—"}
                            </TableCell>
                            <TableCell className="max-w-[240px] truncate">{supplierName || "—"}</TableCell>
                            <TableCell>
                              {isLoadingInv ? (
                                <span className="text-xs text-muted-foreground">a puxar...</span>
                              ) : meta?.invoiceNumber ? (
                                meta.invoiceId && it.productId ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 font-medium"
                                    onClick={() => {
                                      const q = new URLSearchParams();
                                      q.set("invoiceId", meta.invoiceId);
                                      q.set("tab", "invoices");
                                      if (meta.requestId) q.set("requestId", meta.requestId);
                                      const suffix = q.toString() ? `?${q.toString()}` : "";
                                      router.push(`/products/${it.productId}${suffix}`);
                                    }}
                                    title="Abrir produto e fatura"
                                  >
                                    {meta.invoiceNumber}
                                  </Button>
                                ) : (
                                  meta.invoiceNumber
                                )
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell>
                              {isLoadingInv ? "" : meta?.issuedAt ? formatDatePt(meta.issuedAt) : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {isLoadingInv ? "" : meta?.reqNumber ? meta.reqNumber : "—"}
                            </TableCell>
                            <TableCell>
                              {isLoadingInv ? "" : meta?.reqDate ? formatDatePt(meta.reqDate) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Título (opcional)</div>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditRequestId(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={editRequestId ? updateRequest : createRequest}
                disabled={!canCreate || creating}
              >
                {editRequestId
                  ? creating
                    ? "A guardar..."
                    : "Guardar"
                  : creating
                    ? "A criar..."
                    : "Criar"}
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
                  data={`${origin}/requests/${qrRequest.id}`}
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

        <Dialog
          open={itemQrOpen}
          onOpenChange={(o) => {
            setItemQrOpen(o);
            if (!o) setItemQrCode("");
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>QR • Item</DialogTitle>
              <DialogDescription>{itemQrCode || ""}</DialogDescription>
            </DialogHeader>
            {origin && itemQrCode ? (
              <div className="flex justify-center">
                <QRCodeComponent
                  data={`${origin}/scan/${encodeURIComponent(itemQrCode)}`}
                  title={`QR • ${itemQrCode}`}
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
