"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import axiosInstance from "@/utils/axiosInstance";
import { Badge } from "@/components/ui/badge";
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
  status: "IN_STOCK" | "ACQUIRED" | "IN_REPAIR" | "SCRAPPED" | "LOST";
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
  type: "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";
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

type SessionUser = {
  id: string;
  role: "USER" | "ADMIN";
};

type UnitActionType = "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";

function formatEur(value: number) {
  return value.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function productStatusLabel(status?: string) {
  switch (status) {
    case "Available":
      return "Disponível";
    case "Stock Low":
      return "Stock baixo";
    case "Stock Out":
      return "Sem stock";
    default:
      return status || "—";
  }
}

function unitStatusMeta(status: ProductUnit["status"]) {
  switch (status) {
    case "IN_STOCK":
      return {
        label: "Em stock",
        className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "ACQUIRED":
      return {
        label: "Em uso",
        className: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "IN_REPAIR":
      return {
        label: "Em reparação",
        className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "SCRAPPED":
      return {
        label: "Abatido",
        className: "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
      };
    case "LOST":
      return {
        label: "Perdido",
        className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    default:
      return {
        label: status,
        className: "border-border/70 bg-muted/40 text-muted-foreground",
      };
  }
}

function movementTypeMeta(type: StockMovement["type"]) {
  switch (type) {
    case "IN":
      return { label: "Entrada", className: "text-emerald-700 dark:text-emerald-300" };
    case "OUT":
      return { label: "Saída", className: "text-rose-700 dark:text-rose-300" };
    case "RETURN":
      return { label: "Devolução", className: "text-emerald-700 dark:text-emerald-300" };
    case "REPAIR_OUT":
      return { label: "Enviado reparação", className: "text-amber-700 dark:text-amber-300" };
    case "REPAIR_IN":
      return { label: "Regresso reparação", className: "text-emerald-700 dark:text-emerald-300" };
    case "SCRAP":
      return { label: "Abate", className: "text-zinc-700 dark:text-zinc-300" };
    case "LOST":
      return { label: "Extravio", className: "text-rose-700 dark:text-rose-300" };
    default:
      return { label: type, className: "text-muted-foreground" };
  }
}

function unitActionLabel(action: UnitActionType) {
  switch (action) {
    case "RETURN":
      return "Devolver ao stock";
    case "REPAIR_OUT":
      return "Enviar para reparação";
    case "REPAIR_IN":
      return "Registar regresso da reparação";
    case "SCRAP":
      return "Abater unidade";
    case "LOST":
      return "Marcar como extraviada";
    default:
      return action;
  }
}

function unitActionEndpoint(action: UnitActionType) {
  switch (action) {
    case "RETURN":
      return "/api/units/return";
    case "REPAIR_OUT":
      return "/api/units/repair-out";
    case "REPAIR_IN":
      return "/api/units/repair-in";
    case "SCRAP":
      return "/api/units/scrap";
    case "LOST":
      return "/api/units/lost";
    default:
      return "/api/units/return";
  }
}

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
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) return;
        const data = (await res.json()) as SessionUser;
        if (!cancelled) setSession(data);
      } catch {
        // ignore
      }
    };
    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const [movementsType, setMovementsType] = useState<
    "" | "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST"
  >("");
  const [movementsFrom, setMovementsFrom] = useState("");
  const [movementsTo, setMovementsTo] = useState("");
  const [unitHistories, setUnitHistories] = useState<
    Record<string, { open: boolean; loading: boolean; loaded: boolean; items: StockMovement[] }>
  >({});
  const [unitActionDialog, setUnitActionDialog] = useState<{
    open: boolean;
    unit: ProductUnit | null;
    action: UnitActionType;
    reason: string;
    costCenter: string;
    notes: string;
    saving: boolean;
  }>({
    open: false,
    unit: null,
    action: "RETURN",
    reason: "",
    costCenter: "",
    notes: "",
    saving: false,
  });

  const total = useMemo(() => {
    const q = Number.isFinite(quantity) ? quantity : 0;
    const p = Number.isFinite(unitPrice) ? unitPrice : 0;
    return q * p;
  }, [quantity, unitPrice]);
  const isAdmin = session?.role === "ADMIN";

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

  const unitStatusStats = useMemo(() => {
    const stats: Record<ProductUnit["status"], number> = {
      IN_STOCK: 0,
      ACQUIRED: 0,
      IN_REPAIR: 0,
      SCRAPPED: 0,
      LOST: 0,
    };
    for (const u of units) {
      stats[u.status] += 1;
    }
    return stats;
  }, [units]);

  const movementStats = useMemo(() => {
    return movements.reduce(
      (acc, m) => {
        if (m.type === "IN" || m.type === "RETURN" || m.type === "REPAIR_IN") acc.entries += m.quantity;
        if (m.type === "OUT" || m.type === "REPAIR_OUT" || m.type === "SCRAP" || m.type === "LOST")
          acc.exits += m.quantity;
        if (m.type === "RETURN" || m.type === "REPAIR_OUT" || m.type === "REPAIR_IN" || m.type === "SCRAP" || m.type === "LOST")
          acc.critical += 1;
        return acc;
      },
      { entries: 0, exits: 0, critical: 0 }
    );
  }, [movements]);

  const lastMovementAt = useMemo(() => {
    if (movements.length === 0) return null;
    return new Date(movements[0].createdAt).toLocaleString("pt-PT");
  }, [movements]);

  const criticalMovements = useMemo(
    () =>
      movements
        .filter((m) => m.type === "RETURN" || m.type === "REPAIR_OUT" || m.type === "REPAIR_IN" || m.type === "SCRAP" || m.type === "LOST")
        .slice(0, 10),
    [movements]
  );

  const unitHealth = useMemo(() => {
    const totalLoaded = units.length;
    const pct = (count: number) => (totalLoaded > 0 ? Math.round((count / totalLoaded) * 100) : 0);
    return {
      totalLoaded,
      stockPct: pct(unitStatusStats.IN_STOCK),
      acquiredPct: pct(unitStatusStats.ACQUIRED),
      repairPct: pct(unitStatusStats.IN_REPAIR),
      scrapPct: pct(unitStatusStats.SCRAPPED),
      lostPct: pct(unitStatusStats.LOST),
    };
  }, [units.length, unitStatusStats]);

  const alerts = useMemo(() => {
    const missingIdentity = units.filter((u) => !(u.serialNumber?.trim() || u.assetTag?.trim())).length;
    const list: Array<{ level: "warning" | "critical" | "info"; text: string }> = [];
    if (product?.quantity !== undefined && product.quantity <= 0) {
      list.push({ level: "critical", text: "Produto sem stock disponível para novas saídas." });
    } else if (product?.quantity !== undefined && product.quantity <= 5) {
      list.push({ level: "warning", text: `Stock baixo (${product.quantity} unidade(s) disponíveis).` });
    }
    if (unitStatusStats.IN_REPAIR > 0) {
      list.push({ level: "warning", text: `${unitStatusStats.IN_REPAIR} unidade(s) em reparação.` });
    }
    if (unitStatusStats.SCRAPPED > 0 || unitStatusStats.LOST > 0) {
      list.push({
        level: "critical",
        text: `${unitStatusStats.SCRAPPED} abatida(s) e ${unitStatusStats.LOST} extraviada(s).`,
      });
    }
    if (missingIdentity > 0) {
      list.push({
        level: "info",
        text: `${missingIdentity} unidade(s) sem S/N e sem Asset Tag (recomendado completar).`,
      });
    }
    if (invoices.length === 0) {
      list.push({ level: "info", text: "Ainda não existem faturas associadas a este produto." });
    }
    return list;
  }, [invoices.length, product?.quantity, unitStatusStats, units]);

  const fetchUnitHistory = async (unit: ProductUnit) => {
    setUnitHistories((prev) => ({
      ...prev,
      [unit.id]: { open: true, loading: true, loaded: prev[unit.id]?.loaded ?? false, items: prev[unit.id]?.items ?? [] },
    }));

    try {
      const res = await axiosInstance.get("/stock-movements", {
        params: { unitId: unit.id, limit: 20, asUserId: asUserIdFromQuery || undefined },
      });
      const items: StockMovement[] = res.data?.items ?? [];
      setUnitHistories((prev) => ({
        ...prev,
        [unit.id]: { open: true, loading: false, loaded: true, items },
      }));
    } catch {
      setUnitHistories((prev) => ({
        ...prev,
        [unit.id]: { open: true, loading: false, loaded: true, items: [] },
      }));
      toast({
        title: "Falha ao carregar histórico da unidade",
        description: "Não foi possível obter os últimos movimentos desta unidade.",
        variant: "destructive",
      });
    }
  };

  const toggleUnitHistory = async (unit: ProductUnit) => {
    const current = unitHistories[unit.id];
    if (!current || !current.loaded) {
      await fetchUnitHistory(unit);
      return;
    }
    setUnitHistories((prev) => ({
      ...prev,
      [unit.id]: { ...current, open: !current.open },
    }));
  };

  const openUnitAction = (unit: ProductUnit, action: UnitActionType) => {
    setUnitActionDialog({
      open: true,
      unit,
      action,
      reason: "",
      costCenter: "",
      notes: "",
      saving: false,
    });
  };

  const executeUnitAction = async () => {
    if (!unitActionDialog.unit) return;
    setUnitActionDialog((prev) => ({ ...prev, saving: true }));
    try {
      const endpoint = unitActionEndpoint(unitActionDialog.action);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: unitActionDialog.unit.code,
          asUserId: asUserIdFromQuery || undefined,
          reason: unitActionDialog.reason.trim() || undefined,
          costCenter: unitActionDialog.costCenter.trim() || undefined,
          notes: unitActionDialog.notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Falha ao executar ação");

      toast({
        title: "Ação registada",
        description: `${unitActionLabel(unitActionDialog.action)} concluída para a unidade ${unitActionDialog.unit.code}.`,
      });

      setUnitActionDialog((prev) => ({ ...prev, open: false, saving: false }));
      await Promise.all([loadAll(), loadUnits({ reset: true }), loadMovements({ reset: true })]);
      setUnitHistories({});
    } catch (error: any) {
      toast({
        title: "Erro na ação da unidade",
        description: error?.message || "Não foi possível executar a ação.",
        variant: "destructive",
      });
      setUnitActionDialog((prev) => ({ ...prev, saving: false }));
    }
  };

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
          <>
            <SectionCard
              title="Resumo rápido"
              description="Visão operacional imediata para perceber o estado deste produto."
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Preço unitário</div>
                  <div className="text-2xl font-semibold">{formatEur(product.price)}</div>
                  <div className="mt-1">
                    <Badge variant="outline" className="rounded-full">
                      Estado: {productStatusLabel(product.status)}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Unidades carregadas</div>
                  <div className="text-2xl font-semibold">{units.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Em uso: {unitStatusStats.ACQUIRED} • Em stock: {unitStatusStats.IN_STOCK}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Movimentos (lista atual)</div>
                  <div className="text-2xl font-semibold">{movements.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Entradas: {movementStats.entries} • Saídas: {movementStats.exits}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">Faturas associadas</div>
                  <div className="text-2xl font-semibold">{invoices.length}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Último movimento: {lastMovementAt || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setTab("details")}>Ver detalhes</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("units")}>Ver unidades QR</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("movements")}>Ver movimentos</Button>
                <Button size="sm" variant="outline" onClick={() => setTab("invoices")}>Ver faturas</Button>
              </div>
            </SectionCard>

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
                  <div><span className="font-medium">Preço:</span> {formatEur(product.price)}</div>
                  <div><span className="font-medium">Quantidade:</span> {product.quantity}</div>
                  <div><span className="font-medium">Estado:</span> {productStatusLabel(product.status)}</div>
                  <div><span className="font-medium">Categoria:</span> {product.category || "—"}</div>
                  <div><span className="font-medium">Fornecedor:</span> {product.supplier || "—"}</div>
                  <div><span className="font-medium">Criado em:</span> {new Date(product.createdAt).toLocaleString("pt-PT")}</div>
                  <div><span className="font-medium">Última atualização:</span> {new Date(product.updatedAt).toLocaleString("pt-PT")}</div>
                  <div className="md:col-span-2"><span className="font-medium">Descrição:</span> {product.description?.trim() ? product.description : "—"}</div>
                </div>
              </SectionCard>

              <SectionCard
                title="Estado operacional"
                description="Visão rápida do que está em stock, em uso, em reparação, abatido e perdido."
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Em stock</div>
                    <div className="text-xl font-semibold">{unitStatusStats.IN_STOCK}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Em uso</div>
                    <div className="text-xl font-semibold">{unitStatusStats.ACQUIRED}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Em reparação</div>
                    <div className="text-xl font-semibold">{unitStatusStats.IN_REPAIR}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Abatidos</div>
                    <div className="text-xl font-semibold">{unitStatusStats.SCRAPPED}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-3">
                    <div className="text-xs text-muted-foreground">Perdidos</div>
                    <div className="text-xl font-semibold">{unitStatusStats.LOST}</div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm font-medium">Saúde operacional (%)</div>
                  <div className="space-y-2">
                    {[
                      { label: "Em stock", value: unitHealth.stockPct, bar: "bg-emerald-500/70" },
                      { label: "Em uso", value: unitHealth.acquiredPct, bar: "bg-sky-500/70" },
                      { label: "Em reparação", value: unitHealth.repairPct, bar: "bg-amber-500/70" },
                      { label: "Abatido", value: unitHealth.scrapPct, bar: "bg-zinc-500/70" },
                      { label: "Extraviado", value: unitHealth.lostPct, bar: "bg-rose-500/70" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span>{row.label}</span>
                          <span className="text-muted-foreground">{row.value}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div className={`h-2 rounded-full ${row.bar}`} style={{ width: `${row.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-sm font-medium">Últimos eventos de devolução/reparação/abate</div>
                  {criticalMovements.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem eventos críticos registados para este produto.</div>
                  ) : (
                    <div className="space-y-2">
                      {criticalMovements.map((m) => (
                        <div key={m.id} className="rounded-md border border-border/60 p-2 text-sm">
                          <div className="font-medium">
                            {movementTypeMeta(m.type).label} • {new Date(m.createdAt).toLocaleString("pt-PT")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.unit?.code ? `Unidade: ${m.unit.code} • ` : ""}
                            {m.reason ? `Motivo: ${m.reason}` : "Sem motivo"}
                            {m.assignedTo?.name ? ` • Pessoa: ${m.assignedTo.name}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Alertas e recomendações"
                description="Sinais automáticos para priorizar ações operacionais."
              >
                {alerts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sem alertas neste momento.</div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((a, idx) => (
                      <div
                        key={`${a.level}-${idx}`}
                        className={`rounded-md border p-2 text-sm ${
                          a.level === "critical"
                            ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            : a.level === "warning"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        }`}
                      >
                        {a.text}
                      </div>
                    ))}
                  </div>
                )}
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
                        const meta = unitStatusMeta(u.status);
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
                                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className={`rounded-full border ${meta.className}`}>
                                      {meta.label}
                                    </Badge>
                                    {u.acquiredAt ? ` • ${new Date(u.acquiredAt).toLocaleDateString("pt-PT")}` : ""}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => router.push(`/scan/${u.code}`)}>
                                      Abrir scan
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => toggleUnitHistory(u)}
                                    >
                                      Histórico
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
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {u.status === "ACQUIRED" ? (
                                      <>
                                        <Button variant="outline" size="sm" onClick={() => openUnitAction(u, "RETURN")}>
                                          Devolver
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => openUnitAction(u, "REPAIR_OUT")}>
                                          Reparação
                                        </Button>
                                      </>
                                    ) : null}
                                    {u.status === "IN_REPAIR" ? (
                                      <Button variant="outline" size="sm" onClick={() => openUnitAction(u, "REPAIR_IN")}>
                                        Regressou reparação
                                      </Button>
                                    ) : null}
                                    {isAdmin && u.status !== "SCRAPPED" ? (
                                      <Button variant="outline" size="sm" onClick={() => openUnitAction(u, "SCRAP")}>
                                        Abater
                                      </Button>
                                    ) : null}
                                    {isAdmin && u.status !== "LOST" ? (
                                      <Button variant="outline" size="sm" onClick={() => openUnitAction(u, "LOST")}>
                                        Extravio
                                      </Button>
                                    ) : null}
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
                            {unitHistories[u.id]?.open ? (
                              <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
                                <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                  Histórico da unidade
                                </div>
                                {unitHistories[u.id]?.loading ? (
                                  <div className="text-sm text-muted-foreground">A carregar movimentos…</div>
                                ) : (unitHistories[u.id]?.items?.length ?? 0) === 0 ? (
                                  <div className="text-sm text-muted-foreground">Sem movimentos para esta unidade.</div>
                                ) : (
                                  <div className="space-y-2">
                                    {(unitHistories[u.id]?.items ?? []).map((m) => {
                                      const metaMove = movementTypeMeta(m.type);
                                      return (
                                        <div key={m.id} className="rounded-md border border-border/50 p-2 text-xs">
                                          <div className="flex items-center justify-between gap-2">
                                            <span className={`font-medium ${metaMove.className}`}>{metaMove.label}</span>
                                            <span className="text-muted-foreground">
                                              {new Date(m.createdAt).toLocaleString("pt-PT")}
                                            </span>
                                          </div>
                                          <div className="mt-1 text-muted-foreground">
                                            {m.reason ? `Motivo: ${m.reason}` : "Sem motivo"}
                                            {m.costCenter ? ` • CC: ${m.costCenter}` : ""}
                                            {m.assignedTo?.name ? ` • Pessoa: ${m.assignedTo.name}` : ""}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : null}
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
                      <span className="text-sm text-muted-foreground">Total: {formatEur(total)}</span>
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
                            {inv.quantity} × {formatEur(inv.unitPrice)} = {formatEur(inv.quantity * inv.unitPrice)}
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
                        <option value="IN">Entrada</option>
                        <option value="OUT">Saída</option>
                        <option value="RETURN">Devolução</option>
                        <option value="REPAIR_OUT">Reparação (saída)</option>
                        <option value="REPAIR_IN">Reparação (entrada)</option>
                        <option value="SCRAP">Abate</option>
                        <option value="LOST">Extravio</option>
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
                          const type = movementTypeMeta(m.type);
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
                              <TableCell>
                                <span className={`font-medium ${type.className}`}>{type.label}</span>
                              </TableCell>
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

            <Dialog
              open={unitActionDialog.open}
              onOpenChange={(open) =>
                setUnitActionDialog((prev) => ({ ...prev, open, saving: open ? prev.saving : false }))
              }
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{unitActionLabel(unitActionDialog.action)}</DialogTitle>
                  <DialogDescription>
                    {unitActionDialog.unit
                      ? `Unidade ${unitActionDialog.unit.code}. Esta ação será auditada e refletida no histórico de movimentos.`
                      : "Selecione uma unidade."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Estado atual:{" "}
                    {unitActionDialog.unit ? unitStatusMeta(unitActionDialog.unit.status).label : "—"}
                    {!isAdmin && (unitActionDialog.action === "SCRAP" || unitActionDialog.action === "LOST")
                      ? " • Ação permitida apenas para ADMIN."
                      : ""}
                  </div>
                  <Input
                    placeholder="Motivo (opcional)"
                    value={unitActionDialog.reason}
                    onChange={(e) =>
                      setUnitActionDialog((prev) => ({ ...prev, reason: e.target.value }))
                    }
                  />
                  <Input
                    placeholder="Centro de custo (opcional)"
                    value={unitActionDialog.costCenter}
                    onChange={(e) =>
                      setUnitActionDialog((prev) => ({ ...prev, costCenter: e.target.value }))
                    }
                  />
                  <Textarea
                    placeholder="Notas de auditoria (opcional)"
                    value={unitActionDialog.notes}
                    onChange={(e) =>
                      setUnitActionDialog((prev) => ({ ...prev, notes: e.target.value }))
                    }
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setUnitActionDialog((prev) => ({ ...prev, open: false, saving: false }))
                    }
                    disabled={unitActionDialog.saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={executeUnitAction}
                    disabled={
                      unitActionDialog.saving ||
                      !unitActionDialog.unit ||
                      (!isAdmin &&
                        (unitActionDialog.action === "SCRAP" || unitActionDialog.action === "LOST"))
                    }
                  >
                    {unitActionDialog.saving ? "A executar..." : "Confirmar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
