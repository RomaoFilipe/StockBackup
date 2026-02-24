"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type RequestingServiceRow = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

type SupplierRow = {
  id: string;
  name: string;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  contactName?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type SupplierProviderRow = {
  id: string;
  supplierId: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
  supplier?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

type PublicAccessPinRow = {
  id: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type PublicAccessLinkRow = {
  id: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  requestingService: { id: number; codigo: string; designacao: string; ativo: boolean };
  pins: PublicAccessPinRow[];
  pinCounts: { total: number; active: number };
  requestsCount: number;
  publicPath: string;
};

type PublicRequestStatus = "RECEIVED" | "ACCEPTED" | "REJECTED";

type PublicRequestRow = {
  id: string;
  status: PublicRequestStatus;
  createdAt: string;
  handledAt: string | null;
  requesterName: string;
  requesterIp: string | null;
  deliveryLocation: string | null;
  title: string | null;
  notes: string | null;
  handledNote: string | null;
  handledBy: { id: string; name: string; email: string } | null;
  requestingService: { id: number; codigo: string; designacao: string } | null;
  acceptedRequest: { id: string; gtmiNumber: string } | null;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    unit: string | null;
    notes: string | null;
    product: { id: string; name: string; sku: string } | null;
  }>;
};

type AdminTicketRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "ESCALATED" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  type: "INCIDENT" | "REQUEST" | "QUESTION" | "CHANGE";
  level: "L1" | "L2" | "L3";
  createdAt: string;
  updatedAt: string;
  firstResponseDueAt?: string | null;
  resolutionDueAt?: string | null;
  slaBreachedAt?: string | null;
  lastEscalatedAt?: string | null;
  slaEscalationCount?: number;
  assignedTo?: { id: string; name?: string | null; email: string } | null;
  createdBy?: { id: string; name?: string | null; email: string } | null;
  _count?: { messages?: number };
};

const formatPublicStatus = (status: PublicRequestStatus) => {
  switch (status) {
    case "RECEIVED":
      return { label: "Recebido", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" };
    case "ACCEPTED":
      return {
        label: "Aceite",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
      };
    case "REJECTED":
      return { label: "Rejeitado", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" };
    default:
      return { label: status, className: "bg-muted/50 text-muted-foreground border-border/60" };
  }
};

function formatDateTimePt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-PT");
}

const formatTicketStatus = (status: AdminTicketRow["status"]) => {
  switch (status) {
    case "OPEN":
      return { label: "Aberto", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20" };
    case "IN_PROGRESS":
      return { label: "Em progresso", className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20" };
    case "WAITING_CUSTOMER":
      return { label: "A aguardar", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" };
    case "ESCALATED":
      return { label: "Escalado", className: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20" };
    case "RESOLVED":
      return { label: "Resolvido", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };
    case "CLOSED":
      return { label: "Fechado", className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20" };
    default:
      return { label: status, className: "bg-muted/50 text-muted-foreground border-border/60" };
  }
};

const formatTicketPriority = (priority: AdminTicketRow["priority"]) => {
  switch (priority) {
    case "LOW":
      return { label: "Baixa", className: "bg-slate-500/10 text-slate-700 border-slate-500/20" };
    case "HIGH":
      return { label: "Alta", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" };
    case "CRITICAL":
      return { label: "Crítica", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" };
    default:
      return { label: "Normal", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" };
  }
};

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [origin, setOrigin] = useState("");

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const [tab, setTab] = useState<"services" | "categories" | "suppliers" | "tickets" | "received">("services");

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "received") {
      setTab("received");
      return;
    }
    if (tabParam === "tickets") {
      setTab("tickets");
    }
  }, [searchParams]);

  const [pageSize, setPageSize] = useState<number>(25);
  const [servicesPage, setServicesPage] = useState<number>(1);
  const [categoriesPage, setCategoriesPage] = useState<number>(1);
  const [suppliersPage, setSuppliersPage] = useState<number>(1);
  const [ticketsPage, setTicketsPage] = useState<number>(1);

  const [services, setServices] = useState<RequestingServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesFilter, setServicesFilter] = useState("");
  const [servicesActiveFilter, setServicesActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [servicesSort, setServicesSort] = useState<"codigo" | "designacao" | "id">("codigo");
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineCodigo, setInlineCodigo] = useState("");
  const [inlineDesignacao, setInlineDesignacao] = useState("");
  const [inlineAtivo, setInlineAtivo] = useState(true);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [confirmToggleRow, setConfirmToggleRow] = useState<RequestingServiceRow | null>(null);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [showServiceIdCol, setShowServiceIdCol] = useState(true);
  const [showServiceCodigoCol, setShowServiceCodigoCol] = useState(true);
  const [showServiceAtivoCol, setShowServiceAtivoCol] = useState(true);
  const [createSuccessPulse, setCreateSuccessPulse] = useState(false);

  const [createCodigo, setCreateCodigo] = useState("");
  const [createDesignacao, setCreateDesignacao] = useState("");
  const [createAtivo, setCreateAtivo] = useState(true);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<RequestingServiceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesFilter, setCategoriesFilter] = useState("");
  const [createCategoryName, setCreateCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersFilter, setSuppliersFilter] = useState("");
  const [createSupplierName, setCreateSupplierName] = useState("");
  const [createSupplierNif, setCreateSupplierNif] = useState("");
  const [createSupplierEmail, setCreateSupplierEmail] = useState("");
  const [createSupplierPhone, setCreateSupplierPhone] = useState("");
  const [createSupplierContactName, setCreateSupplierContactName] = useState("");
  const [createSupplierAddress, setCreateSupplierAddress] = useState("");
  const [createSupplierNotes, setCreateSupplierNotes] = useState("");
  const [createSupplierActive, setCreateSupplierActive] = useState(true);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<SupplierRow | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierProviders, setSupplierProviders] = useState<SupplierProviderRow[]>([]);
  const [supplierProvidersLoading, setSupplierProvidersLoading] = useState(false);
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerSupplier, setProviderSupplier] = useState<SupplierRow | null>(null);
  const [createProviderName, setCreateProviderName] = useState("");
  const [createProviderRole, setCreateProviderRole] = useState("");
  const [createProviderEmail, setCreateProviderEmail] = useState("");
  const [createProviderPhone, setCreateProviderPhone] = useState("");
  const [createProviderNotes, setCreateProviderNotes] = useState("");
  const [createProviderActive, setCreateProviderActive] = useState(true);
  const [creatingProvider, setCreatingProvider] = useState(false);

  const [accessLinks, setAccessLinks] = useState<PublicAccessLinkRow[]>([]);
  const [accessLinksLoading, setAccessLinksLoading] = useState(false);
  const [accessLinksLoadedOnce, setAccessLinksLoadedOnce] = useState(false);

  const [createAccessServiceId, setCreateAccessServiceId] = useState<string>("");
  const [createAccessSlug, setCreateAccessSlug] = useState("");
  const [creatingAccess, setCreatingAccess] = useState(false);

  const [pinsOpen, setPinsOpen] = useState(false);
  const [pinsLink, setPinsLink] = useState<PublicAccessLinkRow | null>(null);
  const [pinLabel, setPinLabel] = useState("");
  const [creatingPin, setCreatingPin] = useState(false);

  const [newPinOpen, setNewPinOpen] = useState(false);
  const [newPinValue, setNewPinValue] = useState<string | null>(null);
  const [recentPinsById, setRecentPinsById] = useState<Record<string, string>>({});

  const [editPinOpen, setEditPinOpen] = useState(false);
  const [editPinId, setEditPinId] = useState<string | null>(null);
  const [editPinLabel, setEditPinLabel] = useState("");
  const [editPinNewValue, setEditPinNewValue] = useState("");
  const [savingPin, setSavingPin] = useState(false);

  const [publicRequests, setPublicRequests] = useState<PublicRequestRow[]>([]);
  const [publicRequestsLoading, setPublicRequestsLoading] = useState(false);
  const [publicRequestsLoadedOnce, setPublicRequestsLoadedOnce] = useState(false);
  const [publicRequestsStatus, setPublicRequestsStatus] = useState<PublicRequestStatus>("RECEIVED");
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoadedOnce, setTicketsLoadedOnce] = useState(false);
  const [ticketsFilter, setTicketsFilter] = useState("");
  const [ticketsStatusFilter, setTicketsStatusFilter] = useState<
    "ALL" | "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "ESCALATED" | "RESOLVED" | "CLOSED"
  >("ALL");
  const [runningTicketSla, setRunningTicketSla] = useState(false);
  const [createTicketTitle, setCreateTicketTitle] = useState("");
  const [createTicketDescription, setCreateTicketDescription] = useState("");
  const [createTicketPriority, setCreateTicketPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "CRITICAL">("NORMAL");
  const [createTicketType, setCreateTicketType] = useState<"INCIDENT" | "REQUEST" | "QUESTION" | "CHANGE">("QUESTION");
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<PublicRequestRow | null>(null);

  const [handleOpen, setHandleOpen] = useState(false);
  const [handleMode, setHandleMode] = useState<"accept" | "reject">("accept");
  const [handleRow, setHandleRow] = useState<PublicRequestRow | null>(null);
  const [handleNote, setHandleNote] = useState("");
  const [handling, setHandling] = useState(false);
  const [backfillRunning, setBackfillRunning] = useState(false);

  const loadServices = async () => {
    setServicesLoading(true);
    try {
      const res = await axiosInstance.get("/requesting-services", {
        params: { includeInactive: 1 },
      });
      setServices(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar serviços requisitantes.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    try {
      const res = await axiosInstance.get("/categories");
      setCategories(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar categorias.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadSuppliers = async () => {
    setSuppliersLoading(true);
    try {
      const res = await axiosInstance.get("/suppliers", { params: { includeInactive: 1 } });
      setSuppliers(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar fornecedores.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const loadSupplierProviders = async (supplierId?: string) => {
    setSupplierProvidersLoading(true);
    try {
      const res = await axiosInstance.get("/supplier-providers", {
        params: {
          includeInactive: 1,
          ...(supplierId ? { supplierId } : {}),
        },
      });
      setSupplierProviders(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar prestadores.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setSupplierProviders([]);
    } finally {
      setSupplierProvidersLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/");
      return;
    }

    loadServices();
    loadCategories();
    loadSuppliers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin]);

  const loadPublicRequests = async () => {
    setPublicRequestsLoading(true);
    try {
      const res = await axiosInstance.get("/admin/public-requests", {
        params: { status: publicRequestsStatus, limit: 200 },
      });
      setPublicRequests(Array.isArray(res.data) ? res.data : []);
      setPublicRequestsLoadedOnce(true);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar pedidos recebidos.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setPublicRequests([]);
    } finally {
      setPublicRequestsLoading(false);
    }
  };

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await axiosInstance.get("/tickets");
      const rows = Array.isArray(res.data) ? (res.data as AdminTicketRow[]) : [];
      setTickets(rows);
      setTicketsLoadedOnce(true);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar tickets.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  const runTicketSlaNow = async () => {
    setRunningTicketSla(true);
    try {
      await axiosInstance.post("/tickets/sla/run");
      await loadTickets();
      toast({ title: "SLA executado", description: "Escalonamento automático atualizado." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível executar SLA.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setRunningTicketSla(false);
    }
  };

  const createTicket = async () => {
    if (!createTicketTitle.trim()) return;
    setCreatingTicket(true);
    try {
      await axiosInstance.post("/tickets", {
        title: createTicketTitle.trim(),
        description: createTicketDescription.trim() || undefined,
        priority: createTicketPriority,
        type: createTicketType,
      });
      setCreateTicketTitle("");
      setCreateTicketDescription("");
      setCreateTicketPriority("NORMAL");
      setCreateTicketType("QUESTION");
      await loadTickets();
      toast({ title: "Ticket criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingTicket(false);
    }
  };

  const closeTicket = async (ticketId: string) => {
    if (closingTicketId) return;
    setClosingTicketId(ticketId);
    try {
      await axiosInstance.patch(`/tickets/${ticketId}`, {
        status: "CLOSED",
        closeNote: "Encerrado pelo ADMIN na lista de tickets.",
      });
      await loadTickets();
      toast({ title: "Ticket encerrado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível encerrar ticket.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setClosingTicketId(null);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn || !isAdmin) return;
    if (tab !== "received") return;
    loadPublicRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, publicRequestsStatus, isAuthLoading, isLoggedIn, isAdmin]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn || !isAdmin) return;
    if (tab !== "tickets") return;
    if (ticketsLoadedOnce) return;
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAuthLoading, isLoggedIn, isAdmin, ticketsLoadedOnce]);

  useEffect(() => {
    if (tab !== "received") return;
    const id = searchParams?.get("publicRequestId");
    if (!id) return;
    const found = publicRequests.find((r) => r.id === id);
    if (!found) return;
    openDetails(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchParams, publicRequests]);

  const openDetails = (row: PublicRequestRow) => {
    setDetailsRow(row);
    setDetailsOpen(true);
  };

  const openHandle = (mode: "accept" | "reject", row: PublicRequestRow) => {
    setHandleMode(mode);
    setHandleRow(row);
    setHandleNote("");
    setHandleOpen(true);
  };

  const confirmHandle = async () => {
    if (!handleRow) return;
    setHandling(true);
    try {
      const url = `/admin/public-requests/${handleRow.id}/${handleMode}`;
      const res = await axiosInstance.post(url, { note: handleNote.trim() || undefined });

      if (handleMode === "accept") {
        toast({
          title: "Pedido aceite",
          description: res.data?.requestId ? `Criada requisição: ${String(res.data.requestId)}` : undefined,
        });
      } else {
        toast({ title: "Pedido rejeitado" });
      }

      setHandleOpen(false);
      setHandleRow(null);
      setHandleNote("");
      await loadPublicRequests();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível concluir a ação.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setHandling(false);
    }
  };

  const runBackfillOwners = async (apply: boolean) => {
    if (apply) {
      const ok = window.confirm(
        "Isto vai corrigir o dono (userId) de pedidos antigos já aceites. Continuar?"
      );
      if (!ok) return;
    }

    setBackfillRunning(true);
    try {
      const res = await axiosInstance.post("/admin/public-requests/backfill-owners", { apply });
      const summary = res.data?.summary;
      toast({
        title: apply ? "Correção aplicada" : "Simulação concluída",
        description: summary
          ? `Analisados: ${summary.checked} · Corrigidos: ${summary.fixed} · Já OK: ${summary.alreadyOk} · Não resolvidos: ${summary.unresolved}`
          : undefined,
      });
      if (apply) {
        await loadPublicRequests();
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível executar correção de donos.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setBackfillRunning(false);
    }
  };

  const createAccessLink = async () => {
    toast({
      title: "Funcionalidade removida",
      description: "Links públicos/PIN foram descontinuados. Use Estado do Pedido > + Novo Pedido.",
    });
  };

  const openPins = (link: PublicAccessLinkRow) => {
    setPinsLink(link);
    setPinsOpen(true);
    setPinLabel("");
  };

  const createPin = async () => {
    toast({
      title: "Funcionalidade removida",
      description: "PIN não é mais necessário no novo fluxo interno.",
    });
  };

  const setPinActive = async (accessId: string, pinId: string, isActive: boolean) => {
    void accessId;
    void pinId;
    void isActive;
    toast({
      title: "Funcionalidade removida",
      description: "PIN não é mais necessário no novo fluxo interno.",
    });
  };

  const openEditPin = (pin: PublicAccessPinRow) => {
    setEditPinId(pin.id);
    setEditPinLabel(pin.label || "");
    setEditPinNewValue("");
    setEditPinOpen(true);
  };

  const savePin = async (mode: "label" | "set" | "regen") => {
    void mode;
    setEditPinOpen(false);
    setEditPinId(null);
    setEditPinLabel("");
    setEditPinNewValue("");
    toast({
      title: "Funcionalidade removida",
      description: "PIN não é mais necessário no novo fluxo interno.",
    });
  };

  const setAccessLinkActive = async (link: PublicAccessLinkRow, isActive: boolean) => {
    void link;
    void isActive;
    toast({
      title: "Funcionalidade removida",
      description: "Links públicos foram descontinuados.",
    });
  };

  const hardRemoveAccessLink = async (link: PublicAccessLinkRow) => {
    void link;
    toast({
      title: "Funcionalidade removida",
      description: "Links públicos foram descontinuados.",
    });
  };

  const filteredServices = useMemo(() => {
    const q = servicesFilter.trim().toLowerCase();
    const rows = services.filter((s) => {
      if (servicesActiveFilter === "ACTIVE" && !s.ativo) return false;
      if (servicesActiveFilter === "INACTIVE" && s.ativo) return false;
      if (!q) return true;
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.designacao.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    });
    rows.sort((a, b) => {
      if (servicesSort === "id") return a.id - b.id;
      if (servicesSort === "designacao") return a.designacao.localeCompare(b.designacao, "pt");
      return a.codigo.localeCompare(b.codigo, "pt");
    });
    return rows;
  }, [services, servicesFilter, servicesActiveFilter, servicesSort]);

  const filteredCategories = useMemo(() => {
    const q = categoriesFilter.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [categories, categoriesFilter]);

  const filteredSuppliers = useMemo(() => {
    const q = suppliersFilter.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.id.includes(q) ||
        String(s.nif ?? "").toLowerCase().includes(q) ||
        String(s.email ?? "").toLowerCase().includes(q) ||
        String(s.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, suppliersFilter]);

  const filteredTickets = useMemo(() => {
    const q = ticketsFilter.trim().toLowerCase();
    return tickets.filter((t) => {
      if (ticketsStatusFilter !== "ALL" && t.status !== ticketsStatusFilter) return false;
      if (!q) return true;
      return (
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        String(t.description ?? "").toLowerCase().includes(q) ||
        String(t.createdBy?.name ?? "").toLowerCase().includes(q) ||
        String(t.createdBy?.email ?? "").toLowerCase().includes(q) ||
        String(t.assignedTo?.name ?? "").toLowerCase().includes(q) ||
        String(t.assignedTo?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, ticketsFilter, ticketsStatusFilter]);

  const servicesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredServices.length / pageSize));
  }, [filteredServices.length, pageSize]);

  const categoriesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  }, [filteredCategories.length, pageSize]);

  const suppliersTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  }, [filteredSuppliers.length, pageSize]);

  const ticketsTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  }, [filteredTickets.length, pageSize]);

  const pagedServices = useMemo(() => {
    const currentPage = Math.min(Math.max(1, servicesPage), servicesTotalPages);
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, pageSize, servicesPage, servicesTotalPages]);

  const pagedCategories = useMemo(() => {
    const currentPage = Math.min(Math.max(1, categoriesPage), categoriesTotalPages);
    const start = (currentPage - 1) * pageSize;
    return filteredCategories.slice(start, start + pageSize);
  }, [filteredCategories, pageSize, categoriesPage, categoriesTotalPages]);

  const pagedSuppliers = useMemo(() => {
    const currentPage = Math.min(Math.max(1, suppliersPage), suppliersTotalPages);
    const start = (currentPage - 1) * pageSize;
    return filteredSuppliers.slice(start, start + pageSize);
  }, [filteredSuppliers, pageSize, suppliersPage, suppliersTotalPages]);

  const pagedTickets = useMemo(() => {
    const currentPage = Math.min(Math.max(1, ticketsPage), ticketsTotalPages);
    const start = (currentPage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, pageSize, ticketsPage, ticketsTotalPages]);

  useEffect(() => {
    setServicesPage(1);
  }, [servicesFilter, servicesActiveFilter, servicesSort]);

  useEffect(() => {
    setCategoriesPage(1);
  }, [categoriesFilter]);

  useEffect(() => {
    setSuppliersPage(1);
  }, [suppliersFilter]);

  useEffect(() => {
    setTicketsPage(1);
  }, [ticketsFilter, ticketsStatusFilter]);

  useEffect(() => {
    if (!expandedSupplierId) return;
    if (suppliers.some((s) => s.id === expandedSupplierId)) return;
    setExpandedSupplierId(null);
  }, [suppliers, expandedSupplierId]);

  useEffect(() => {
    setServicesPage(1);
    setCategoriesPage(1);
    setSuppliersPage(1);
    setTicketsPage(1);
  }, [tab, pageSize]);

  useEffect(() => {
    const allowed = new Set(filteredServices.map((s) => s.id));
    setSelectedServiceIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredServices]);

  const tabCounts = useMemo(
    () => ({
      services: services.length,
      categories: categories.length,
      suppliers: suppliers.length,
      tickets: tickets.length,
      received: publicRequests.length,
    }),
    [services.length, categories.length, suppliers.length, tickets.length, publicRequests.length]
  );

  const PaginationBar = (props: {
    page: number;
    setPage: (v: number) => void;
    totalPages: number;
    totalItems: number;
  }) => {
    const { page, setPage, totalPages, totalItems } = props;
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(totalItems, currentPage * pageSize);

    return (
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mt-4">
        <div className="text-xs text-muted-foreground">
          {totalItems === 0 ? "0 resultados" : `${startItem}–${endItem} de ${totalItems}`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">Por página</div>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            Anterior
          </Button>
          <div className="text-sm">
            {currentPage} / {totalPages}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
          >
            Seguinte
          </Button>
        </div>
      </div>
    );
  };

  const canCreate = useMemo(() => {
    return Boolean(createCodigo.trim()) && Boolean(createDesignacao.trim());
  }, [createCodigo, createDesignacao]);

  const createService = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const payload = {
        codigo: createCodigo.trim(),
        designacao: createDesignacao.trim(),
        ativo: createAtivo,
      };
      const res = await axiosInstance.post("/requesting-services", payload);
      setServices((prev) => {
        const next = [res.data, ...prev];
        next.sort((a, b) => a.codigo.localeCompare(b.codigo));
        return next;
      });
      setCreateCodigo("");
      setCreateDesignacao("");
      setCreateAtivo(true);
      setCreateSuccessPulse(true);
      setTimeout(() => setCreateSuccessPulse(false), 900);
      setMobileCreateOpen(false);
      toast({ title: "Serviço criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar serviço.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (row: RequestingServiceRow) => {
    setEditRow({ ...row });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editRow) return;
    if (!editRow.codigo.trim() || !editRow.designacao.trim()) {
      toast({ title: "Erro", description: "Código e designação são obrigatórios.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        codigo: editRow.codigo.trim(),
        designacao: editRow.designacao.trim(),
        ativo: editRow.ativo,
      };
      const res = await axiosInstance.patch(`/requesting-services/${editRow.id}`, payload);
      setServices((prev) => prev.map((s) => (s.id === editRow.id ? res.data : s)));
      toast({ title: "Serviço atualizado" });
      setEditOpen(false);
      setEditRow(null);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (row: RequestingServiceRow) => {
    try {
      const res = await axiosInstance.patch(`/requesting-services/${row.id}`, { ativo: !row.ativo });
      setServices((prev) => prev.map((s) => (s.id === row.id ? res.data : s)));
      toast({ title: !row.ativo ? "Serviço ativado" : "Serviço desativado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const requestToggleAtivo = (row: RequestingServiceRow) => {
    if (row.ativo) {
      setConfirmToggleRow(row);
      setConfirmToggleOpen(true);
      return;
    }
    void toggleAtivo(row);
  };

  const startInlineEdit = (row: RequestingServiceRow) => {
    setInlineEditId(row.id);
    setInlineCodigo(row.codigo);
    setInlineDesignacao(row.designacao);
    setInlineAtivo(row.ativo);
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineCodigo("");
    setInlineDesignacao("");
    setInlineAtivo(true);
  };

  const saveInlineEdit = async (id: number) => {
    if (!inlineCodigo.trim() || !inlineDesignacao.trim()) {
      toast({ title: "Erro", description: "Código e designação são obrigatórios.", variant: "destructive" });
      return;
    }
    try {
      const res = await axiosInstance.patch(`/requesting-services/${id}`, {
        codigo: inlineCodigo.trim(),
        designacao: inlineDesignacao.trim(),
        ativo: inlineAtivo,
      });
      setServices((prev) => prev.map((s) => (s.id === id ? res.data : s)));
      toast({ title: "Serviço atualizado" });
      cancelInlineEdit();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível guardar edição inline.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const allPagedServicesSelected =
    pagedServices.length > 0 && pagedServices.every((s) => selectedServiceIds.includes(s.id));

  const toggleSelectAllPagedServices = (checked: boolean) => {
    if (!checked) {
      const ids = new Set(pagedServices.map((s) => s.id));
      setSelectedServiceIds((prev) => prev.filter((id) => !ids.has(id)));
      return;
    }
    setSelectedServiceIds((prev) => Array.from(new Set([...prev, ...pagedServices.map((s) => s.id)])));
  };

  const bulkSetActiveServices = async (isActive: boolean) => {
    const selectedRows = filteredServices.filter((s) => selectedServiceIds.includes(s.id));
    if (!selectedRows.length) return;
    try {
      await Promise.all(
        selectedRows.map((row) =>
          axiosInstance.patch(`/requesting-services/${row.id}`, {
            codigo: row.codigo,
            designacao: row.designacao,
            ativo: isActive,
          })
        )
      );
      await loadServices();
      setSelectedServiceIds([]);
      toast({ title: isActive ? "Serviços ativados" : "Serviços desativados" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível executar ação em lote.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const canCreateCategory = useMemo(() => {
    return Boolean(createCategoryName.trim());
  }, [createCategoryName]);

  const createCategory = async () => {
    if (!canCreateCategory) return;
    setCreatingCategory(true);
    try {
      const res = await axiosInstance.post("/categories", { name: createCategoryName.trim() });
      setCategories((prev) => {
        const next = [res.data, ...prev];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setCreateCategoryName("");
      toast({ title: "Categoria criada" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar categoria.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingCategory(false);
    }
  };

  const openEditCategory = (row: CategoryRow) => {
    setEditCategory({ ...row });
    setEditCategoryOpen(true);
  };

  const saveCategory = async () => {
    if (!editCategory) return;
    if (!editCategory.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }

    setSavingCategory(true);
    try {
      const res = await axiosInstance.put("/categories", { id: editCategory.id, name: editCategory.name.trim() });
      setCategories((prev) => prev.map((c) => (c.id === editCategory.id ? res.data : c)));
      toast({ title: "Categoria atualizada" });
      setEditCategoryOpen(false);
      setEditCategory(null);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSavingCategory(false);
    }
  };

  const deleteCategory = async (row: CategoryRow) => {
    if (!confirm(`Remover categoria "${row.name}"?`)) return;
    try {
      await axiosInstance.delete("/categories", { data: { id: row.id } });
      setCategories((prev) => prev.filter((c) => c.id !== row.id));
      toast({ title: "Categoria removida" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const canCreateSupplier = useMemo(() => {
    return Boolean(createSupplierName.trim());
  }, [createSupplierName]);

  const createSupplier = async () => {
    if (!canCreateSupplier) return;
    setCreatingSupplier(true);
    try {
      const payload = {
        name: createSupplierName.trim(),
        nif: createSupplierNif.trim() ? createSupplierNif.trim() : undefined,
        email: createSupplierEmail.trim() ? createSupplierEmail.trim() : undefined,
        phone: createSupplierPhone.trim() ? createSupplierPhone.trim() : undefined,
        contactName: createSupplierContactName.trim() ? createSupplierContactName.trim() : undefined,
        address: createSupplierAddress.trim() ? createSupplierAddress.trim() : undefined,
        notes: createSupplierNotes.trim() ? createSupplierNotes.trim() : undefined,
        isActive: createSupplierActive,
      };
      const res = await axiosInstance.post("/suppliers", payload);
      setSuppliers((prev) => {
        const next = [res.data, ...prev];
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setCreateSupplierName("");
      setCreateSupplierNif("");
      setCreateSupplierEmail("");
      setCreateSupplierPhone("");
      setCreateSupplierContactName("");
      setCreateSupplierAddress("");
      setCreateSupplierNotes("");
      setCreateSupplierActive(true);
      toast({ title: "Fornecedor criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar fornecedor.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingSupplier(false);
    }
  };

  const openEditSupplier = (row: SupplierRow) => {
    setEditSupplier({ ...row });
    setEditSupplierOpen(true);
  };

  const saveSupplier = async () => {
    if (!editSupplier) return;
    if (!editSupplier.name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }

    setSavingSupplier(true);
    try {
      const res = await axiosInstance.put("/suppliers", {
        id: editSupplier.id,
        name: editSupplier.name.trim(),
        nif: editSupplier.nif ? String(editSupplier.nif).trim() : null,
        email: editSupplier.email ? String(editSupplier.email).trim() : null,
        phone: editSupplier.phone ? String(editSupplier.phone).trim() : null,
        contactName: editSupplier.contactName ? String(editSupplier.contactName).trim() : null,
        address: editSupplier.address ? String(editSupplier.address).trim() : null,
        notes: editSupplier.notes ? String(editSupplier.notes).trim() : null,
        isActive: Boolean(editSupplier.isActive),
      });
      setSuppliers((prev) => prev.map((s) => (s.id === editSupplier.id ? res.data : s)));
      toast({ title: "Fornecedor atualizado" });
      setEditSupplierOpen(false);
      setEditSupplier(null);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSavingSupplier(false);
    }
  };

  const deleteSupplier = async (row: SupplierRow) => {
    if (!confirm(`Remover fornecedor "${row.name}"?`)) return;
    try {
      await axiosInstance.delete("/suppliers", { data: { id: row.id } });
      setSuppliers((prev) => prev.filter((s) => s.id !== row.id));
      setSupplierProviders((prev) => prev.filter((p) => p.supplierId !== row.id));
      if (expandedSupplierId === row.id) setExpandedSupplierId(null);
      toast({ title: "Fornecedor removido" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const providersBySupplierId = useMemo(() => {
    const grouped: Record<string, SupplierProviderRow[]> = {};
    for (const provider of supplierProviders) {
      if (!grouped[provider.supplierId]) grouped[provider.supplierId] = [];
      grouped[provider.supplierId].push(provider);
    }
    return grouped;
  }, [supplierProviders]);

  const canCreateProvider = useMemo(() => {
    return Boolean(providerSupplier?.id) && Boolean(createProviderName.trim());
  }, [providerSupplier, createProviderName]);

  const createSupplierProvider = async () => {
    if (!canCreateProvider) return;
    if (!providerSupplier?.id) return;
    setCreatingProvider(true);
    try {
      const res = await axiosInstance.post("/supplier-providers", {
        supplierId: providerSupplier.id,
        name: createProviderName.trim(),
        role: createProviderRole.trim() || undefined,
        email: createProviderEmail.trim() || undefined,
        phone: createProviderPhone.trim() || undefined,
        notes: createProviderNotes.trim() || undefined,
        isActive: createProviderActive,
      });
      setSupplierProviders((prev) => {
        const next = [res.data, ...prev];
        next.sort((a, b) => a.name.localeCompare(b.name, "pt"));
        return next;
      });
      setCreateProviderName("");
      setCreateProviderRole("");
      setCreateProviderEmail("");
      setCreateProviderPhone("");
      setCreateProviderNotes("");
      setCreateProviderActive(true);
      setProviderModalOpen(false);
      toast({ title: "Prestador criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar prestador.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingProvider(false);
    }
  };

  const deleteSupplierProvider = async (row: SupplierProviderRow) => {
    if (!confirm(`Remover prestador "${row.name}"?`)) return;
    try {
      await axiosInstance.delete("/supplier-providers", { data: { id: row.id } });
      setSupplierProviders((prev) => prev.filter((p) => p.id !== row.id));
      toast({ title: "Prestador removido" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover prestador.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const openCreateProviderModal = (supplier: SupplierRow) => {
    setProviderSupplier(supplier);
    setCreateProviderName("");
    setCreateProviderRole("");
    setCreateProviderEmail("");
    setCreateProviderPhone("");
    setCreateProviderNotes("");
    setCreateProviderActive(true);
    setProviderModalOpen(true);
  };

  const toggleSupplierProvidersExpand = async (supplierId: string) => {
    if (expandedSupplierId === supplierId) {
      setExpandedSupplierId(null);
      return;
    }
    setExpandedSupplierId(supplierId);
    await loadSupplierProviders(supplierId);
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 overflow-x-hidden">
        <section className="glass-panel rounded-2xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Gestão</h1>
              <p className="text-sm text-muted-foreground">Configuração e controlo de entidades do sistema</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500"
                onClick={() => {
                  setTab("services");
                  setMobileCreateOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Quick Add
              </Button>
              <Button variant="outline" className="h-11 rounded-2xl" onClick={() => router.push("/users")}>
                Audit Log
              </Button>
              <Badge className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary" variant="outline">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                ADMIN
              </Badge>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border/70 bg-[hsl(var(--surface-1)/0.85)] px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={
                  tab === "services"
                    ? servicesFilter
                    : tab === "categories"
                      ? categoriesFilter
                      : tab === "suppliers"
                        ? suppliersFilter
                        : tab === "tickets"
                          ? ticketsFilter
                        : ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  if (tab === "services") setServicesFilter(value);
                  if (tab === "categories") setCategoriesFilter(value);
                  if (tab === "suppliers") setSuppliersFilter(value);
                  if (tab === "tickets") setTicketsFilter(value);
                }}
                placeholder="Pesquisa rápida no separador atual..."
                className="min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                disabled={tab === "received"}
              />
            </div>
            {tab === "services" ? (
              <Button variant="outline" className="hidden rounded-xl md:inline-flex" onClick={() => setServicesActiveFilter("ALL")}>
                <Filter className="h-4 w-4" />
                Limpar filtro
              </Button>
            ) : null}
            <Button variant="outline" className="ml-auto rounded-full px-2.5 sm:ml-0">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              <span className="hidden sm:inline">{user?.name || "Conta"}</span>
            </Button>
          </div>
        </section>

        <section className="overflow-x-auto">
          <div className="inline-flex w-max min-w-full items-center gap-1 rounded-2xl border border-border/70 bg-[hsl(var(--surface-2)/0.72)] p-1">
            {[
              { key: "services", label: "Serviços", count: tabCounts.services },
              { key: "categories", label: "Categorias", count: tabCounts.categories },
              { key: "suppliers", label: "Fornecedores", count: tabCounts.suppliers },
              { key: "tickets", label: "Tickets", count: tabCounts.tickets },
              { key: "received", label: "Recebidos", count: tabCounts.received },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key as any)}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
                  tab === item.key ? "bg-[hsl(var(--surface-1)/0.95)] text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {item.label}
                <Badge variant="secondary" className="rounded-full">{item.count}</Badge>
                {tab === item.key ? <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-primary" /> : null}
              </button>
            ))}
          </div>
        </section>

        {tab === "services" ? (
          <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="mb-3 text-sm font-semibold">Adicionar Serviço</div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Código</div>
                  <Input value={createCodigo} onChange={(e) => setCreateCodigo(e.target.value)} placeholder="Ex: 001" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Designação</div>
                  <Input value={createDesignacao} onChange={(e) => setCreateDesignacao(e.target.value)} placeholder="Ex: Presidente" className="h-11 rounded-xl" />
                </div>
                <label className="flex items-center justify-between rounded-xl border border-border/70 bg-[hsl(var(--surface-2)/0.62)] px-3 py-2">
                  <span className="text-sm">Ativo</span>
                  <button
                    type="button"
                    aria-label="Alternar ativo"
                    onClick={() => setCreateAtivo((prev) => !prev)}
                    className={`relative h-6 w-11 rounded-full transition ${createAtivo ? "bg-primary/80" : "bg-muted"}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${createAtivo ? "left-[1.3rem]" : "left-0.5"}`} />
                  </button>
                </label>
                <Button
                  onClick={createService}
                  disabled={!canCreate || creating}
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  {creating ? "A adicionar..." : createSuccessPulse ? (
                    <>
                      <Check className="h-4 w-4" />
                      Guardado
                    </>
                  ) : (
                    "Adicionar"
                  )}
                </Button>
                {!canCreate ? (
                  <div className="text-xs text-amber-600">Preencha código e designação.</div>
                ) : (
                  <div className="text-xs text-emerald-600">Validação OK.</div>
                )}
              </div>
            </aside>

            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={servicesActiveFilter === "ALL" ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setServicesActiveFilter("ALL")}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={servicesActiveFilter === "ACTIVE" ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setServicesActiveFilter("ACTIVE")}
                  >
                    Ativos
                  </Button>
                  <Button
                    variant={servicesActiveFilter === "INACTIVE" ? "secondary" : "outline"}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setServicesActiveFilter("INACTIVE")}
                  >
                    Inativos
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={servicesSort} onValueChange={(v) => setServicesSort(v as any)}>
                    <SelectTrigger className="h-9 w-[140px] rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel">
                      <SelectItem value="codigo">Código</SelectItem>
                      <SelectItem value="designacao">Designação</SelectItem>
                      <SelectItem value="id">ID</SelectItem>
                    </SelectContent>
                  </Select>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        Colunas
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="glass-panel">
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowServiceIdCol((p) => !p); }}>
                        {showServiceIdCol ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} ID
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowServiceCodigoCol((p) => !p); }}>
                        {showServiceCodigoCol ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Código
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowServiceAtivoCol((p) => !p); }}>
                        {showServiceAtivoCol ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Estado
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {servicesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/60" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="hidden overflow-auto rounded-xl border border-border/60 md:block">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--surface-2)/0.95)] backdrop-blur">
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allPagedServicesSelected}
                              onCheckedChange={(v) => toggleSelectAllPagedServices(Boolean(v))}
                            />
                          </TableHead>
                          {showServiceIdCol ? <TableHead className="w-[80px]">ID</TableHead> : null}
                          {showServiceCodigoCol ? <TableHead className="w-[140px]">Código</TableHead> : null}
                          <TableHead>Designação</TableHead>
                          {showServiceAtivoCol ? <TableHead className="w-[130px]">Estado</TableHead> : null}
                          <TableHead className="w-[220px] text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedServices.map((s, idx) => {
                          const editing = inlineEditId === s.id;
                          return (
                            <TableRow key={s.id} className={idx % 2 ? "bg-[hsl(var(--surface-2)/0.28)]" : ""}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedServiceIds.includes(s.id)}
                                  onCheckedChange={(v) => {
                                    const checked = Boolean(v);
                                    setSelectedServiceIds((prev) =>
                                      checked ? Array.from(new Set([...prev, s.id])) : prev.filter((id) => id !== s.id)
                                    );
                                  }}
                                />
                              </TableCell>
                              {showServiceIdCol ? <TableCell>{s.id}</TableCell> : null}
                              {showServiceCodigoCol ? (
                                <TableCell className="font-mono text-xs">
                                  {editing ? <Input value={inlineCodigo} onChange={(e) => setInlineCodigo(e.target.value)} className="h-8 rounded-lg" /> : s.codigo}
                                </TableCell>
                              ) : null}
                              <TableCell>
                                {editing ? <Input value={inlineDesignacao} onChange={(e) => setInlineDesignacao(e.target.value)} className="h-8 rounded-lg" /> : s.designacao}
                              </TableCell>
                              {showServiceAtivoCol ? (
                                <TableCell>
                                  {editing ? (
                                    <Checkbox checked={inlineAtivo} onCheckedChange={(v) => setInlineAtivo(Boolean(v))} />
                                  ) : (
                                    <Badge variant="outline" className={s.ativo ? "border-emerald-500/30 text-emerald-700" : "border-slate-400/40 text-muted-foreground"}>
                                      {s.ativo ? "Ativo" : "Inativo"}
                                    </Badge>
                                  )}
                                </TableCell>
                              ) : null}
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  {editing ? (
                                    <>
                                      <Button size="sm" onClick={() => saveInlineEdit(s.id)} className="h-8 rounded-lg">Guardar</Button>
                                      <Button size="sm" variant="outline" onClick={cancelInlineEdit} className="h-8 rounded-lg">Cancelar</Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => startInlineEdit(s)} className="h-8 rounded-lg">Editar</Button>
                                      <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="h-8 rounded-lg">Modal</Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`h-8 rounded-lg ${s.ativo ? "border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" : ""}`}
                                        onClick={() => requestToggleAtivo(s)}
                                      >
                                        {s.ativo ? "Desativar" : "Ativar"}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-2 md:hidden">
                    {pagedServices.map((s) => (
                      <article key={s.id} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.76)] p-4 shadow-sm">
                        <div className="text-base font-semibold">{s.designacao}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Código: {s.codigo}</div>
                        <div className="mt-2">
                          <Badge variant="outline" className={s.ativo ? "border-emerald-500/30 text-emerald-700" : "border-slate-400/40 text-muted-foreground"}>
                            {s.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm" variant="outline" className="h-9 flex-1 rounded-lg" onClick={() => openEdit(s)}>Editar</Button>
                          <Button size="sm" variant="outline" className="h-9 flex-1 rounded-lg border-rose-300 text-rose-600" onClick={() => requestToggleAtivo(s)}>
                            {s.ativo ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {!filteredServices.length ? (
                    <div className="mt-3 rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
                      Sem resultados.
                    </div>
                  ) : null}
                </>
              )}

              <PaginationBar
                page={servicesPage}
                setPage={setServicesPage}
                totalPages={servicesTotalPages}
                totalItems={filteredServices.length}
              />
            </div>
          </section>
        ) : null}

        {tab === "categories" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="text-sm font-semibold">Adicionar Categoria</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <div className="text-sm text-muted-foreground">Nome</div>
                  <Input value={createCategoryName} onChange={(e) => setCreateCategoryName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button onClick={createCategory} disabled={!canCreateCategory || creatingCategory} className="h-11 rounded-xl">
                  {creatingCategory ? "A criar..." : "Adicionar"}
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input value={categoriesFilter} onChange={(e) => setCategoriesFilter(e.target.value)} className="h-10 w-full min-w-0 rounded-xl sm:max-w-sm" placeholder="Pesquisar..." />
                <Button variant="outline" onClick={loadCategories} disabled={categoriesLoading}>Recarregar</Button>
              </div>
              <div className="hidden overflow-auto rounded-xl border border-border/60 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[220px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCategories.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditCategory(c)}>Editar</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteCategory(c)}>Remover</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {pagedCategories.map((c) => (
                  <article key={c.id} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{c.id}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => openEditCategory(c)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9 rounded-lg" onClick={() => deleteCategory(c)}>
                        Remover
                      </Button>
                    </div>
                  </article>
                ))}
                {!pagedCategories.length ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                    Sem categorias.
                  </div>
                ) : null}
              </div>
              <PaginationBar page={categoriesPage} setPage={setCategoriesPage} totalPages={categoriesTotalPages} totalItems={filteredCategories.length} />
            </div>
          </section>
        ) : null}

        {tab === "suppliers" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="text-sm font-semibold">Adicionar Fornecedor</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input value={createSupplierName} onChange={(e) => setCreateSupplierName(e.target.value)} placeholder="Nome" className="h-11 rounded-xl" />
                <Input value={createSupplierNif} onChange={(e) => setCreateSupplierNif(e.target.value)} placeholder="NIF" className="h-11 rounded-xl" />
                <Input value={createSupplierEmail} onChange={(e) => setCreateSupplierEmail(e.target.value)} placeholder="Email" className="h-11 rounded-xl" />
                <Input value={createSupplierPhone} onChange={(e) => setCreateSupplierPhone(e.target.value)} placeholder="Telefone" className="h-11 rounded-xl" />
                <Input value={createSupplierContactName} onChange={(e) => setCreateSupplierContactName(e.target.value)} placeholder="Contacto" className="h-11 rounded-xl" />
                <div className="flex items-center justify-between rounded-xl border border-border/70 bg-[hsl(var(--surface-2)/0.62)] px-3 py-2">
                  <span className="text-sm">Ativo</span>
                  <Checkbox checked={createSupplierActive} onCheckedChange={(v) => setCreateSupplierActive(Boolean(v))} />
                </div>
                <div className="md:col-span-3"><Textarea value={createSupplierAddress} onChange={(e) => setCreateSupplierAddress(e.target.value)} placeholder="Morada" /></div>
                <div className="md:col-span-3"><Textarea value={createSupplierNotes} onChange={(e) => setCreateSupplierNotes(e.target.value)} placeholder="Notas" /></div>
                <div className="md:col-span-3 flex justify-end">
                  <Button onClick={createSupplier} disabled={!canCreateSupplier || creatingSupplier} className="h-11 rounded-xl">{creatingSupplier ? "A criar..." : "Adicionar"}</Button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input value={suppliersFilter} onChange={(e) => setSuppliersFilter(e.target.value)} className="h-10 w-full min-w-0 rounded-xl sm:max-w-sm" placeholder="Pesquisar..." />
                <Button variant="outline" onClick={loadSuppliers} disabled={suppliersLoading}>Recarregar</Button>
              </div>
              <div className="hidden overflow-auto rounded-xl border border-border/60 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">NIF</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedSuppliers.map((s) => {
                      const isExpanded = expandedSupplierId === s.id;
                      const providerRows = providersBySupplierId[s.id] ?? [];
                      return (
                        <Fragment key={s.id}>
                          <TableRow>
                            <TableCell className="font-mono text-xs">{s.id}</TableCell>
                            <TableCell>{s.name}</TableCell>
                            <TableCell className="hidden md:table-cell">{s.nif ?? ""}</TableCell>
                            <TableCell className="hidden lg:table-cell">{s.email ?? ""}</TableCell>
                            <TableCell className="hidden lg:table-cell">{s.phone ?? ""}</TableCell>
                            <TableCell>{s.isActive ? "Sim" : "Não"}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openCreateProviderModal(s)}>
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => openEditSupplier(s)}>
                                  Editar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void toggleSupplierProvidersExpand(s.id)}>
                                  {isExpanded ? "Ocultar" : "Prestadores"}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteSupplier(s)}>
                                  Remover
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded ? (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-[hsl(var(--surface-2)/0.35)]">
                                <div className="rounded-lg border border-border/60 bg-[hsl(var(--surface-1)/0.86)] p-3">
                                  <div className="mb-2 text-sm font-medium">
                                    Prestadores de {s.name}
                                  </div>
                                  {supplierProvidersLoading ? (
                                    <div className="text-sm text-muted-foreground">A carregar...</div>
                                  ) : providerRows.length ? (
                                    <div className="space-y-2">
                                      {providerRows.map((provider) => (
                                        <div key={provider.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                                          <div className="text-sm">
                                            <span className="font-medium">{provider.name}</span>
                                            <span className="text-muted-foreground">
                                              {provider.role ? ` · ${provider.role}` : ""}
                                              {provider.email ? ` · ${provider.email}` : ""}
                                              {provider.phone ? ` · ${provider.phone}` : ""}
                                            </span>
                                          </div>
                                          <Button size="sm" variant="destructive" onClick={() => deleteSupplierProvider(provider)}>
                                            Remover prestador
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-muted-foreground">Sem prestadores para este fornecedor.</div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {pagedSuppliers.map((s) => {
                  const isExpanded = expandedSupplierId === s.id;
                  const providerRows = providersBySupplierId[s.id] ?? [];
                  return (
                    <article key={s.id} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm">
                      <div className="text-base font-semibold">{s.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">NIF: {s.nif || "—"}</div>
                      <div className="text-xs text-muted-foreground">Email: {s.email || "—"}</div>
                      <div className="text-xs text-muted-foreground">Telefone: {s.phone || "—"}</div>
                      <div className="mt-2">
                        <Badge variant="outline" className={s.isActive ? "border-emerald-500/30 text-emerald-700" : "border-slate-400/40 text-muted-foreground"}>
                          {s.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => openCreateProviderModal(s)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => openEditSupplier(s)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => void toggleSupplierProvidersExpand(s.id)}>
                          {isExpanded ? "Ocultar" : "Prestadores"}
                        </Button>
                        <Button size="sm" variant="destructive" className="h-9 rounded-lg" onClick={() => deleteSupplier(s)}>
                          Remover
                        </Button>
                      </div>
                      {isExpanded ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-[hsl(var(--surface-2)/0.3)] p-2.5">
                          {supplierProvidersLoading ? (
                            <div className="text-sm text-muted-foreground">A carregar...</div>
                          ) : providerRows.length ? (
                            providerRows.map((provider) => (
                              <div key={provider.id} className="rounded-md border border-border/60 bg-[hsl(var(--surface-1)/0.9)] p-2.5">
                                <div className="text-sm font-medium">{provider.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {provider.role ? `${provider.role} · ` : ""}{provider.email || "sem email"}
                                </div>
                                <div className="mt-2">
                                  <Button size="sm" variant="destructive" className="h-8 rounded-md" onClick={() => deleteSupplierProvider(provider)}>
                                    Remover prestador
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-muted-foreground">Sem prestadores.</div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
                {!pagedSuppliers.length ? (
                  <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                    Sem fornecedores.
                  </div>
                ) : null}
              </div>
              <PaginationBar page={suppliersPage} setPage={setSuppliersPage} totalPages={suppliersTotalPages} totalItems={filteredSuppliers.length} />
            </div>
          </section>
        ) : null}

        {tab === "received" ? (
          <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">Estado</div>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={publicRequestsStatus}
                  onChange={(e) => setPublicRequestsStatus(e.target.value as PublicRequestStatus)}
                >
                  <option value="RECEIVED">Recebidos</option>
                  <option value="ACCEPTED">Aceites</option>
                  <option value="REJECTED">Rejeitados</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => runBackfillOwners(false)} disabled={backfillRunning}>Simular correção</Button>
                <Button variant="outline" onClick={() => runBackfillOwners(true)} disabled={backfillRunning}>Aplicar correção</Button>
                <Button variant="outline" onClick={loadPublicRequests} disabled={publicRequestsLoading}>Recarregar</Button>
              </div>
            </div>
            <div className="hidden overflow-auto rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Data</TableHead>
                    <TableHead className="w-[240px]">Serviço</TableHead>
                    <TableHead>Requerente</TableHead>
                    <TableHead className="w-[120px]">Itens</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead className="w-[260px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicRequests.map((r) => {
                    const st = formatPublicStatus(r.status);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTimePt(r.createdAt)}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{r.requestingService?.designacao ?? "(Serviço desconhecido)"}</div>
                          <div className="text-xs text-muted-foreground">{r.requestingService?.codigo ?? ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{r.requesterName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">{r.title ? r.title : r.notes ? r.notes : ""}</div>
                        </TableCell>
                        <TableCell>{r.items?.length ?? 0}</TableCell>
                        <TableCell><Badge className={st.className} variant="outline">{st.label}</Badge></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openDetails(r)}>Detalhes</Button>
                            {r.status === "RECEIVED" ? (
                              <>
                                <Button size="sm" onClick={() => openHandle("accept", r)}>Aceitar</Button>
                                <Button size="sm" variant="destructive" onClick={() => openHandle("reject", r)}>Rejeitar</Button>
                              </>
                            ) : r.status === "ACCEPTED" && r.acceptedRequest?.id ? (
                              <Button size="sm" variant="secondary" onClick={() => router.push(`/requests?focus=${r.acceptedRequest?.id}`)}>Ver requisição</Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {publicRequests.map((r) => {
                const st = formatPublicStatus(r.status);
                return (
                  <article key={r.id} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold">{r.requestingService?.designacao ?? "(Serviço desconhecido)"}</div>
                      <Badge className={st.className} variant="outline">{st.label}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatDateTimePt(r.createdAt)}</div>
                    <div className="mt-2 text-sm">{r.requesterName}</div>
                    <div className="text-xs text-muted-foreground">{r.items?.length ?? 0} item(ns)</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => openDetails(r)}>
                        Detalhes
                      </Button>
                      {r.status === "RECEIVED" ? (
                        <Button size="sm" className="h-9 rounded-lg" onClick={() => openHandle("accept", r)}>
                          Aceitar
                        </Button>
                      ) : r.status === "ACCEPTED" && r.acceptedRequest?.id ? (
                        <Button size="sm" variant="secondary" className="h-9 rounded-lg" onClick={() => router.push(`/requests?focus=${r.acceptedRequest?.id}`)}>
                          Ver requisição
                        </Button>
                      ) : (
                        <div />
                      )}
                    </div>
                    {r.status === "RECEIVED" ? (
                      <Button size="sm" variant="destructive" className="mt-2 h-9 w-full rounded-lg" onClick={() => openHandle("reject", r)}>
                        Rejeitar
                      </Button>
                    ) : null}
                  </article>
                );
              })}
              {!publicRequests.length ? (
                <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                  Sem pedidos recebidos.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {tab === "tickets" ? (
          <section className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-4">
            <div className="mb-3 grid gap-2 md:grid-cols-[1fr,1fr,160px,160px,140px]">
              <Input
                value={createTicketTitle}
                onChange={(e) => setCreateTicketTitle(e.target.value)}
                placeholder="Título do ticket"
                className="h-10"
              />
              <Input
                value={createTicketDescription}
                onChange={(e) => setCreateTicketDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                className="h-10"
              />
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={createTicketPriority}
                onChange={(e) => setCreateTicketPriority(e.target.value as typeof createTicketPriority)}
              >
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>
              <select
                className="h-10 rounded-md border bg-background px-2 text-sm"
                value={createTicketType}
                onChange={(e) => setCreateTicketType(e.target.value as typeof createTicketType)}
              >
                <option value="QUESTION">Dúvida</option>
                <option value="INCIDENT">Incidente</option>
                <option value="REQUEST">Pedido</option>
                <option value="CHANGE">Mudança</option>
              </select>
              <Button onClick={createTicket} disabled={creatingTicket || !createTicketTitle.trim()} className="h-10">
                {creatingTicket ? "A criar..." : "Novo Ticket"}
              </Button>
            </div>

            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">Estado</div>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={ticketsStatusFilter}
                  onChange={(e) => setTicketsStatusFilter(e.target.value as typeof ticketsStatusFilter)}
                >
                  <option value="ALL">Todos</option>
                  <option value="OPEN">Aberto</option>
                  <option value="IN_PROGRESS">Em progresso</option>
                  <option value="WAITING_CUSTOMER">A aguardar cliente</option>
                  <option value="ESCALATED">Escalado</option>
                  <option value="RESOLVED">Resolvido</option>
                  <option value="CLOSED">Fechado</option>
                </select>
              </div>
              <Button variant="outline" onClick={loadTickets} disabled={ticketsLoading}>
                Recarregar
              </Button>
              <Button variant="outline" onClick={runTicketSlaNow} disabled={runningTicketSla || ticketsLoading}>
                {runningTicketSla ? "A processar..." : "Executar SLA"}
              </Button>
            </div>

            <div className="hidden overflow-auto rounded-xl border border-border/60 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Nº Ticket</TableHead>
                    <TableHead>Título / Criador</TableHead>
                    <TableHead className="w-[110px]">Nível</TableHead>
                    <TableHead className="w-[140px]">Estado</TableHead>
                    <TableHead className="w-[120px]">Prioridade</TableHead>
                    <TableHead className="w-[170px]">Data</TableHead>
                    <TableHead className="w-[170px]">SLA Resolução</TableHead>
                    <TableHead className="w-[230px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedTickets.map((ticket) => {
                    const statusMeta = formatTicketStatus(ticket.status);
                    const priorityMeta = formatTicketPriority(ticket.priority);
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-mono text-xs">{ticket.code}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{ticket.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {ticket.createdBy?.name || ticket.createdBy?.email || "Sem criador"}
                            {ticket.assignedTo ? ` · ${ticket.assignedTo.name || ticket.assignedTo.email}` : " · sem responsável"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ticket.level}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusMeta.className}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorityMeta.className}>
                            {priorityMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDateTimePt(ticket.createdAt)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ticket.resolutionDueAt ? formatDateTimePt(ticket.resolutionDueAt) : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {ticket.status !== "CLOSED" ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={closingTicketId === ticket.id}
                                onClick={() => closeTicket(ticket.id)}
                              >
                                {closingTicketId === ticket.id ? "A encerrar..." : "Encerrar"}
                              </Button>
                            ) : null}
                            <Button size="sm" variant="outline" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                              Ver
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {pagedTickets.map((ticket) => {
                const statusMeta = formatTicketStatus(ticket.status);
                const priorityMeta = formatTicketPriority(ticket.priority);
                return (
                  <article key={ticket.id} className="rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm">
                    <div className="font-mono text-xs text-muted-foreground">{ticket.code}</div>
                    <div className="mt-1 text-base font-semibold">{ticket.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{ticket.createdBy?.name || ticket.createdBy?.email || "Sem criador"}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">{ticket.level}</Badge>
                      <Badge variant="outline" className={statusMeta.className}>
                        {statusMeta.label}
                      </Badge>
                      <Badge variant="outline" className={priorityMeta.className}>
                        {priorityMeta.label}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{formatDateTimePt(ticket.createdAt)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      SLA resolução: {ticket.resolutionDueAt ? formatDateTimePt(ticket.resolutionDueAt) : "-"}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => router.push(`/tickets/${ticket.id}`)}>
                        Ver ticket
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-9 rounded-lg"
                        disabled={ticket.status === "CLOSED" || closingTicketId === ticket.id}
                        onClick={() => closeTicket(ticket.id)}
                      >
                        {ticket.status === "CLOSED" ? "Encerrado" : closingTicketId === ticket.id ? "A encerrar..." : "Encerrar"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {ticketsLoading ? (
              <div className="mt-3 text-sm text-muted-foreground">A carregar tickets...</div>
            ) : null}

            {!ticketsLoading && !filteredTickets.length ? (
              <div className="mt-3 rounded-xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
                Sem tickets para os filtros selecionados.
              </div>
            ) : null}

            <PaginationBar
              page={ticketsPage}
              setPage={setTicketsPage}
              totalPages={ticketsTotalPages}
              totalItems={filteredTickets.length}
            />
          </section>
        ) : null}

        {selectedServiceIds.length > 0 && tab === "services" ? (
          <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(95vw,680px)] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-[hsl(var(--surface-1)/0.9)] px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="text-sm">
              <span className="font-semibold">{selectedServiceIds.length}</span> selecionado(s)
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-9 rounded-xl" onClick={() => bulkSetActiveServices(true)}>
                Ativar
              </Button>
              <Button variant="outline" className="h-9 rounded-xl border-rose-300 text-rose-600" onClick={() => bulkSetActiveServices(false)}>
                Desativar
              </Button>
              <Button variant="ghost" className="h-9 rounded-xl" onClick={() => setSelectedServiceIds([])}>
                Limpar
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "services" ? (
          <Button
            onClick={() => setMobileCreateOpen(true)}
            className="fixed bottom-6 right-5 z-40 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-white shadow-2xl md:hidden"
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        ) : null}

        <Dialog open={mobileCreateOpen} onOpenChange={setMobileCreateOpen}>
          <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6 md:hidden">
            <DialogHeader>
              <DialogTitle>Novo Serviço</DialogTitle>
              <DialogDescription>Criação rápida no mobile.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input value={createCodigo} onChange={(e) => setCreateCodigo(e.target.value)} placeholder="Código" />
              <Input value={createDesignacao} onChange={(e) => setCreateDesignacao(e.target.value)} placeholder="Designação" />
              <label className="flex items-center justify-between rounded-xl border border-border/70 bg-[hsl(var(--surface-2)/0.62)] px-3 py-2">
                <span className="text-sm">Ativo</span>
                <Checkbox checked={createAtivo} onCheckedChange={(v) => setCreateAtivo(Boolean(v))} />
              </label>
              <Button onClick={createService} disabled={!canCreate || creating} className="w-full">
                {creating ? "A adicionar..." : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmToggleOpen} onOpenChange={setConfirmToggleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar desativação</DialogTitle>
              <DialogDescription>
                {confirmToggleRow ? `Deseja desativar "${confirmToggleRow.designacao}"?` : ""}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmToggleOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirmToggleRow) return;
                  await toggleAtivo(confirmToggleRow);
                  setConfirmToggleOpen(false);
                  setConfirmToggleRow(null);
                }}
              >
                Desativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do pedido</DialogTitle>
              <DialogDescription>
                {detailsRow?.requestingService?.designacao ?? ""}
                {detailsRow?.createdAt ? ` • ${formatDateTimePt(detailsRow.createdAt)}` : ""}
              </DialogDescription>
            </DialogHeader>

            {detailsRow ? (
              <div className="space-y-3">
                <div className="text-sm">
                  <div>
                    <span className="text-muted-foreground">Requerente:</span> {detailsRow.requesterName}
                  </div>
                  {detailsRow.deliveryLocation ? (
                    <div>
                      <span className="text-muted-foreground">Local de entrega:</span> {detailsRow.deliveryLocation}
                    </div>
                  ) : null}
                  {detailsRow.title ? (
                    <div>
                      <span className="text-muted-foreground">Título:</span> {detailsRow.title}
                    </div>
                  ) : null}
                  {detailsRow.notes ? (
                    <div>
                      <span className="text-muted-foreground">Notas:</span> {detailsRow.notes}
                    </div>
                  ) : null}
                </div>

                {detailsRow.items.length ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-[120px]">Qtd</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailsRow.items.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell>
                              <div className="text-sm font-medium">{it.product?.name ?? it.productId}</div>
                              <div className="text-xs text-muted-foreground">{it.product?.sku ?? ""}</div>
                            </TableCell>
                            <TableCell>{it.quantity}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{it.notes ?? ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem itens.</div>
                )}

                {detailsRow.status !== "RECEIVED" ? (
                  <div className="text-sm text-muted-foreground">
                    <div>Tratado em: {detailsRow.handledAt ? formatDateTimePt(detailsRow.handledAt) : ""}</div>
                    <div>
                      Por: {detailsRow.handledBy?.name ?? ""}
                      {detailsRow.handledBy?.email ? ` (${detailsRow.handledBy.email})` : ""}
                    </div>
                    {detailsRow.handledNote ? <div>Nota: {detailsRow.handledNote}</div> : null}
                    {detailsRow.acceptedRequest?.gtmiNumber ? <div>Requisição: {detailsRow.acceptedRequest.gtmiNumber}</div> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={handleOpen} onOpenChange={setHandleOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{handleMode === "accept" ? "Aceitar pedido" : "Rejeitar pedido"}</DialogTitle>
              <DialogDescription>
                {handleRow?.requestingService?.designacao ?? ""}
                {handleRow?.requesterName ? ` • ${handleRow.requesterName}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Nota (opcional)</div>
              <Textarea value={handleNote} onChange={(e) => setHandleNote(e.target.value)} placeholder="Ex: Validado e aceite" />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setHandleOpen(false)} disabled={handling}>
                Cancelar
              </Button>
              <Button
                variant={handleMode === "accept" ? "default" : "destructive"}
                onClick={confirmHandle}
                disabled={handling}
              >
                {handling ? "A guardar..." : handleMode === "accept" ? "Aceitar" : "Rejeitar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={pinsOpen} onOpenChange={setPinsOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>PINs</DialogTitle>
              <DialogDescription>
                {pinsLink ? `${pinsLink.requestingService.designacao} (${pinsLink.requestingService.codigo})` : ""}
              </DialogDescription>
            </DialogHeader>

            {pinsLink ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <div className="text-sm font-medium">Pessoa atribuída (opcional)</div>
                    <Input value={pinLabel} onChange={(e) => setPinLabel(e.target.value)} placeholder="Ex: Ana Silva" />
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={createPin} disabled={creatingPin}>
                      {creatingPin ? "A gerar..." : "Gerar PIN"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pessoa / PIN (recente)</TableHead>
                        <TableHead className="w-[120px]">Ativo</TableHead>
                        <TableHead className="w-[180px]">Criado</TableHead>
                        <TableHead className="w-[180px]">Último uso</TableHead>
                        <TableHead className="w-[200px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(accessLinks.find((a) => a.id === pinsLink.id)?.pins ?? pinsLink.pins).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">
                            <div className="font-medium">{p.label || "-"}</div>
                            {recentPinsById[p.id] ? (
                              <div className="text-xs text-muted-foreground">
                                PIN: <span className="font-mono">{recentPinsById[p.id]}</span>
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={p.isActive}
                                onCheckedChange={(v) => setPinActive(pinsLink.id, p.id, Boolean(v))}
                              />
                              <Badge variant="outline">{p.isActive ? "Ativo" : "Inativo"}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTimePt(p.createdAt)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDateTimePt(p.lastUsedAt)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEditPin(p)}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  if (!window.confirm("Gerar um novo PIN para este registo? O PIN antigo deixará de funcionar.")) return;
                                  setEditPinId(p.id);
                                  setEditPinLabel(p.label || "");
                                  setEditPinNewValue("");
                                  setEditPinOpen(true);
                                  // user can click regenerar dentro do modal
                                }}
                              >
                                Novo PIN
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      {(accessLinks.find((a) => a.id === pinsLink.id)?.pins ?? pinsLink.pins).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-sm text-muted-foreground">
                            Sem PINs. Gere um novo PIN.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPinsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={newPinOpen} onOpenChange={setNewPinOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>PIN gerado</DialogTitle>
              <DialogDescription>Guarde este PIN agora. Por segurança, não será mostrado novamente.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 px-4 py-3">
                <div className="text-xs text-muted-foreground">PIN</div>
                <div className="font-mono text-2xl tracking-wider">{newPinValue ?? ""}</div>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(newPinValue ?? "");
                    toast({ title: "Copiado" });
                  } catch {
                    toast({ title: "Erro", description: "Não foi possível copiar.", variant: "destructive" });
                  }
                }}
              >
                Copiar PIN
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={() => setNewPinOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editPinOpen} onOpenChange={setEditPinOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar PIN</DialogTitle>
              <DialogDescription>
                Atualize o nome atribuído e/ou defina um novo PIN. O PIN em plaintext só será mostrado uma vez.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Pessoa atribuída</div>
                <Input value={editPinLabel} onChange={(e) => setEditPinLabel(e.target.value)} placeholder="Ex: Ana Silva" />
              </div>

              <div className="space-y-1">
                <div className="text-sm font-medium">Novo PIN (opcional)</div>
                <Input
                  value={editPinNewValue}
                  onChange={(e) => setEditPinNewValue(e.target.value)}
                  placeholder="Deixe vazio para não alterar"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => savePin("label")} disabled={savingPin || !editPinId}>
                  {savingPin ? "A guardar..." : "Guardar nome"}
                </Button>
                <Button onClick={() => savePin("set")} disabled={savingPin || !editPinId}>
                  {savingPin ? "A guardar..." : "Guardar e definir PIN"}
                </Button>
                <Button variant="secondary" onClick={() => savePin("regen")} disabled={savingPin || !editPinId}>
                  {savingPin ? "A gerar..." : "Gerar novo PIN"}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPinOpen(false)} disabled={savingPin}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Editar serviço requisitante</DialogTitle>
              <DialogDescription>Alterações refletem nos formulários e nas requisições/faturas.</DialogDescription>
            </DialogHeader>

            {editRow ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Código</div>
                  <Input value={editRow.codigo} onChange={(e) => setEditRow((p) => (p ? { ...p, codigo: e.target.value } : p))} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Ativo</div>
                  <div className="flex items-center gap-2 h-11">
                    <Checkbox
                      checked={editRow.ativo}
                      onCheckedChange={(v) => setEditRow((p) => (p ? { ...p, ativo: Boolean(v) } : p))}
                    />
                    <div className="text-sm">{editRow.ativo ? "Sim" : "Não"}</div>
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Designação</div>
                  <Input
                    value={editRow.designacao}
                    onChange={(e) => setEditRow((p) => (p ? { ...p, designacao: e.target.value } : p))}
                  />
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={!editRow || saving}>
                {saving ? "A guardar..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editCategoryOpen} onOpenChange={setEditCategoryOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Editar categoria</DialogTitle>
              <DialogDescription>Altera o nome da categoria.</DialogDescription>
            </DialogHeader>

            {editCategory ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Nome</div>
                <Input value={editCategory.name} onChange={(e) => setEditCategory((p) => (p ? { ...p, name: e.target.value } : p))} />
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditCategoryOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveCategory} disabled={!editCategory || savingCategory}>
                {savingCategory ? "A guardar..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editSupplierOpen} onOpenChange={setEditSupplierOpen}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Editar fornecedor</DialogTitle>
              <DialogDescription>Atualiza os dados mínimos recomendados do fornecedor.</DialogDescription>
            </DialogHeader>

            {editSupplier ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Nome</div>
                  <Input value={editSupplier.name} onChange={(e) => setEditSupplier((p) => (p ? { ...p, name: e.target.value } : p))} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">NIF</div>
                  <Input value={editSupplier.nif ?? ""} onChange={(e) => setEditSupplier((p) => (p ? { ...p, nif: e.target.value } : p))} />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium">Telefone</div>
                  <Input value={editSupplier.phone ?? ""} onChange={(e) => setEditSupplier((p) => (p ? { ...p, phone: e.target.value } : p))} />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Email</div>
                  <Input value={editSupplier.email ?? ""} onChange={(e) => setEditSupplier((p) => (p ? { ...p, email: e.target.value } : p))} />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Contacto</div>
                  <Input value={editSupplier.contactName ?? ""} onChange={(e) => setEditSupplier((p) => (p ? { ...p, contactName: e.target.value } : p))} />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Morada</div>
                  <Textarea
                    value={editSupplier.address ?? ""}
                    onChange={(e) => setEditSupplier((p) => (p ? { ...p, address: e.target.value } : p))}
                    className="min-h-[90px]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Notas</div>
                  <Textarea
                    value={editSupplier.notes ?? ""}
                    onChange={(e) => setEditSupplier((p) => (p ? { ...p, notes: e.target.value } : p))}
                    className="min-h-[90px]"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="text-sm font-medium">Ativo</div>
                  <div className="flex items-center gap-2 h-11">
                    <Checkbox
                      checked={Boolean(editSupplier.isActive)}
                      onCheckedChange={(v) => setEditSupplier((p) => (p ? { ...p, isActive: Boolean(v) } : p))}
                    />
                    <div className="text-sm">{editSupplier.isActive ? "Sim" : "Não"}</div>
                  </div>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSupplierOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveSupplier} disabled={!editSupplier || savingSupplier}>
                {savingSupplier ? "A guardar..." : "Guardar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={providerModalOpen} onOpenChange={setProviderModalOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] max-h-[92dvh] overflow-hidden rounded-2xl border-border/70 bg-white p-0 sm:max-w-[720px]">
            <div className="flex max-h-[92dvh] flex-col">
              <div className="border-b border-border/60 bg-white px-4 py-3 sm:px-6">
                <DialogHeader>
                  <DialogTitle>Criar prestador</DialogTitle>
                  <DialogDescription>
                    {providerSupplier ? `Fornecedor: ${providerSupplier.name}` : "Selecione um fornecedor."}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-sm font-medium">Nome</div>
                    <Input
                      value={createProviderName}
                      onChange={(e) => setCreateProviderName(e.target.value)}
                      placeholder="Nome do prestador"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Função</div>
                    <Input
                      value={createProviderRole}
                      onChange={(e) => setCreateProviderRole(e.target.value)}
                      placeholder="Ex: Técnico"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Telefone</div>
                    <Input
                      value={createProviderPhone}
                      onChange={(e) => setCreateProviderPhone(e.target.value)}
                      placeholder="Telefone"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-sm font-medium">Email</div>
                    <Input
                      value={createProviderEmail}
                      onChange={(e) => setCreateProviderEmail(e.target.value)}
                      placeholder="Email"
                      className="h-11 rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-sm font-medium">Notas</div>
                    <Textarea
                      value={createProviderNotes}
                      onChange={(e) => setCreateProviderNotes(e.target.value)}
                      className="min-h-[110px] rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <div className="text-sm font-medium">Ativo</div>
                    <div className="flex h-11 items-center gap-2 rounded-xl border border-border/60 px-3">
                      <Checkbox checked={createProviderActive} onCheckedChange={(v) => setCreateProviderActive(Boolean(v))} />
                      <div className="text-sm">{createProviderActive ? "Sim" : "Não"}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/60 bg-white px-4 py-3 sm:px-6">
                <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setProviderModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="w-full sm:w-auto" onClick={createSupplierProvider} disabled={!canCreateProvider || creatingProvider}>
                    {creatingProvider ? "A criar..." : "Criar prestador"}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
