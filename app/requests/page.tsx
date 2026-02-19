"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/authContext";
import { useProductStore } from "@/app/useProductStore";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
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
import {
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Filter,
  LayoutGrid,
  Paperclip,
  PenLine,
  Plus,
  Printer,
  QrCode,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import type { Product } from "@/app/types";
import Papa from "papaparse";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
type AvailableUnitDto = { id: string; code: string };

type RequestItemDto = {
  id: string;
  productId: string;
  quantity: number;
  role?: "NORMAL" | "OLD" | "NEW";
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
type RequestingServiceUserDto = {
  id: string;
  name: string;
  email: string;
  requestingServiceId: number | null;
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
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  dueAt?: string | null;
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
  pickupSignedAt?: string | null;
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

const needsRestockSignatureBadge = (r: Pick<RequestDto, "requestType" | "status" | "pickupSignedAt">) =>
  r.requestType === "RETURN" &&
  r.status !== "FULFILLED" &&
  r.status !== "REJECTED" &&
  !r.pickupSignedAt;

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

const priorityMeta = (p?: "LOW" | "NORMAL" | "HIGH" | "URGENT") => {
  switch (p) {
    case "LOW":
      return { label: "Baixa", className: "bg-slate-500/10 text-slate-700 border-slate-500/20" };
    case "HIGH":
      return { label: "Alta", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" };
    case "URGENT":
      return { label: "Urgente", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" };
    default:
      return { label: "Normal", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" };
  }
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
  role?: "NORMAL" | "OLD" | "NEW";
  unit?: string;
  reference?: string;
  destination?: string;
  notes?: string;
};

type RequestMode = "STANDARD" | "RETURN";

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

  const [requests, setRequests] = useState<RequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | RequestDto["status"]>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "LOW" | "NORMAL" | "HIGH" | "URGENT">("ALL");
  const [personFilter, setPersonFilter] = useState<string>("ALL");
  const [serviceFilter, setServiceFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isMobile, setIsMobile] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode("cards");
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrRequest, setQrRequest] = useState<RequestDto | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardSubmitted, setWizardSubmitted] = useState(false);
  const [wizardSuccess, setWizardSuccess] = useState(false);
  const [productSearchByRow, setProductSearchByRow] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!searchParams) return;
    const open = searchParams.get("openCreate");
    if (open === "1" || open === "true") {
      setCreateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [requestedAt, setRequestedAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [requestMode, setRequestMode] = useState<RequestMode>("STANDARD");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [dueAt, setDueAt] = useState<string>("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const [requestingServices, setRequestingServices] = useState<RequestingServiceDto[]>([]);
  const [requestingServiceId, setRequestingServiceId] = useState<string>("");
  const [requestingServiceUsers, setRequestingServiceUsers] = useState<RequestingServiceUserDto[]>([]);
  const [requestingServiceUsersLoading, setRequestingServiceUsersLoading] = useState(false);
  const [requesterPickerOpen, setRequesterPickerOpen] = useState(false);
  const [selectedRequesterUserId, setSelectedRequesterUserId] = useState<string>("");
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
  const [returnOldItems, setReturnOldItems] = useState<NewRequestItem[]>([
    { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
  ]);
  const [returnNewItems, setReturnNewItems] = useState<NewRequestItem[]>([
    { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
  ]);

  const resetForm = () => {
    setRequestedAt(toDatetimeLocalValue(new Date()));
    setRequestMode("STANDARD");
    setPriority("NORMAL");
    setDueAt("");
    setTitle("");
    setNotes("");
    setRequestingServiceId(user?.requestingServiceId ? String(user.requestingServiceId) : "");
    setSelectedRequesterUserId("");
    setRequesterPickerOpen(false);
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
    setReturnOldItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
    setReturnNewItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
    setInvoiceByProductId({});
    setInvoiceLoadingByProductId({});
    setUnitHintByProductId({});
    setUnitLoadingByRow({});
    setProductSearchByRow({});
    setWizardStep(1);
    setWizardSubmitted(false);
    setWizardSuccess(false);
  };

  const openCreateModal = (mode: RequestMode = "STANDARD") => {
    setEditRequestId(null);
    resetForm();
    setRequestMode(mode);
    setWizardStep(1);
    setCreateOpen(true);
  };

  const splitReturnItemsFromRequest = (rawItems: RequestItemDto[]) => {
    const old: NewRequestItem[] = [];
    const next: NewRequestItem[] = [];
    const normal: NewRequestItem[] = [];

    for (const it of rawItems) {
      const mapped: NewRequestItem = {
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.unit ?? "",
        reference: it.reference ?? "",
        destination: it.destination ?? "",
        notes: it.notes ?? "",
      };

      if (it.role === "OLD") {
        old.push(mapped);
      } else if (it.role === "NEW") {
        next.push(mapped);
      } else {
        normal.push(mapped);
      }
    }

    return { old, next, normal };
  };

  const openEditModal = (r: RequestDto) => {
    if (!r?.id) return;
    setEditRequestId(r.id);

    setRequestedAt(toDatetimeLocalValue(new Date(r.requestedAt)));
    setPriority(r.priority || "NORMAL");
    setDueAt(r.dueAt ? String(r.dueAt).slice(0, 10) : "");
    setTitle(r.title ?? "");
    setNotes(r.notes ?? "");
    setRequestingServiceId(r.requestingServiceId ? String(r.requestingServiceId) : "");
    setSelectedRequesterUserId("");
    setRequesterPickerOpen(false);
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

    const incomingItems = Array.isArray(r.items) ? r.items : [];
    const split = splitReturnItemsFromRequest(incomingItems);
    const isReturn = r.requestType === "RETURN";
    setRequestMode(isReturn ? "RETURN" : "STANDARD");
    setItems(
      (isReturn ? split.normal : incomingItems).map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unit: it.unit ?? "",
        reference: it.reference ?? "",
        destination: it.destination ?? "",
        notes: it.notes ?? "",
      }))
    );
    setReturnOldItems(split.old.length ? split.old : [{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
    setReturnNewItems(split.next.length ? split.next : [{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
    setProductSearchByRow({});
    setWizardStep(1);
    setWizardSubmitted(false);
    setWizardSuccess(false);

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
    const activeItems =
      requestMode === "RETURN"
        ? [...returnOldItems, ...returnNewItems]
        : items;
    const uniqueProductIds = Array.from(
      new Set(activeItems.map((it) => it.productId).filter((id) => Boolean(id)))
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
  }, [items, requestMode, returnNewItems, returnOldItems, unitHintByProductId]);

  useEffect(() => {
    const activeItems =
      requestMode === "RETURN"
        ? [...returnOldItems, ...returnNewItems]
        : items;
    const uniqueProductIds = Array.from(
      new Set(activeItems.map((it) => it.productId).filter((id) => Boolean(id)))
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
  }, [items, requestMode, returnNewItems, returnOldItems]);

  const canCreate = useMemo(() => {
    const validStandard = items.length > 0
      && items.every((it) => Boolean(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
    const validReturnOld = returnOldItems.length > 0
      && returnOldItems.every((it) => Boolean(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
    const validReturnNew = returnNewItems.length > 0
      && returnNewItems.every((it) => Boolean(it.productId) && Number.isFinite(it.quantity) && it.quantity > 0);
    const hasAtLeastOneItem = requestMode === "RETURN" ? validReturnOld && validReturnNew : validStandard;
    const allValid = hasAtLeastOneItem;
    const hasRequestingService = Boolean(requestingServiceId);
    return hasAtLeastOneItem && allValid && hasRequestingService;
  }, [items, requestMode, requestingServiceId, returnNewItems, returnOldItems]);

  const wizardSteps = [
    { id: 1 as const, label: "Informação Básica" },
    { id: 2 as const, label: "Detalhes" },
    { id: 3 as const, label: "Itens" },
    { id: 4 as const, label: "Rever" },
  ];

  const productOptions = useMemo(
    () => allProducts.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [allProducts]
  );

  const deliverySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          requests
            .map((r) => (r.deliveryLocation || "").trim())
            .filter((v) => Boolean(v))
        )
      ).slice(0, 12),
    [requests]
  );

  const isWizardStepValid = (step: 1 | 2 | 3 | 4) => {
    if (step === 1) {
      const requestedAtDate = requestedAt ? new Date(requestedAt) : new Date();
      return Boolean(requestingServiceId) && !Number.isNaN(requestedAtDate.getTime());
    }
    if (step === 2) {
      return Boolean(requesterName.trim());
    }
    if (step === 3) {
      if (requestMode === "RETURN") {
        return returnOldItems.length > 0
          && returnNewItems.length > 0
          && returnOldItems.every((it) => Boolean(it.productId) && Number(it.quantity) > 0)
          && returnNewItems.every((it) => Boolean(it.productId) && Number(it.quantity) > 0);
      }
      return items.length > 0 && items.every((it) => Boolean(it.productId) && Number(it.quantity) > 0);
    }
    return true;
  };

  const goNextStep = () => {
    setWizardSubmitted(true);
    if (!isWizardStepValid(wizardStep)) return;
    setWizardSubmitted(false);
    setWizardStep((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 3;
      if (prev === 3) return 4;
      return 4;
    });
  };

  const goPrevStep = () => {
    setWizardSubmitted(false);
    setWizardStep((prev) => {
      if (prev === 4) return 3;
      if (prev === 3) return 2;
      if (prev === 2) return 1;
      return 1;
    });
  };

  const loadAll = useCallback(async () => {
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
  }, [isLoggedIn, loadProducts, toast]);

  const changeRequestStatus = async (
    requestId: string,
    nextStatus: RequestDto["status"]
  ) => {
    try {
      const res = await axiosInstance.patch(`/requests/${requestId}`, { status: nextStatus });
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.data : r)));
      toast({ title: "Estado atualizado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar o estado.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
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

    (async () => {
      try {
        const res = await axiosInstance.get("/requesting-services");
        setRequestingServices(res.data || []);
      } catch {
        setRequestingServices([]);
      }
    })();

    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin, loadAll]);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;
    const es = new EventSource("/api/realtime/stream");
    const reload = () => {
      void loadAll();
    };
    es.addEventListener("request.created", reload);
    es.addEventListener("request.updated", reload);
    es.addEventListener("request.status_changed", reload);
    es.addEventListener("public-request.accepted", reload);
    return () => {
      es.removeEventListener("request.created", reload);
      es.removeEventListener("request.updated", reload);
      es.removeEventListener("request.status_changed", reload);
      es.removeEventListener("public-request.accepted", reload);
      es.close();
    };
  }, [isAuthLoading, isLoggedIn, loadAll]);

  useEffect(() => {
    if (isAuthLoading || !isLoggedIn) return;

    const serviceId = Number(requestingServiceId);
    if (!Number.isFinite(serviceId) || serviceId <= 0) {
      setRequestingServiceUsers([]);
      setRequestingServiceUsersLoading(false);
      return;
    }

    let alive = true;
    setRequestingServiceUsersLoading(true);
    (async () => {
      try {
        const res = await axiosInstance.get("/requesting-services/users", {
          params: { requestingServiceId: serviceId },
        });
        if (!alive) return;
        setRequestingServiceUsers(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!alive) return;
        setRequestingServiceUsers([]);
      } finally {
        if (!alive) return;
        setRequestingServiceUsersLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthLoading, isLoggedIn, requestingServiceId]);

  useEffect(() => {
    if (!requestingServiceUsers.length) {
      if (selectedRequesterUserId) setSelectedRequesterUserId("");
      return;
    }

    const email = requesterEmployeeNo.trim().toLowerCase();
    const name = requesterName.trim().toLowerCase();
    const matched = requestingServiceUsers.find((u) => {
      if (email) return u.email.toLowerCase() === email;
      return name ? u.name.toLowerCase() === name : false;
    });

    if (matched?.id && matched.id !== selectedRequesterUserId) {
      setSelectedRequesterUserId(matched.id);
    }
  }, [requesterEmployeeNo, requesterName, requestingServiceUsers, selectedRequesterUserId]);

  const selectedRequesterUser = useMemo(
    () => requestingServiceUsers.find((u) => u.id === selectedRequesterUserId) ?? null,
    [requestingServiceUsers, selectedRequesterUserId]
  );

  const selectedRequesterLabel = useMemo(() => {
    if (selectedRequesterUser) {
      return `${selectedRequesterUser.name} (${selectedRequesterUser.email})`;
    }
    if (requesterName.trim()) {
      return requesterEmployeeNo.trim()
        ? `${requesterName.trim()} (${requesterEmployeeNo.trim()})`
        : requesterName.trim();
    }
    return "Selecionar funcionário";
  }, [requesterEmployeeNo, requesterName, selectedRequesterUser]);

  const buildItemsForSubmit = () => {
    if (requestMode === "RETURN") {
      return [
        ...returnOldItems.map((it) => ({ ...it, role: "OLD" as const })),
        ...returnNewItems.map((it) => ({ ...it, role: "NEW" as const })),
      ];
    }
    return items.map((it) => ({ ...it, role: "NORMAL" as const }));
  };

  const createRequest = async () => {
    if (!canCreate) return;
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
      const submitItems = buildItemsForSubmit();

      const supplierNamesOrdered = Array.from(
        new Set(
          submitItems
            .map((it) => (it.productId ? (productById.get(it.productId) as any)?.supplier : undefined))
            .filter((s): s is string => Boolean(s))
        )
      );

      const supplierOption1 = supplierNamesOrdered[0];
      const supplierOption2 = supplierNamesOrdered[1];
      const supplierOption3 = supplierNamesOrdered[2];

      const payload = {
        requestType: requestMode,
        requestedAt: requestedAtIso,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
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
        items: submitItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unit: it.unit?.trim() ? it.unit.trim() : undefined,
          reference: it.reference?.trim() ? it.reference.trim() : undefined,
          destination: it.destination?.trim() ? it.destination.trim() : undefined,
          notes: it.notes?.trim() ? it.notes.trim() : undefined,
          role: it.role,
        })),
      };
      const res = await axiosInstance.post("/requests", payload);
      setRequests((prev) => [res.data, ...prev]);

      setRequestedAt(toDatetimeLocalValue(new Date()));
      setPriority("NORMAL");
      setDueAt("");
      setTitle("");
      setNotes("");
      setRequestingServiceId("");
      setSelectedRequesterUserId("");
      setRequesterPickerOpen(false);
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
      setReturnOldItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
      setReturnNewItems([{ productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" }]);
      setInvoiceByProductId({});
      setInvoiceLoadingByProductId({});

      setWizardSuccess(true);
      setTimeout(() => {
        setCreateOpen(false);
        setEditRequestId(null);
        setWizardSuccess(false);
      }, 900);

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
      const submitItems = buildItemsForSubmit();

      const supplierNamesOrdered = Array.from(
        new Set(
          submitItems
            .map((it) => (it.productId ? (productById.get(it.productId) as any)?.supplier : undefined))
            .filter((s): s is string => Boolean(s))
        )
      );

      const supplierOption1 = supplierNamesOrdered[0] || null;
      const supplierOption2 = supplierNamesOrdered[1] || null;
      const supplierOption3 = supplierNamesOrdered[2] || null;

      const payload = {
        requestType: requestMode,
        requestedAt: requestedAtDate.toISOString(),
        requestingServiceId: serviceId,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
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
        replaceItems: submitItems.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unit: it.unit?.trim() ? it.unit.trim() : null,
          reference: it.reference?.trim() ? it.reference.trim() : null,
          destination: it.destination?.trim() ? it.destination.trim() : null,
          notes: it.notes?.trim() ? it.notes.trim() : null,
          role: it.role,
        })),
      };

      await axiosInstance.patch(`/requests/${editRequestId}`, payload);

      setWizardSuccess(true);
      setTimeout(() => {
        setCreateOpen(false);
        setEditRequestId(null);
        resetForm();
        setWizardSuccess(false);
      }, 900);
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

  const personOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of requests) {
      const person = r.requesterName || r.user?.name;
      if (person) {
        map.set(person, person);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt"));
  }, [requests]);

  const serviceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of requests) {
      if (r.requestingService) {
        map.set(r.requestingService, r.requestingService);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt"));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && (r.priority || "NORMAL") !== priorityFilter) return false;
      if (personFilter !== "ALL" && (r.requesterName || r.user?.name || "") !== personFilter) return false;
      if (serviceFilter !== "ALL" && (r.requestingService || "") !== serviceFilter) return false;

      const requestedDate = new Date(r.requestedAt);
      if (dateFrom) {
        const from = new Date(`${dateFrom}T00:00:00`);
        if (requestedDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(`${dateTo}T23:59:59`);
        if (requestedDate > to) return false;
      }

      if (!q) return true;
      const haystack = [
        r.gtmiNumber,
        r.title || "",
        r.requesterName || "",
        r.requestingService || "",
        r.user?.name || "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [
    requests,
    search,
    statusFilter,
    priorityFilter,
    personFilter,
    serviceFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    setPageIndex(0);
  }, [search, statusFilter, priorityFilter, personFilter, serviceFilter, dateFrom, dateTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = safePageIndex * pageSize;
  const visibleRequests = filteredRequests.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    if (pageIndex !== safePageIndex) {
      setPageIndex(safePageIndex);
    }
  }, [pageIndex, safePageIndex]);

  useEffect(() => {
    const allowed = new Set(filteredRequests.map((r) => r.id));
    setSelectedRequestIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredRequests]);

  const exportCsv = () => {
    const rows = filteredRequests.map((r) => ({
      gtmi: r.gtmiNumber,
      estado: r.status,
      pedido: r.title || "",
      servico: r.requestingService || "",
      requerente: r.requesterName || "",
      prioridade: (r as any).priority || "NORMAL",
      prazo: (r as any).dueAt || "",
      dataPedido: r.requestedAt,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `requests-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "DRAFT" || r.status === "SUBMITTED").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const fulfilled = requests.filter((r) => r.status === "FULFILLED").length;
    return { total, pending, approved, fulfilled };
  }, [requests]);

  const activeFiltersCount = useMemo(() => {
    return Number(statusFilter !== "ALL")
      + Number(priorityFilter !== "ALL")
      + Number(personFilter !== "ALL")
      + Number(serviceFilter !== "ALL")
      + Number(Boolean(dateFrom || dateTo));
  }, [statusFilter, priorityFilter, personFilter, serviceFilter, dateFrom, dateTo]);

  const clearAdvancedFilters = () => {
    setStatusFilter("ALL");
    setPriorityFilter("ALL");
    setPersonFilter("ALL");
    setServiceFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const selectedSet = useMemo(() => new Set(selectedRequestIds), [selectedRequestIds]);
  const allPageSelected =
    visibleRequests.length > 0 && visibleRequests.every((r) => selectedSet.has(r.id));

  const toggleSelectAllPage = (checked: boolean) => {
    if (!checked) {
      const pageIds = new Set(visibleRequests.map((r) => r.id));
      setSelectedRequestIds((prev) => prev.filter((id) => !pageIds.has(id)));
      return;
    }
    setSelectedRequestIds((prev) => Array.from(new Set([...prev, ...visibleRequests.map((r) => r.id)])));
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedRequestIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  };

  const exportSelectedCsv = () => {
    const selectedRows = filteredRequests.filter((r) => selectedSet.has(r.id));
    const rows = selectedRows.map((r) => ({
      gtmi: r.gtmiNumber,
      estado: r.status,
      pedido: r.title || "",
      servico: r.requestingService || "",
      requerente: r.requesterName || "",
      prioridade: (r as any).priority || "NORMAL",
      prazo: (r as any).dueAt || "",
      dataPedido: r.requestedAt,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `requests-selected-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pageWindow = useMemo(() => {
    const current = safePageIndex + 1;
    const from = Math.max(1, current - 2);
    const to = Math.min(totalPages, current + 2);
    const arr: number[] = [];
    for (let i = from; i <= to; i += 1) arr.push(i);
    return arr;
  }, [safePageIndex, totalPages]);

  const renderItemSection = (
    sectionTitle: string,
    sectionTone: "old" | "new" | "normal",
    list: NewRequestItem[],
    setList: Dispatch<SetStateAction<NewRequestItem[]>>
  ) => (
    <div className={`space-y-3 rounded-2xl border p-3 ${sectionTone === "old" ? "border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10" : sectionTone === "new" ? "border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/10" : "border-border/60 bg-[hsl(var(--surface-1)/0.8)]"}`}>
      <div className="text-sm font-semibold">{sectionTitle}</div>
      {list.map((it, idx) => {
        const rowKey = `${sectionTitle}-${idx}`;
        const filteredProducts = productOptions.filter((p) => {
          const q = (productSearchByRow[rowKey] || "").trim().toLowerCase();
          if (!q) return true;
          return `${p.name} ${p.sku}`.toLowerCase().includes(q);
        });
        return (
          <article key={`${sectionTitle}-${idx}`} className={`rounded-2xl border p-4 shadow-sm ${wizardSubmitted && (!it.productId || it.quantity <= 0) ? "border-rose-400" : "border-border/60"} bg-[hsl(var(--surface-1)/0.8)]`}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs text-muted-foreground">Produto</div>
                <Input
                  placeholder="Pesquisar produto..."
                  value={productSearchByRow[rowKey] || ""}
                  onChange={(e) => setProductSearchByRow((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                  className="h-10 rounded-xl"
                />
                <Select
                  value={it.productId}
                  onValueChange={(v) => {
                    const selected = productOptions.find((p) => p.id === v);
                    setProductSearchByRow((prev) => ({ ...prev, [rowKey]: selected ? `${selected.name} (${selected.sku})` : "" }));
                    setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, productId: v, destination: "" } : p)));
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Selecionar produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProducts.slice(0, 120).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Quantidade</div>
                <Input type="number" min={1} value={it.quantity} onChange={(e) => setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, quantity: Number(e.target.value) } : p)))} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Unidade</div>
                <Input value={it.unit || ""} onChange={(e) => setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, unit: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Ex: un" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Referência</div>
                <Input value={it.reference || ""} onChange={(e) => setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, reference: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Ref / Nº série" />
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">QR / Código unidade</div>
                <Input value={it.destination || ""} onChange={(e) => setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, destination: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Código QR" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs text-muted-foreground">Notas</div>
                <Input value={it.notes || ""} onChange={(e) => setList((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, notes: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Observações" />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" variant="ghost" size="sm" className="rounded-lg text-rose-600" disabled={list.length <= 1} onClick={() => setList((prev) => prev.filter((_, i) => i !== idx))}>
                <Trash2 className="mr-1 h-4 w-4" />
                Remover
              </Button>
            </div>
          </article>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-xl"
        onClick={() =>
          setList((prev) => [
            ...prev,
            { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" />
        Adicionar item
      </Button>
    </div>
  );


  return (
    <AuthenticatedLayout>
      <div className="space-y-5">
        <div className="glass-panel sticky top-3 z-30 rounded-2xl p-3">
          <div className="flex items-center gap-2">
            <div className="hidden min-w-[180px] items-center gap-2 rounded-full border border-border/70 bg-[hsl(var(--surface-2)/0.7)] px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
              <WandSparkles className="h-3.5 w-3.5 text-primary" />
              Requests Hub
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-[hsl(var(--surface-1)/0.85)] px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisa global: GTMI, pessoa, serviço..."
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full px-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <span className="hidden sm:inline">{user?.name || "Conta"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-panel">
                <DropdownMenuLabel>Conta</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => router.push("/users")}>Perfil</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" className="hidden rounded-xl md:inline-flex">
              <WandSparkles className="h-4 w-4" />
              Ações rápidas
            </Button>
          </div>
        </div>

        <section className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Requisições</h1>
              <p className="text-sm text-muted-foreground">
                Gestão de pedidos de reposição e compras
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Button
                onClick={() => openCreateModal("STANDARD")}
                className="h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Nova Requisição
              </Button>
              <Button
                onClick={() => openCreateModal("RETURN")}
                variant="outline"
                className="h-11 rounded-2xl"
              >
                <Plus className="h-4 w-4" />
                Requisição Devolução
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={loading || filteredRequests.length === 0} className="h-11 rounded-2xl">
                Exportar CSV
              </Button>
              <Button variant="outline" onClick={() => loadAll()} disabled={loading} className="h-11 rounded-2xl">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total Requisições", value: metrics.total, tone: "text-primary", pct: "+5.2%" },
            { label: "Pendentes", value: metrics.pending, tone: "text-amber-600", pct: "+2.0%" },
            { label: "Aprovadas", value: metrics.approved, tone: "text-emerald-600", pct: "+1.3%" },
            { label: "Concluídas", value: metrics.fulfilled, tone: "text-indigo-600", pct: "+4.4%" },
          ].map((card, idx) => (
            <article key={idx} className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4 shadow-sm">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{card.label}</div>
              <div className={`mt-1 text-3xl font-semibold ${card.tone}`}>{card.value}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                  style={{ width: `${Math.max(15, Math.min(100, (card.value / Math.max(1, metrics.total)) * 100))}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{card.pct} nos últimos 30 dias</div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
              >
                <Filter className="h-4 w-4" />
                Filtros avançados
                <Badge variant="secondary" className="rounded-full">{activeFiltersCount}</Badge>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`} />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl md:hidden"
                onClick={() => setFilterSheetOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-border/70 bg-[hsl(var(--surface-2)/0.72)] p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`rounded-full px-3 py-1 text-xs ${viewMode === "table" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                >
                  <Table2 className="mr-1 inline h-3.5 w-3.5" />
                  Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`rounded-full px-3 py-1 text-xs ${viewMode === "cards" ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                >
                  <LayoutGrid className="mr-1 inline h-3.5 w-3.5" />
                  Cards
                </button>
              </div>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-10 w-[94px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  {[6, 10, 20, 30].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showAdvancedFilters ? (
            <div className="mt-4 grid gap-3 lg:grid-cols-5">
              <div className="space-y-2 lg:col-span-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Estado</div>
                <div className="flex h-11 items-center gap-1 rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.7)] p-1">
                  {[
                    ["ALL", "Todos"],
                    ["SUBMITTED", "Submetidas"],
                    ["APPROVED", "Aprovadas"],
                    ["FULFILLED", "Concluídas"],
                    ["REJECTED", "Rejeitadas"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value as any)}
                      className={`h-full flex-1 rounded-lg text-xs ${statusFilter === value ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Prioridade</div>
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-panel">
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="LOW">Baixa</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pessoa</div>
                <Select value={personFilter} onValueChange={setPersonFilter}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-panel">
                    <SelectItem value="ALL">Todas</SelectItem>
                    {personOptions.map((person) => (
                      <SelectItem key={person} value={person}>{person}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Serviço</div>
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-panel">
                    <SelectItem value="ALL">Todos</SelectItem>
                    {serviceOptions.map((service) => (
                      <SelectItem key={service} value={service}>{service}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Data pedido</div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 rounded-xl" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>

              <div className="flex items-end">
                <Button variant="ghost" className="h-11 rounded-xl" onClick={clearAdvancedFilters}>
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted/60" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-[hsl(var(--surface-1)/0.7)] p-10 text-center">
              <CalendarRange className="mx-auto mb-3 h-8 w-8 text-primary" />
              <div className="text-lg font-semibold">Sem requisições</div>
              <div className="text-sm text-muted-foreground">Ajusta os filtros ou cria uma nova requisição.</div>
            </div>
          ) : viewMode === "cards" || isMobile ? (
            <div className="space-y-3">
              {visibleRequests.map((r) => (
                <details key={r.id} className={`rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.75)] p-4 shadow-sm ${focusId === r.id ? "border-primary/50" : ""}`}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedSet.has(r.id)}
                          onCheckedChange={(v) => toggleSelectOne(r.id, Boolean(v))}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="font-semibold">{r.gtmiNumber}</span>
                        <Badge variant="outline" className={formatStatus(r.status).className}>{formatStatus(r.status).label}</Badge>
                        {needsRestockSignatureBadge(r) ? (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            Aguarda assinatura para repor stock
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.requesterName || r.user?.name || "—"} • {r.requestingService || "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={priorityMeta(r.priority).className}>{priorityMeta(r.priority).label}</Badge>
                      <span className="text-xs text-muted-foreground">{r.dueAt ? new Date(r.dueAt).toLocaleDateString("pt-PT") : "Sem prazo"}</span>
                    </div>
                  </summary>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Pedido:</span> {new Date(r.requestedAt).toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Itens:</span> {r.items?.length || 0}</div>
                    <div><span className="text-muted-foreground">Previsto:</span> {(r.expectedDeliveryFrom ? r.expectedDeliveryFrom.slice(0, 10) : "—")} → {(r.expectedDeliveryTo ? r.expectedDeliveryTo.slice(0, 10) : "—")}</div>
                    <div><span className="text-muted-foreground">Assinatura:</span> {r.signedAt ? "Assinada" : "Por assinar"}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-1">
                    <Button variant="outline" size="icon" className="rounded-xl" onClick={() => openEditModal(r)} disabled={Boolean(r.signedAt) || (!isAdmin && r.userId !== user?.id)}><PenLine className="h-4 w-4" /></Button>
                    <AttachmentsDialog
                      kind="REQUEST"
                      requestId={r.id}
                      title={`Anexos • ${r.gtmiNumber}`}
                      description="Ficheiros ligados a esta requisição."
                      trigger={<Button variant="outline" size="icon" className="rounded-xl"><Paperclip className="h-4 w-4" /></Button>}
                    />
                    <Button variant="outline" size="icon" className="rounded-xl" onClick={() => printRequest(r)}><Printer className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="rounded-xl" onClick={() => openQr(r)} disabled={!origin}><QrCode className="h-4 w-4" /></Button>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className="overflow-auto rounded-2xl border border-border/70">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--surface-2)/0.95)] backdrop-blur">
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allPageSelected} onCheckedChange={(v) => toggleSelectAllPage(Boolean(v))} />
                    </TableHead>
                    <TableHead>Nº</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRequests.map((r) => (
                    <TableRow key={r.id} className={focusId === r.id ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox checked={selectedSet.has(r.id)} onCheckedChange={(v) => toggleSelectOne(r.id, Boolean(v))} />
                      </TableCell>
                      <TableCell>
                        <Button variant="link" className="h-auto p-0 font-semibold" onClick={() => openDetails(r)}>
                          {r.gtmiNumber}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <div className="space-y-1">
                            <Select value={r.status} onValueChange={(v) => changeRequestStatus(r.id, v as RequestDto["status"])}>
                              <SelectTrigger className="h-8 w-[170px] rounded-lg">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="glass-panel">
                                <SelectItem value="DRAFT">Rascunho</SelectItem>
                                <SelectItem value="SUBMITTED">Submetida</SelectItem>
                                <SelectItem value="APPROVED">Aprovada</SelectItem>
                                <SelectItem value="REJECTED">Rejeitada</SelectItem>
                                <SelectItem value="FULFILLED">Cumprida</SelectItem>
                              </SelectContent>
                            </Select>
                            {needsRestockSignatureBadge(r) ? (
                              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Aguarda assinatura para repor stock
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="outline" className={formatStatus(r.status).className}>{formatStatus(r.status).label}</Badge>
                            {needsRestockSignatureBadge(r) ? (
                              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                Aguarda assinatura para repor stock
                              </Badge>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={priorityMeta(r.priority).className}>{priorityMeta(r.priority).label}</Badge>
                      </TableCell>
                      <TableCell>{r.requesterName || r.user?.name || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate" title={r.requestingService || ""}>{r.requestingService || "—"}</TableCell>
                      <TableCell>{r.dueAt ? new Date(r.dueAt).toLocaleDateString("pt-PT") : "—"}</TableCell>
                      <TableCell>{r.items?.length || 0}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => openEditModal(r)} disabled={Boolean(r.signedAt) || (!isAdmin && r.userId !== user?.id)}><PenLine className="h-4 w-4" /></Button>
                          <AttachmentsDialog
                            kind="REQUEST"
                            requestId={r.id}
                            title={`Anexos • ${r.gtmiNumber}`}
                            description="Ficheiros ligados a esta requisição."
                            trigger={<Button variant="outline" size="icon" className="rounded-xl"><Paperclip className="h-4 w-4" /></Button>}
                          />
                          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => printRequest(r)}><Printer className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="rounded-xl" onClick={() => openQr(r)} disabled={!origin}><QrCode className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-sm text-muted-foreground">
              A mostrar {filteredRequests.length === 0 ? 0 : pageStart + 1}-{Math.min(filteredRequests.length, pageStart + pageSize)} de {filteredRequests.length}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="rounded-full" disabled={safePageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {pageWindow.map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setPageIndex(page - 1)}
                  className={`h-8 min-w-8 rounded-full px-2 text-sm ${page === safePageIndex + 1 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/70"}`}
                >
                  {page}
                </button>
              ))}
              <Button variant="ghost" size="icon" className="rounded-full" disabled={safePageIndex >= totalPages - 1} onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        <Dialog open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6 sm:hidden">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
              <DialogDescription>Ajuste rápido no mobile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="SUBMITTED">Submetida</SelectItem>
                  <SelectItem value="APPROVED">Aprovada</SelectItem>
                  <SelectItem value="REJECTED">Rejeitada</SelectItem>
                  <SelectItem value="FULFILLED">Cumprida</SelectItem>
                  <SelectItem value="DRAFT">Rascunho</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as any)}>
                <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={personFilter} onValueChange={setPersonFilter}>
                <SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  {personOptions.map((person) => (
                    <SelectItem key={person} value={person}>{person}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {serviceOptions.map((service) => (
                    <SelectItem key={service} value={service}>{service}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <div className="flex gap-2">
                <Button variant="outline" className="w-full" onClick={clearAdvancedFilters}>Limpar</Button>
                <Button className="w-full" onClick={() => setFilterSheetOpen(false)}>Aplicar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {selectedRequestIds.length > 0 ? (
          <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(95vw,680px)] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-[hsl(var(--surface-1)/0.9)] px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="text-sm">
              <span className="font-semibold">{selectedRequestIds.length}</span> selecionada(s)
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-9 rounded-xl" onClick={exportSelectedCsv}>Exportar seleção</Button>
              <Button variant="ghost" className="h-9 rounded-xl" onClick={() => setSelectedRequestIds([])}>Limpar</Button>
            </div>
          </div>
        ) : null}

        <Button
          onClick={() => openCreateModal("STANDARD")}
          className="fixed bottom-6 right-5 z-40 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-white shadow-2xl md:hidden"
        >
          <Plus className="mr-1 h-4 w-4" />
          Nova
        </Button>

          <Dialog
            open={createOpen}
            onOpenChange={(o) => {
              setCreateOpen(o);
              if (!o) {
                setEditRequestId(null);
                setWizardStep(1);
                setWizardSubmitted(false);
                setWizardSuccess(false);
              }
            }}
          >
            <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[min(960px,92vw)] sm:max-h-[88vh] sm:max-w-[min(960px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:border-border/70">
              <div className="flex h-[100dvh] flex-col sm:h-auto sm:max-h-[88vh]">
                <div className="border-b border-border/60 bg-[hsl(var(--surface-1)/0.95)] px-3 py-3 sm:px-5">
                  <DialogHeader>
                    <DialogTitle className="text-lg sm:text-xl">
                      {editRequestId
                        ? "Editar requisição"
                        : requestMode === "RETURN"
                          ? "Nova requisição de devolução"
                          : "Nova requisição"}
                    </DialogTitle>
                    <DialogDescription>
                      Wizard de criação em 4 passos. O número GTMI é gerado no mesmo formato das restantes requisições.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--surface-3)/0.8)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300"
                      style={{ width: `${(wizardStep / 4) * 100}%` }}
                    />
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5 sm:-mx-1 sm:flex sm:gap-2 sm:overflow-x-auto sm:px-1 sm:pb-1">
                    {wizardSteps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setWizardStep(step.id)}
                        className={`rounded-xl border px-2 py-1.5 text-left transition sm:min-w-0 sm:flex-1 sm:px-3 sm:py-2 ${
                          wizardStep === step.id
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : "border-border/60 bg-[hsl(var(--surface-2)/0.55)] text-muted-foreground"
                        }`}
                      >
                        <div className="text-[9px] uppercase tracking-[0.1em] sm:text-[11px]">Passo {step.id}</div>
                        <div className="truncate text-[11px] font-medium sm:text-sm">{step.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[hsl(var(--surface-2)/0.28)] px-3 py-2 pb-4 sm:px-5 sm:py-4">
                  <div className="mx-auto w-full max-w-3xl">
                  {wizardStep === 1 ? (
                    <div className="space-y-4 animate-fade-up rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.9)] p-3 sm:p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-medium">Tipo de requisição</div>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              className={`h-11 rounded-xl border text-sm ${requestMode === "STANDARD" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 bg-[hsl(var(--surface-2)/0.6)] text-muted-foreground"}`}
                              onClick={() => setRequestMode("STANDARD")}
                              disabled={Boolean(editRequestId)}
                            >
                              Requisição normal
                            </button>
                            <button
                              type="button"
                              className={`h-11 rounded-xl border text-sm ${requestMode === "RETURN" ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 bg-[hsl(var(--surface-2)/0.6)] text-muted-foreground"}`}
                              onClick={() => setRequestMode("RETURN")}
                              disabled={Boolean(editRequestId)}
                            >
                              Devolução / Substituição
                            </button>
                          </div>
                          {editRequestId ? (
                            <p className="text-xs text-muted-foreground">O tipo é definido a partir dos itens já existentes nesta requisição.</p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Data/Hora do pedido</div>
                          <Input type="datetime-local" value={requestedAt} onChange={(e) => setRequestedAt(e.target.value)} className={`h-11 rounded-xl ${wizardSubmitted && !requestedAt ? "border-rose-400" : ""}`} />
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Serviço requisitante</div>
                          <select
                            value={requestingServiceId}
                            onChange={(e) => {
                              setRequestingServiceId(e.target.value);
                              setSelectedRequesterUserId("");
                              setRequesterName("");
                              setRequesterEmployeeNo("");
                              setRequesterPickerOpen(false);
                            }}
                            className={`h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm ${wizardSubmitted && !requestingServiceId ? "border-rose-400" : ""}`}
                          >
                            <option value="" disabled>Selecionar serviço...</option>
                            {requestingServices.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.codigo} — {s.designacao}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Prioridade</div>
                          <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LOW">Baixa</SelectItem>
                              <SelectItem value="NORMAL">Normal</SelectItem>
                              <SelectItem value="HIGH">Alta</SelectItem>
                              <SelectItem value="URGENT">Urgente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Prazo (SLA)</div>
                          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 2 ? (
                    <div className="space-y-4 animate-fade-up rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.9)] p-3 sm:p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Funcionário / Órgão (nome)</div>
                          <Popover open={requesterPickerOpen} onOpenChange={setRequesterPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                aria-expanded={requesterPickerOpen}
                                className={`h-11 w-full justify-between rounded-xl border-input font-normal ${wizardSubmitted && !requesterName.trim() ? "border-rose-400" : ""}`}
                              >
                                <span className="truncate text-left">{selectedRequesterLabel}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                              <Command>
                                <CommandInput
                                  placeholder={
                                    requestingServiceId
                                      ? "Pesquisar funcionário por nome..."
                                      : "Selecione o serviço no passo 1"
                                  }
                                  disabled={!requestingServiceId}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {requestingServiceId
                                      ? requestingServiceUsersLoading
                                        ? "A carregar funcionários..."
                                        : "Nenhum funcionário encontrado para este departamento."
                                      : "Selecione primeiro o serviço requisitante."}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {requestingServiceUsers.map((employee) => (
                                      <CommandItem
                                        key={employee.id}
                                        value={`${employee.name} ${employee.email}`}
                                        onSelect={() => {
                                          setSelectedRequesterUserId(employee.id);
                                          setRequesterName(employee.name);
                                          setRequesterEmployeeNo(employee.email);
                                          setRequesterPickerOpen(false);
                                        }}
                                      >
                                        <div className="flex w-full items-center justify-between gap-2">
                                          <span className="truncate">{employee.name}</span>
                                          <span className="truncate text-xs text-muted-foreground">{employee.email}</span>
                                        </div>
                                        {selectedRequesterUserId === employee.id ? <Check className="h-4 w-4" /> : null}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Email</div>
                          <Input value={requesterEmployeeNo} readOnly placeholder="Email do funcionário selecionado" className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-medium">Local de entrega</div>
                          <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Ex: Armazém central / Piso 2 / ..." className="h-11 rounded-xl" list="delivery-location-suggestions" />
                          <datalist id="delivery-location-suggestions">
                            {deliverySuggestions.map((loc) => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Data prevista (de)</div>
                          <Input type="date" value={expectedDeliveryFrom} onChange={(e) => setExpectedDeliveryFrom(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Data prevista (até)</div>
                          <Input type="date" value={expectedDeliveryTo} onChange={(e) => setExpectedDeliveryTo(e.target.value)} className="h-11 rounded-xl" />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <div className="text-sm font-medium">Fundamento do pedido</div>
                          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Escreva o motivo/fundamento do pedido..." className="min-h-[110px] rounded-xl" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Tipo de bem/serviço</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          {(Object.keys(goodsTypeLabels) as GoodsType[]).map((k) => (
                            <label key={k} className="flex items-center gap-2 rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.75)] px-3 py-2 text-sm">
                              <Checkbox checked={goodsTypes[k]} onCheckedChange={(checked) => setGoodsTypes((prev) => ({ ...prev, [k]: Boolean(checked) }))} />
                              <span>{goodsTypeLabels[k]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {wizardStep === 3 ? (
                    <div className="space-y-3 animate-fade-up rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.9)] p-3 sm:p-4">
                      {requestMode === "RETURN" ? (
                        <>
                          {renderItemSection("Itens antigos (a devolver/retirar)", "old", returnOldItems, setReturnOldItems)}
                          {renderItemSection("Itens novos (a substituir/entregar)", "new", returnNewItems, setReturnNewItems)}
                        </>
                      ) : (
                        <>
                          {items.map((it, idx) => {
                            const rowKey = `std-${idx}`;
                            const filteredProducts = productOptions.filter((p) => {
                              const q = (productSearchByRow[rowKey] || "").trim().toLowerCase();
                              if (!q) return true;
                              return `${p.name} ${p.sku}`.toLowerCase().includes(q);
                            });
                            return (
                              <article key={`item-wizard-${idx}`} className={`rounded-2xl border p-4 shadow-sm ${wizardSubmitted && (!it.productId || it.quantity <= 0) ? "border-rose-400" : "border-border/60"} bg-[hsl(var(--surface-1)/0.8)]`}>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div className="space-y-1 md:col-span-2">
                                    <div className="text-xs text-muted-foreground">Produto</div>
                                    <Input
                                      placeholder="Pesquisar produto..."
                                      value={productSearchByRow[rowKey] || ""}
                                      onChange={(e) => setProductSearchByRow((prev) => ({ ...prev, [rowKey]: e.target.value }))}
                                      className="h-10 rounded-xl"
                                    />
                                    <Select
                                      value={it.productId}
                                      onValueChange={(v) => {
                                        const selected = productOptions.find((p) => p.id === v);
                                        setProductSearchByRow((prev) => ({ ...prev, [rowKey]: selected ? `${selected.name} (${selected.sku})` : "" }));
                                        setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, productId: v, destination: "" } : p)));
                                        void autoPickUnitForRow(idx, { force: false, productId: v });
                                      }}
                                    >
                                      <SelectTrigger className="h-11 rounded-xl">
                                        <SelectValue placeholder="Selecionar produto" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {filteredProducts.slice(0, 120).map((p) => (
                                          <SelectItem key={p.id} value={p.id}>
                                            {p.name} ({p.sku})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Quantidade</div>
                                    <Input type="number" min={1} value={it.quantity} onChange={(e) => setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, quantity: Number(e.target.value) } : p)))} className="h-10 rounded-xl" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Unidade</div>
                                    <Input value={it.unit || ""} onChange={(e) => setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, unit: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Ex: un" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Referência</div>
                                    <Input value={it.reference || ""} onChange={(e) => setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, reference: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Ref / Nº série" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">QR / Código unidade</div>
                                    <div className="flex items-center gap-2">
                                      <Input value={it.destination || ""} onChange={(e) => setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, destination: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Código QR" />
                                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" disabled={!it.productId || Boolean(unitLoadingByRow[idx])} onClick={() => void autoPickUnitForRow(idx, { force: true, productId: it.productId, excludeCode: (it.destination || "").trim() })}>
                                        <RefreshCcw className="h-4 w-4" />
                                      </Button>
                                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl" disabled={!origin || !it.destination?.trim()} onClick={() => {
                                        const code = (it.destination || "").trim();
                                        if (!code) return;
                                        setItemQrCode(code);
                                        setItemQrOpen(true);
                                      }}>
                                        <QrCode className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-1 md:col-span-2">
                                    <div className="text-xs text-muted-foreground">Notas</div>
                                    <Input value={it.notes || ""} onChange={(e) => setItems((prev) => prev.map((p, pIdx) => (pIdx === idx ? { ...p, notes: e.target.value } : p)))} className="h-10 rounded-xl" placeholder="Observações" />
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button type="button" variant="ghost" size="sm" className="rounded-lg text-rose-600" disabled={items.length <= 1} onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Remover
                                  </Button>
                                </div>
                              </article>
                            );
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-xl"
                            onClick={() =>
                              setItems((prev) => [
                                ...prev,
                                { productId: "", quantity: 1, unit: "", reference: "", destination: "", notes: "" },
                              ])
                            }
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Adicionar item
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {wizardStep === 4 ? (
                    <div className="space-y-4 animate-fade-up rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.9)] p-3 sm:p-4">
                      <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
                        <div className="text-sm font-semibold">Resumo</div>
                        <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div><span className="text-muted-foreground">Tipo:</span> {requestMode === "RETURN" ? "Devolução / Substituição" : "Normal"}</div>
                          <div><span className="text-muted-foreground">Serviço:</span> {requestingServices.find((s) => String(s.id) === requestingServiceId)?.designacao || "—"}</div>
                          <div><span className="text-muted-foreground">Data pedido:</span> {requestedAt || "—"}</div>
                          <div><span className="text-muted-foreground">Prioridade:</span> {priority}</div>
                          <div><span className="text-muted-foreground">Prazo:</span> {dueAt || "—"}</div>
                          <div><span className="text-muted-foreground">Requerente:</span> {requesterName || "—"}</div>
                          <div><span className="text-muted-foreground">Local:</span> {deliveryLocation || "—"}</div>
                          <div className="sm:col-span-2"><span className="text-muted-foreground">Fundamento:</span> {notes || "—"}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
                        {requestMode === "RETURN" ? (
                          <div className="space-y-3">
                            <div className="text-sm font-semibold">Itens antigos ({returnOldItems.length})</div>
                            <div className="space-y-2">
                              {returnOldItems.map((it, idx) => (
                                <div key={`review-old-${idx}`} className="rounded-xl border border-amber-300/50 bg-amber-50/40 px-3 py-2 text-sm dark:bg-amber-950/10">
                                  {(it.productId ? productById.get(it.productId)?.name : "Produto não selecionado") || "Produto não selecionado"} • Qtd {it.quantity}
                                </div>
                              ))}
                            </div>
                            <div className="text-sm font-semibold">Itens novos ({returnNewItems.length})</div>
                            <div className="space-y-2">
                              {returnNewItems.map((it, idx) => (
                                <div key={`review-new-${idx}`} className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 px-3 py-2 text-sm dark:bg-emerald-950/10">
                                  {(it.productId ? productById.get(it.productId)?.name : "Produto não selecionado") || "Produto não selecionado"} • Qtd {it.quantity}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm font-semibold">Itens ({items.length})</div>
                            <div className="mt-2 space-y-2">
                              {items.map((it, idx) => (
                                <div key={`review-${idx}`} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.55)] px-3 py-2 text-sm">
                                  {(it.productId ? productById.get(it.productId)?.name : "Produto não selecionado") || "Produto não selecionado"} • Qtd {it.quantity}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      {wizardSuccess ? (
                        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                          Requisição guardada com sucesso.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  </div>
                </div>

                <div className="sticky bottom-0 border-t border-border/60 bg-[hsl(var(--surface-1)/0.95)] px-3 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-5 sm:py-3 sm:pb-3">
                  <div className="space-y-2 sm:hidden">
                    {wizardStep < 4 ? (
                      <Button className="h-11 w-full" onClick={goNextStep}>
                        Seguinte
                      </Button>
                    ) : (
                      <Button className="h-11 w-full" onClick={editRequestId ? updateRequest : createRequest} disabled={!canCreate || creating}>
                        {editRequestId
                          ? creating
                            ? "A guardar..."
                            : "Guardar"
                          : creating
                            ? "A criar..."
                            : requestMode === "RETURN"
                              ? "Confirmar devolução"
                              : "Confirmar e criar"}
                      </Button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-11 w-full"
                        onClick={() => {
                          setCreateOpen(false);
                          setEditRequestId(null);
                          setWizardStep(1);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button variant="ghost" className="h-11 w-full" onClick={goPrevStep} disabled={wizardStep === 1}>
                        Anterior
                      </Button>
                    </div>
                  </div>
                  <div className="hidden items-center justify-between gap-2 sm:flex">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCreateOpen(false);
                          setEditRequestId(null);
                          setWizardStep(1);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button variant="ghost" onClick={goPrevStep} disabled={wizardStep === 1}>
                        Anterior
                      </Button>
                    </div>
                    {wizardStep < 4 ? (
                      <Button onClick={goNextStep}>
                        Seguinte
                      </Button>
                    ) : (
                      <Button onClick={editRequestId ? updateRequest : createRequest} disabled={!canCreate || creating}>
                        {editRequestId
                          ? creating
                            ? "A guardar..."
                            : "Guardar"
                          : creating
                            ? "A criar..."
                            : requestMode === "RETURN"
                              ? "Confirmar devolução"
                              : "Confirmar e criar"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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
    </AuthenticatedLayout>
  );
}
