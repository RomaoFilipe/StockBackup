"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Button } from "@/components/ui/button";
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

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [tab, setTab] = useState<"services" | "categories" | "suppliers">("services");

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
        </Tabs>

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
