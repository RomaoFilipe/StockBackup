"use client";

import { useEffect, useMemo, useState } from "react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "@/app/authContext";

type RbacRole = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Array<{ key: string; name: string }>;
};

type ActiveUser = {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "USER";
  requestingServiceId: number | null;
  requestingService: { id: number; codigo: string; designacao: string } | null;
};

type RequestingService = {
  id: number;
  codigo: string;
  designacao: string;
  ativo: boolean;
};

type Assignment = {
  id: string;
  isActive: boolean;
  note: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  role: { id: string; key: string; name: string };
  user: { id: string; name: string | null; email: string };
  requestingService: { id: number; codigo: string; designacao: string } | null;
  assignedBy: { id: string; name: string | null; email: string } | null;
};

type RbacPayload = {
  roles: RbacRole[];
  users: ActiveUser[];
  requestingServices: RequestingService[];
  assignments: Assignment[];
  audits: Array<{
    id: string;
    action: string;
    note: string | null;
    payload: any;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
};

type AssignmentDraft = {
  roleKey: string;
  requestingServiceId: string;
  note: string;
  startsAt: string;
  endsAt: string;
  saving: boolean;
};

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromInputToIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export default function GovernancaPermissoesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<RbacPayload>({
    roles: [],
    users: [],
    requestingServices: [],
    assignments: [],
    audits: [],
  });
  const [q, setQ] = useState("");
  const [filterUserId, setFilterUserId] = useState("all");
  const [filterRoleKey, setFilterRoleKey] = useState("all");
  const [filterActive, setFilterActive] = useState("all");

  const [userId, setUserId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [requestingServiceId, setRequestingServiceId] = useState<string>("all");
  const [note, setNote] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});

  const permissionSet = useMemo(() => {
    const direct = user?.permissions ?? [];
    const scoped = (user?.permissionGrants ?? []).map((g) => g.key);
    return new Set<string>([...direct, ...scoped]);
  }, [user?.permissionGrants, user?.permissions]);

  const canAccess = permissionSet.has("*") || permissionSet.has("users.manage");

  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [cloneFromRoleKey, setCloneFromRoleKey] = useState<string>("");
  const [creatingRole, setCreatingRole] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q.trim()) params.q = q.trim();
      if (filterUserId !== "all") params.userId = filterUserId;
      if (filterRoleKey !== "all") params.roleKey = filterRoleKey;
      if (filterActive !== "all") params.isActive = filterActive;

      const response = await axiosInstance.get<RbacPayload>("/admin/rbac/assignments", { params });
      setData(response.data);

      if (!roleKey && response.data.roles.length) {
        setRoleKey(response.data.roles[0].key);
      }
      if (!userId && response.data.users.length) {
        setUserId(response.data.users[0].id);
      }
      setAssignmentDrafts((prev) => {
        const next: Record<string, AssignmentDraft> = {};
        for (const assignment of response.data.assignments) {
          next[assignment.id] = prev[assignment.id] ?? {
            roleKey: assignment.role.key,
            requestingServiceId: assignment.requestingService ? String(assignment.requestingService.id) : "all",
            note: assignment.note ?? "",
            startsAt: toDatetimeLocal(assignment.startsAt),
            endsAt: toDatetimeLocal(assignment.endsAt),
            saving: false,
          };
          next[assignment.id].roleKey = next[assignment.id].roleKey || assignment.role.key;
          next[assignment.id].requestingServiceId =
            next[assignment.id].requestingServiceId || (assignment.requestingService ? String(assignment.requestingService.id) : "all");
          next[assignment.id].saving = false;
        }
        return next;
      });
    } catch (error: any) {
      toast({
        title: "Permissões",
        description: error?.response?.data?.error || "Falha ao carregar configurações RBAC.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function createRoleFromTemplate() {
    if (!canAccess) return;
    if (!newRoleKey.trim() || !newRoleName.trim()) {
      toast({ title: "Erro", description: "Indica Key e Nome do papel.", variant: "destructive" });
      return;
    }
    setCreatingRole(true);
    try {
      await axiosInstance.post("/admin/rbac/roles", {
        key: newRoleKey.trim().toUpperCase(),
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || null,
        cloneFromRoleKey: cloneFromRoleKey || null,
      });
      setNewRoleKey("");
      setNewRoleName("");
      setNewRoleDescription("");
      setCloneFromRoleKey("");
      await load();
      toast({ title: "Papel criado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar papel.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingRole(false);
    }
  }

  async function toggleRolePermission(role: RbacRole, permissionKey: string, enabled: boolean) {
    if (!canAccess) return;
    if (role.isSystem) {
      toast({
        title: "Papel de sistema",
        description: "Este papel não é editável. Duplica o papel e edita a cópia.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.patch(`/admin/rbac/roles/${role.id}/permissions`, { permissionKey, enabled });
      await load();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível alterar permissão.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const selectedRole = useMemo(() => data.roles.find((r) => r.key === roleKey) ?? null, [data.roles, roleKey]);
  const matrixPermissions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const role of data.roles) {
      for (const permission of role.permissions) {
        if (!byKey.has(permission.key)) byKey.set(permission.key, permission.name);
      }
    }
    return Array.from(byKey.entries()).map(([key, name]) => ({ key, name }));
  }, [data.roles]);
  const assignmentByUserId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const assignment of data.assignments) {
      if (!map.has(assignment.user.id)) map.set(assignment.user.id, assignment);
    }
    return map;
  }, [data.assignments]);
  const selectedUserAssignment = userId ? assignmentByUserId.get(userId) ?? null : null;

  async function createAssignment() {
    if (!userId || !roleKey) {
      toast({
        title: "Permissões",
        description: "Seleciona utilizador e papel.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post("/admin/rbac/assignments", {
        userId,
        roleKey,
        requestingServiceId: requestingServiceId === "all" ? null : Number(requestingServiceId),
        startsAt: fromInputToIso(startsAt),
        endsAt: fromInputToIso(endsAt),
        note: note.trim() || null,
      });

      setNote("");
      setStartsAt("");
      setEndsAt("");
      setRequestingServiceId("all");

      toast({
        title: "Permissões",
        description: "Papel atribuído com sucesso.",
      });
      await load();
    } catch (error: any) {
      toast({
        title: "Permissões",
        description: error?.response?.data?.error || "Não foi possível criar a atribuição.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function toggleAssignment(assignment: Assignment, nextActive: boolean) {
    try {
      await axiosInstance.patch("/admin/rbac/assignments", {
        assignmentId: assignment.id,
        isActive: nextActive,
      });
      await load();
    } catch (error: any) {
      toast({
        title: "Permissões",
        description: error?.response?.data?.error || "Falha ao atualizar atribuição.",
        variant: "destructive",
      });
    }
  }

  function updateDraft(assignmentId: string, patch: Partial<AssignmentDraft>) {
    setAssignmentDrafts((prev) => ({
      ...prev,
      [assignmentId]: {
        roleKey: prev[assignmentId]?.roleKey ?? "",
        requestingServiceId: prev[assignmentId]?.requestingServiceId ?? "all",
        note: prev[assignmentId]?.note ?? "",
        startsAt: prev[assignmentId]?.startsAt ?? "",
        endsAt: prev[assignmentId]?.endsAt ?? "",
        saving: prev[assignmentId]?.saving ?? false,
        ...patch,
      },
    }));
  }

  async function saveDraft(assignment: Assignment) {
    const draft = assignmentDrafts[assignment.id] ?? {
      note: assignment.note ?? "",
      roleKey: assignment.role.key,
      requestingServiceId: assignment.requestingService ? String(assignment.requestingService.id) : "all",
      startsAt: toDatetimeLocal(assignment.startsAt),
      endsAt: toDatetimeLocal(assignment.endsAt),
      saving: false,
    };

    updateDraft(assignment.id, { saving: true });
    try {
      await axiosInstance.patch("/admin/rbac/assignments", {
        assignmentId: assignment.id,
        roleKey: draft.roleKey || assignment.role.key,
        requestingServiceId: draft.requestingServiceId === "all" ? null : Number(draft.requestingServiceId),
        note: draft.note.trim() || null,
        startsAt: fromInputToIso(draft.startsAt),
        endsAt: fromInputToIso(draft.endsAt),
      });
      toast({
        title: "Permissões",
        description: "Atribuição atualizada.",
      });
      await load();
    } catch (error: any) {
      updateDraft(assignment.id, { saving: false });
      toast({
        title: "Permissões",
        description: error?.response?.data?.error || "Falha ao guardar a edição da atribuição.",
        variant: "destructive",
      });
    }
  }

  async function removeAssignment(assignment: Assignment) {
    if (!window.confirm(`Remover a atribuição de "${assignment.user.name || assignment.user.email}"?`)) return;
    try {
      await axiosInstance.delete("/admin/rbac/assignments", {
        data: { assignmentId: assignment.id },
      });
      toast({
        title: "Permissões",
        description: "Atribuição removida.",
      });
      await load();
    } catch (error: any) {
      toast({
        title: "Permissões",
        description: error?.response?.data?.error || "Falha ao remover atribuição.",
        variant: "destructive",
      });
    }
  }

  if (!canAccess) {
    return (
      <AuthenticatedLayout>
        <main className="space-y-4 p-4 sm:p-6">
          <PageHeader
            title="Permissões"
            description="Apenas administradores podem gerir papéis e permissões."
          />
        </main>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <main className="space-y-4 p-4 sm:p-6">
        <PageHeader
          title="Permissões (RBAC)"
          description="Atribui papéis por utilizador com escopo opcional por serviço requisitante."
        />

        <SectionCard
          title="Atribuição de Papel"
          description="Cada utilizador pode ter apenas um papel RBAC. Para mudar, edita a atribuição atual."
          actions={
            <Button onClick={() => void createAssignment()} disabled={saving || loading || Boolean(selectedUserAssignment)}>
              {saving ? "A guardar..." : "Atribuir papel"}
            </Button>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Utilizador</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar utilizador" />
                </SelectTrigger>
                <SelectContent>
                  {data.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {(u.name || u.email) + " • " + u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={roleKey} onValueChange={setRoleKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar papel" />
                </SelectTrigger>
                <SelectContent>
                  {data.roles.map((r) => (
                    <SelectItem key={r.id} value={r.key}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Escopo (Serviço)</Label>
              <Select value={requestingServiceId} onValueChange={setRequestingServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os serviços" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  {data.requestingServices.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.codigo} - {s.designacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo/observação" />
            </div>

            <div className="space-y-1.5">
              <Label>Início (opcional)</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Fim (opcional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          {selectedUserAssignment ? (
            <div className="mt-3 text-sm text-muted-foreground">
              Este utilizador já tem um papel atribuído. Edita o registo em Atribuições Atuais ou remove-o para criar novo.
            </div>
          ) : null}

          {selectedRole ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedRole.permissions.map((p) => (
                <Badge key={p.key} variant="secondary">
                  {p.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Atribuições Atuais"
          description={loading ? "A carregar..." : `${data.assignments.length} registos`}
          actions={
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              Atualizar
            </Button>
          }
        >
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por nome, email, papel..."
            />
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os utilizadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os utilizadores</SelectItem>
                {data.users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRoleKey} onValueChange={setFilterRoleKey}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os papéis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {data.roles.map((r) => (
                  <SelectItem key={r.id} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger>
                <SelectValue placeholder="Ativos e inativos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ativos e inativos</SelectItem>
                <SelectItem value="true">Apenas ativos</SelectItem>
                <SelectItem value="false">Apenas inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="mb-3">
            <Button size="sm" onClick={() => void load()} disabled={loading}>
              Aplicar filtros
            </Button>
          </div>
          <div className="space-y-3">
            {data.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">
                      {assignment.user.name || assignment.user.email} - {assignment.role.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {assignment.requestingService
                        ? `Escopo: ${assignment.requestingService.codigo} - ${assignment.requestingService.designacao}`
                        : "Escopo: Todos os serviços"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Início: {assignment.startsAt ? new Date(assignment.startsAt).toLocaleString() : "imediato"} |
                      Fim: {assignment.endsAt ? new Date(assignment.endsAt).toLocaleString() : "sem prazo"}
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <Select
                        value={assignmentDrafts[assignment.id]?.roleKey ?? assignment.role.key}
                        onValueChange={(value) => updateDraft(assignment.id, { roleKey: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Papel" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.roles.map((r) => (
                            <SelectItem key={r.id} value={r.key}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={assignmentDrafts[assignment.id]?.requestingServiceId ?? (assignment.requestingService ? String(assignment.requestingService.id) : "all")}
                        onValueChange={(value) => updateDraft(assignment.id, { requestingServiceId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os serviços" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os serviços</SelectItem>
                          {data.requestingServices.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.codigo} - {s.designacao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-3">
                      <Input
                        value={assignmentDrafts[assignment.id]?.note ?? assignment.note ?? ""}
                        onChange={(e) => updateDraft(assignment.id, { note: e.target.value })}
                        placeholder="Nota da atribuição"
                      />
                      <Input
                        type="datetime-local"
                        value={assignmentDrafts[assignment.id]?.startsAt ?? toDatetimeLocal(assignment.startsAt)}
                        onChange={(e) => updateDraft(assignment.id, { startsAt: e.target.value })}
                      />
                      <Input
                        type="datetime-local"
                        value={assignmentDrafts[assignment.id]?.endsAt ?? toDatetimeLocal(assignment.endsAt)}
                        onChange={(e) => updateDraft(assignment.id, { endsAt: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={assignment.isActive ? "default" : "outline"}>
                      {assignment.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void saveDraft(assignment)}
                      disabled={Boolean(assignmentDrafts[assignment.id]?.saving)}
                    >
                      {assignmentDrafts[assignment.id]?.saving ? "A guardar..." : "Guardar edição"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleAssignment(assignment, !assignment.isActive)}
                    >
                      {assignment.isActive ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void removeAssignment(assignment)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {!loading && data.assignments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem atribuições configuradas.</div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="Matriz de Permissões"
          description="Visão papel x permissão para auditoria rápida."
        >
          {canAccess ? (
            <div className="mb-4 rounded-xl border border-border/60 bg-[hsl(var(--surface-1)/0.82)] p-3">
              <div className="mb-2 text-sm font-semibold">Criar papel custom (recomendado)</div>
              <div className="grid gap-2 md:grid-cols-[220px,1fr,1fr]">
                <div>
                  <Label className="text-xs">Clonar de</Label>
                  <Select value={cloneFromRoleKey} onValueChange={setCloneFromRoleKey}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="(Opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.roles
                        .filter((r) => r.isSystem)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.key}>
                            {r.name} ({r.key})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Key (A-Z/0-9/_)</Label>
                  <Input value={newRoleKey} onChange={(e) => setNewRoleKey(e.target.value)} placeholder="EX: CUSTOM_DIVISION_HEAD" />
                </div>
                <div>
                  <Label className="text-xs">Nome</Label>
                  <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="EX: Chefe de Divisão (Custom)" />
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[1fr,160px]">
                <div>
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Input value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} placeholder="Notas sobre o papel..." />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => void createRoleFromTemplate()} disabled={creatingRole}>
                    {creatingRole ? "A criar..." : "Criar papel"}
                  </Button>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Nota: papéis <span className="font-mono">isSystem</span> são imutáveis; edita sempre um papel custom.
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left">
                  <th className="px-2 py-2 font-medium">Permissão</th>
                  {data.roles.map((role) => (
                    <th key={role.id} className="px-2 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{role.name}</span>
                        {role.isSystem ? <Badge variant="outline">Sistema</Badge> : <Badge variant="secondary">Custom</Badge>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixPermissions.map((permission) => (
                  <tr key={permission.key} className="border-b border-border/40">
                    <td className="px-2 py-2">
                      <div className="font-medium">{permission.name}</div>
                      <div className="text-xs text-muted-foreground">{permission.key}</div>
                    </td>
                    {data.roles.map((role) => {
                      const enabled = role.permissions.some((p) => p.key === permission.key);
                      return (
                        <td key={`${permission.key}-${role.id}`} className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            disabled={!canAccess || saving || role.isSystem}
                            onClick={() => void toggleRolePermission(role, permission.key, !enabled)}
                            title={
                              role.isSystem
                                ? "Papel de sistema (imutável). Cria um papel custom para editar."
                                : canAccess
                                  ? "Clicar para alternar"
                                  : "Sem permissões para editar"
                            }
                          >
                            <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Sim" : "Não"}</Badge>
                          </Button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Auditoria RBAC" description="Últimas ações de permissões e atribuições.">
          <div className="space-y-2">
            {data.audits.map((audit) => (
              <div key={audit.id} className="rounded-lg border border-border/50 p-2 text-sm">
                <div className="font-medium">{audit.action}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(audit.createdAt).toLocaleString()} • {audit.actor?.name || audit.actor?.email || "Sistema"}
                </div>
                {audit.note ? <div className="text-xs">Nota: {audit.note}</div> : null}
              </div>
            ))}
            {data.audits.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem registos de auditoria.</div>
            ) : null}
          </div>
        </SectionCard>
      </main>
    </AuthenticatedLayout>
  );
}
