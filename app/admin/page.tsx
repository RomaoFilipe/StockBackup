"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const [tab, setTab] = useState<"services" | "categories" | "suppliers" | "received">("services");

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "received") {
      setTab("received");
    }
  }, [searchParams]);

  const [pageSize, setPageSize] = useState<number>(25);
  const [servicesPage, setServicesPage] = useState<number>(1);
  const [categoriesPage, setCategoriesPage] = useState<number>(1);
  const [suppliersPage, setSuppliersPage] = useState<number>(1);

  const [services, setServices] = useState<RequestingServiceRow[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesFilter, setServicesFilter] = useState("");

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

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn || !isAdmin) return;
    if (tab !== "received") return;
    loadPublicRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, publicRequestsStatus, isAuthLoading, isLoggedIn, isAdmin]);

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
    if (!q) return services;
    return services.filter((s) => {
      return (
        s.codigo.toLowerCase().includes(q) ||
        s.designacao.toLowerCase().includes(q) ||
        String(s.id).includes(q)
      );
    });
  }, [services, servicesFilter]);

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

  const servicesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredServices.length / pageSize));
  }, [filteredServices.length, pageSize]);

  const categoriesTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  }, [filteredCategories.length, pageSize]);

  const suppliersTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  }, [filteredSuppliers.length, pageSize]);

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

  useEffect(() => {
    setServicesPage(1);
  }, [servicesFilter]);

  useEffect(() => {
    setCategoriesPage(1);
  }, [categoriesFilter]);

  useEffect(() => {
    setSuppliersPage(1);
  }, [suppliersFilter]);

  useEffect(() => {
    setServicesPage(1);
    setCategoriesPage(1);
    setSuppliersPage(1);
  }, [tab, pageSize]);

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
      toast({ title: "Fornecedor removido" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <PageHeader title="Gestão" description="Gerir tabelas e conteúdos (apenas ADMIN)." />

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="services">Serviços requisitantes</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
            <TabsTrigger value="received">Recebidos</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4">
            <SectionCard title="Adicionar serviço" description="Cria novas opções para aparecerem nos formulários." >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Código</div>
                  <Input value={createCodigo} onChange={(e) => setCreateCodigo(e.target.value)} placeholder="Ex: 001" />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <div className="text-sm font-medium">Designação</div>
                  <Input
                    value={createDesignacao}
                    onChange={(e) => setCreateDesignacao(e.target.value)}
                    placeholder="Ex: Informática"
                  />
                </div>

                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={createAtivo} onCheckedChange={(v) => setCreateAtivo(Boolean(v))} />
                    <div className="text-sm">Ativo</div>
                  </div>
                  <Button onClick={createService} disabled={!canCreate || creating}>
                    {creating ? "A criar..." : "Adicionar"}
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Lista" description="Editar, ativar/desativar e procurar serviços." >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                  <Input value={servicesFilter} onChange={(e) => setServicesFilter(e.target.value)} placeholder="Procurar por código, designação ou id" />
                </div>
                <Button variant="outline" onClick={loadServices} disabled={servicesLoading}>
                  {servicesLoading ? "A carregar..." : "Recarregar"}
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Designação</TableHead>
                      <TableHead className="w-[110px]">Ativo</TableHead>
                      <TableHead className="w-[220px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedServices.map((s) => (
                      <TableRow key={s.id} className={!s.ativo ? "opacity-70" : undefined}>
                        <TableCell>{s.id}</TableCell>
                        <TableCell className="font-mono text-xs">{s.codigo}</TableCell>
                        <TableCell>{s.designacao}</TableCell>
                        <TableCell>
                          <span className={s.ativo ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                            {s.ativo ? "Sim" : "Não"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={s.ativo ? "destructive" : "secondary"}
                              onClick={() => toggleAtivo(s)}
                            >
                              {s.ativo ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!servicesLoading && filteredServices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          Sem resultados.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <PaginationBar
                page={servicesPage}
                setPage={setServicesPage}
                totalPages={servicesTotalPages}
                totalItems={filteredServices.length}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <SectionCard title="Adicionar categoria" description="Categorias são usadas nos produtos." >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="space-y-1 flex-1">
                  <div className="text-sm font-medium">Nome</div>
                  <Input value={createCategoryName} onChange={(e) => setCreateCategoryName(e.target.value)} placeholder="Ex: Consumíveis" />
                </div>
                <Button onClick={createCategory} disabled={!canCreateCategory || creatingCategory}>
                  {creatingCategory ? "A criar..." : "Adicionar"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Lista" description="Editar, remover e procurar categorias." >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                  <Input value={categoriesFilter} onChange={(e) => setCategoriesFilter(e.target.value)} placeholder="Procurar por nome ou id" />
                </div>
                <Button variant="outline" onClick={loadCategories} disabled={categoriesLoading}>
                  {categoriesLoading ? "A carregar..." : "Recarregar"}
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="w-[260px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedCategories.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditCategory(c)}>
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteCategory(c)}>
                              Remover
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!categoriesLoading && filteredCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-sm text-muted-foreground">
                          Sem resultados.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <PaginationBar
                page={categoriesPage}
                setPage={setCategoriesPage}
                totalPages={categoriesTotalPages}
                totalItems={filteredCategories.length}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <SectionCard title="Adicionar fornecedor" description="Fornecedores são usados nos produtos." >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Nome</div>
                  <Input value={createSupplierName} onChange={(e) => setCreateSupplierName(e.target.value)} placeholder="Ex: HP" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">NIF</div>
                  <Input value={createSupplierNif} onChange={(e) => setCreateSupplierNif(e.target.value)} placeholder="Ex: 123456789" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Email</div>
                  <Input value={createSupplierEmail} onChange={(e) => setCreateSupplierEmail(e.target.value)} placeholder="compras@fornecedor.pt" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Telefone</div>
                  <Input value={createSupplierPhone} onChange={(e) => setCreateSupplierPhone(e.target.value)} placeholder="+351 ..." />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Contacto</div>
                  <Input value={createSupplierContactName} onChange={(e) => setCreateSupplierContactName(e.target.value)} placeholder="Nome do contacto" />
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={createSupplierActive} onCheckedChange={(v) => setCreateSupplierActive(Boolean(v))} />
                    <div className="text-sm">Ativo</div>
                  </div>
                  <Button onClick={createSupplier} disabled={!canCreateSupplier || creatingSupplier}>
                    {creatingSupplier ? "A criar..." : "Adicionar"}
                  </Button>
                </div>

                <div className="space-y-1 md:col-span-3">
                  <div className="text-sm font-medium">Morada</div>
                  <Textarea
                    value={createSupplierAddress}
                    onChange={(e) => setCreateSupplierAddress(e.target.value)}
                    placeholder="Morada completa (opcional)"
                    className="min-h-[80px]"
                  />
                </div>

                <div className="space-y-1 md:col-span-3">
                  <div className="text-sm font-medium">Notas</div>
                  <Textarea
                    value={createSupplierNotes}
                    onChange={(e) => setCreateSupplierNotes(e.target.value)}
                    placeholder="Notas internas (opcional)"
                    className="min-h-[80px]"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Lista" description="Editar, remover e procurar fornecedores." >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-sm">
                  <Input value={suppliersFilter} onChange={(e) => setSuppliersFilter(e.target.value)} placeholder="Procurar por nome ou id" />
                </div>
                <Button variant="outline" onClick={loadSuppliers} disabled={suppliersLoading}>
                  {suppliersLoading ? "A carregar..." : "Recarregar"}
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="hidden md:table-cell">NIF</TableHead>
                      <TableHead className="hidden lg:table-cell">Email</TableHead>
                      <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                      <TableHead className="w-[110px]">Ativo</TableHead>
                      <TableHead className="w-[260px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedSuppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.id}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{s.nif ?? ""}</TableCell>
                        <TableCell className="hidden lg:table-cell">{s.email ?? ""}</TableCell>
                        <TableCell className="hidden lg:table-cell">{s.phone ?? ""}</TableCell>
                        <TableCell>
                          <span className={s.isActive ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                            {s.isActive ? "Sim" : "Não"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditSupplier(s)}>
                              Editar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteSupplier(s)}>
                              Remover
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!suppliersLoading && filteredSuppliers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-sm text-muted-foreground">
                          Sem resultados.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              <PaginationBar
                page={suppliersPage}
                setPage={setSuppliersPage}
                totalPages={suppliersTotalPages}
                totalItems={filteredSuppliers.length}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="received" className="space-y-4">
            <SectionCard
              title="Recebidos"
              description="Pedidos submetidos via link público (PIN). Aceite cria uma requisição e movimenta stock; rejeite fica registado no histórico."
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
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
                  <Button
                    variant="outline"
                    onClick={() => runBackfillOwners(false)}
                    disabled={backfillRunning}
                  >
                    {backfillRunning ? "A executar..." : "Simular correção"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => runBackfillOwners(true)}
                    disabled={backfillRunning}
                  >
                    {backfillRunning ? "A aplicar..." : "Aplicar correção"}
                  </Button>
                  <Button variant="outline" onClick={loadPublicRequests} disabled={publicRequestsLoading}>
                    {publicRequestsLoading ? "A carregar..." : "Recarregar"}
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
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
                            <div className="text-sm font-medium">
                              {r.requestingService?.designacao ?? "(Serviço desconhecido)"}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.requestingService?.codigo ?? ""}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.requesterName}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                              {r.title ? r.title : r.notes ? r.notes : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{r.items?.length ?? 0}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={st.className} variant="outline">
                              {st.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                                Detalhes
                              </Button>
                              {r.status === "RECEIVED" ? (
                                <>
                                  <Button size="sm" onClick={() => openHandle("accept", r)}>
                                    Aceitar
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => openHandle("reject", r)}>
                                    Rejeitar
                                  </Button>
                                </>
                              ) : r.status === "ACCEPTED" && r.acceptedRequest?.id ? (
                                <Button size="sm" variant="secondary" onClick={() => router.push(`/requests?focus=${r.acceptedRequest?.id}`)}>
                                  Ver requisição
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!publicRequestsLoading && publicRequestsLoadedOnce && publicRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-sm text-muted-foreground">
                          Sem pedidos.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>

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
      </div>
    </AuthenticatedLayout>
  );
}
