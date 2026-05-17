"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Edit, Mail, Phone, Plus, RefreshCcw, Search, Trash2, Users } from "lucide-react";

import { useAuth } from "@/app/authContext";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import EmptyState from "@/app/components/EmptyState";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import type { Employee } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type RequestingServiceDto = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type EmployeeDraft = {
  name: string;
  email: string;
  phoneOrExtension: string;
  requestingServiceId: string;
  isActive: boolean;
};

type DepartmentDraft = {
  codigo: string;
  designacao: string;
  ativo: boolean;
};

const emptyDraft = (): EmployeeDraft => ({
  name: "",
  email: "",
  phoneOrExtension: "",
  requestingServiceId: "",
  isActive: true,
});

const emptyDepartmentDraft = (): DepartmentDraft => ({
  codigo: "",
  designacao: "",
  ativo: true,
});

const toOptionalTrimmed = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

export default function EmployeesPage() {
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<RequestingServiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentDraft>(emptyDepartmentDraft());
  const [departmentSaving, setDepartmentSaving] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  const loadData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const [employeesRes, servicesRes] = await Promise.all([
        axiosInstance.get<Employee[]>("/employees", {
          params: isAdmin ? { includeInactive: "1" } : undefined,
        }),
        axiosInstance.get<RequestingServiceDto[]>("/requesting-services", {
          params: isAdmin ? { includeInactive: "1" } : undefined,
        }),
      ]);
      setEmployees(employeesRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível carregar funcionários.";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin]);

  const filteredEmployees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return employees;
    return employees.filter((employee) => {
      const haystack = [
        employee.name,
        employee.email,
        employee.phoneOrExtension,
        employee.requestingService?.codigo,
        employee.requestingService?.designacao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [employees, query]);

  const stats = useMemo(() => {
    const employeeStats = employees.reduce(
      (acc, employee) => {
        acc.total += 1;
        if (employee.isActive !== false) acc.active += 1;
        if (employee.isActive === false) acc.inactive += 1;
        if (employee.requestingServiceId) acc.departments.add(employee.requestingServiceId);
        return acc;
      },
      { total: 0, active: 0, inactive: 0, departments: new Set<number>() }
    );
    return {
      ...employeeStats,
      totalDepartments: services.length,
      activeDepartments: services.filter((service) => service.ativo !== false).length,
    };
  }, [employees, services]);

  const openCreateDepartment = () => {
    setDepartmentDraft(emptyDepartmentDraft());
    setDepartmentDialogOpen(true);
  };

  const saveDepartment = async () => {
    if (!departmentDraft.codigo.trim() || !departmentDraft.designacao.trim()) {
      toast({
        title: "Campos em falta",
        description: "Indica o código e a designação do departamento.",
        variant: "destructive",
      });
      return;
    }

    setDepartmentSaving(true);
    try {
      await axiosInstance.post("/requesting-services", {
        codigo: departmentDraft.codigo.trim(),
        designacao: departmentDraft.designacao.trim(),
        ativo: departmentDraft.ativo,
      });
      toast({ title: "Departamento criado", description: departmentDraft.designacao.trim() });
      setDepartmentDialogOpen(false);
      setDepartmentDraft(emptyDepartmentDraft());
      await loadData();
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível criar o departamento.";
      toast({ title: "Falha ao criar", description: message, variant: "destructive" });
    } finally {
      setDepartmentSaving(false);
    }
  };

  const openCreate = () => {
    setEditingEmployee(null);
    setDraft(emptyDraft());
    setDialogOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setDraft({
      name: employee.name ?? "",
      email: employee.email ?? "",
      phoneOrExtension: employee.phoneOrExtension ?? "",
      requestingServiceId: employee.requestingServiceId ? String(employee.requestingServiceId) : "",
      isActive: employee.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const saveEmployee = async () => {
    if (!draft.name.trim() || !draft.requestingServiceId) {
      toast({
        title: "Campos em falta",
        description: "Indica o nome e o departamento.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        email: toOptionalTrimmed(draft.email),
        phoneOrExtension: toOptionalTrimmed(draft.phoneOrExtension),
        requestingServiceId: Number(draft.requestingServiceId),
        isActive: draft.isActive,
      };

      if (editingEmployee) {
        await axiosInstance.put("/employees", { id: editingEmployee.id, ...payload });
        toast({ title: "Funcionário atualizado" });
      } else {
        await axiosInstance.post("/employees", payload);
        toast({ title: "Funcionário criado" });
      }

      setDialogOpen(false);
      setEditingEmployee(null);
      setDraft(emptyDraft());
      await loadData();
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível guardar o funcionário.";
      toast({ title: "Falha ao guardar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (employee: Employee) => {
    setDeletingId(employee.id);
    try {
      await axiosInstance.delete("/employees", { data: { id: employee.id } });
      toast({ title: "Funcionário removido", description: employee.name });
      await loadData();
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível remover o funcionário.";
      toast({ title: "Falha ao remover", description: message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (isAuthLoading) return null;

  return (
    <AuthenticatedLayout>
      <div className="space-y-5">
        <PageHeader
          title="Funcionários"
          description="Lista local de funcionários/órgãos para preencher os pedidos por departamento."
          actions={
            <>
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => void loadData()}>
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
              {isAdmin ? (
                <>
                  <Button variant="outline" className="h-10 rounded-xl" onClick={openCreateDepartment}>
                    <Building2 className="h-4 w-4" />
                    Novo departamento
                  </Button>
                  <Button className="h-10 rounded-xl" onClick={openCreate}>
                    <Plus className="h-4 w-4" />
                    Novo funcionário
                  </Button>
                </>
              ) : null}
            </>
          }
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Total</div>
            <div className="mt-1 text-3xl font-semibold">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Ativos</div>
            <div className="mt-1 text-3xl font-semibold">{stats.active}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Departamentos</div>
            <div className="mt-1 text-3xl font-semibold">{stats.activeDepartments}</div>
          </div>
        </div>

        <SectionCard
          title="Departamentos"
          description="Departamentos disponíveis para associar aos funcionários e pedidos."
          actions={
            isAdmin ? (
              <Button variant="outline" className="h-10 rounded-xl" onClick={openCreateDepartment}>
                <Plus className="h-4 w-4" />
                Criar departamento
              </Button>
            ) : null
          }
        >
          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar departamentos...</div>
          ) : services.length === 0 ? (
            <EmptyState
              title="Sem departamentos"
              description="Ainda não existem departamentos disponíveis."
              action={isAdmin ? <Button onClick={openCreateDepartment}>Criar departamento</Button> : null}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <article key={service.id} className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{service.codigo}</div>
                      <h3 className="mt-1 truncate text-base font-semibold">{service.designacao}</h3>
                    </div>
                    <Badge variant="outline" className={service.ativo === false ? "text-slate-500" : "text-emerald-700"}>
                      {service.ativo === false ? "Inativo" : "Ativo"}
                    </Badge>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Lista de funcionários"
          description="Nome, mail, telefone/extensão e departamento usados no formulário de pedido."
          actions={
            <div className="flex min-w-[260px] items-center gap-2 rounded-xl border border-border/70 px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
          }
        >
          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar funcionários...</div>
          ) : filteredEmployees.length === 0 ? (
            <EmptyState
              title="Sem funcionários"
              description={query.trim() ? "Nenhum funcionário corresponde à pesquisa." : "Ainda não existem funcionários registados."}
              action={isAdmin ? <Button onClick={openCreate}>Criar funcionário</Button> : null}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredEmployees.map((employee) => (
                <article key={employee.id} className="rounded-lg border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{employee.name}</h3>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {employee.requestingService
                          ? `${employee.requestingService.codigo} - ${employee.requestingService.designacao}`
                          : "Sem departamento"}
                      </div>
                    </div>
                    <Badge variant="outline" className={employee.isActive === false ? "text-slate-500" : "text-emerald-700"}>
                      {employee.isActive === false ? "Inativo" : "Ativo"}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{employee.email || "Sem email"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span className="truncate">{employee.phoneOrExtension || "Sem telefone/extensão"}</span>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="mt-4 flex gap-2">
                      <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(employee)}>
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => void deleteEmployee(employee)}
                        isLoading={deletingId === employee.id}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
            <DialogDescription>
              Estes dados aparecem na seleção de funcionário/órgão ao criar pedidos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-medium">Nome *</div>
              <Input
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do funcionário"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Mail</div>
              <Input
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="nome@municipio.pt"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Telefone ou extensão</div>
              <Input
                value={draft.phoneOrExtension}
                onChange={(event) => setDraft((current) => ({ ...current, phoneOrExtension: event.target.value }))}
                placeholder="Ext. 123 / +351 ..."
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-medium">Departamento *</div>
              <select
                value={draft.requestingServiceId}
                onChange={(event) => setDraft((current) => ({ ...current, requestingServiceId: event.target.value }))}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecionar departamento</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.codigo} - {service.designacao}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                checked={draft.isActive}
                onCheckedChange={(value) => setDraft((current) => ({ ...current, isActive: Boolean(value) }))}
              />
              <div className="text-sm">Ativo</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveEmployee()}
              isLoading={saving}
              disabled={!draft.name.trim() || !draft.requestingServiceId || saving}
            >
              Guardar funcionário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Novo departamento</DialogTitle>
            <DialogDescription>
              Cria um departamento para associar funcionários e usar nos pedidos.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1">
              <div className="text-sm font-medium">Código *</div>
              <Input
                value={departmentDraft.codigo}
                onChange={(event) => setDepartmentDraft((current) => ({ ...current, codigo: event.target.value }))}
                placeholder="Ex: 160"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Designação *</div>
              <Input
                value={departmentDraft.designacao}
                onChange={(event) => setDepartmentDraft((current) => ({ ...current, designacao: event.target.value }))}
                placeholder="Ex: Novo Departamento"
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                checked={departmentDraft.ativo}
                onCheckedChange={(value) => setDepartmentDraft((current) => ({ ...current, ativo: Boolean(value) }))}
              />
              <div className="text-sm">Ativo</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void saveDepartment()}
              isLoading={departmentSaving}
              disabled={!departmentDraft.codigo.trim() || !departmentDraft.designacao.trim() || departmentSaving}
            >
              Guardar departamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthenticatedLayout>
  );
}
