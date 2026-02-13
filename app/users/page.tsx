"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Database, HardDrive, Network, ShieldCheck, UserCog, Users } from "lucide-react";

type UserRole = "USER" | "ADMIN";

type UserRow = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  mustChangePassword?: boolean;
  requestingServiceId?: number | null;
  requestingService?: { id: number; codigo: string; designacao: string } | null;
};

type IpAccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

type IpRequestRow = {
  id: string;
  email: string;
  ip: string;
  userAgent?: string | null;
  status: IpAccessRequestStatus;
  createdAt: string;
  reviewedAt?: string | null;
  note?: string | null;
};

type AllowedIpRow = {
  id: string;
  ipOrCidr: string;
  isActive: boolean;
  note?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

type UserAuditRow = {
  id: string;
  action: string;
  note?: string | null;
  payload?: any;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
  targetUser?: { id: string; name: string; email: string } | null;
};

function classifyIpRisk(ip: string, userAgent?: string | null) {
  const v = ip.trim();
  const isPrivate =
    v.startsWith("10.") ||
    v.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(v) ||
    v === "127.0.0.1" ||
    v === "::1";
  if (isPrivate) return { label: "Baixo", className: "text-emerald-700 border-emerald-500/30" };
  if (!userAgent || userAgent.length < 12) return { label: "Alto", className: "text-rose-700 border-rose-500/30" };
  return { label: "Médio", className: "text-amber-700 border-amber-500/30" };
}

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [tab, setTab] = useState<"users" | "ip" | "storage">("users");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [userActiveFilter, setUserActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [userServiceFilter, setUserServiceFilter] = useState<string>("ALL");
  const [usersView, setUsersView] = useState<"cards" | "table">("table");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRows, setAuditRows] = useState<UserAuditRow[]>([]);
  const [auditUserName, setAuditUserName] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [creating, setCreating] = useState(false);
  const [requestingServices, setRequestingServices] = useState<{ id: number; codigo: string; designacao: string }[]>([]);
  const [requestingServiceId, setRequestingServiceId] = useState<number | null>(null);

  const isAdmin = user?.role === "ADMIN";

  type ReorgPreviewRow = {
    id: string;
    kind: string;
    from: string;
    to: string;
    action: "moved" | "skipped" | "missing" | "error";
    reason?: string;
  };

  type ReorgResult = {
    dryRun: boolean;
    tenantId: string;
    processed: number;
    moved: number;
    skipped: number;
    missing: number;
    errored: number;
    preview: ReorgPreviewRow[];
    note?: string;
  };

  const [reorgScope, setReorgScope] = useState<
    "ALL" | "REQUEST" | "INVOICE" | "DOCUMENT" | "OTHER"
  >("ALL");
  const [reorgLimit, setReorgLimit] = useState(1000);
  const [reorgIncludeUnlinked, setReorgIncludeUnlinked] = useState(true);
  const [reorgRenameFiles, setReorgRenameFiles] = useState(false);
  const [reorgLoading, setReorgLoading] = useState(false);
  const [reorgResult, setReorgResult] = useState<ReorgResult | null>(null);
  const [reorgProgressPct, setReorgProgressPct] = useState<number | null>(null);
  const [ipRequests, setIpRequests] = useState<IpRequestRow[]>([]);
  const [allowedIps, setAllowedIps] = useState<AllowedIpRow[]>([]);
  const [ipLoading, setIpLoading] = useState(false);
  const [ipSearch, setIpSearch] = useState("");
  const [newAllowedIp, setNewAllowedIp] = useState("");
  const [newAllowedIpNote, setNewAllowedIpNote] = useState("");
  const [newAllowedIpExpiresAt, setNewAllowedIpExpiresAt] = useState("");
  const [creatingAllowedIp, setCreatingAllowedIp] = useState(false);
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, string>>({});

  const canCreate = useMemo(() => {
    return Boolean(name.trim()) && Boolean(email.trim()) && password.length >= 8;
  }, [name, email, password]);

  const userStats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const active = users.filter((u) => u.isActive).length;
    const inactive = total - active;
    return { total, admins, active, inactive };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = `${u.name} ${u.email} ${u.username || ""} ${u.requestingService?.designacao || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [userSearch, users]);

  const usersAfterFilters = useMemo(() => {
    return filteredUsers.filter((u) => {
      if (userRoleFilter !== "ALL" && u.role !== userRoleFilter) return false;
      if (userActiveFilter === "ACTIVE" && !u.isActive) return false;
      if (userActiveFilter === "INACTIVE" && u.isActive) return false;
      if (userServiceFilter === "__none__" && u.requestingServiceId != null) return false;
      if (userServiceFilter !== "ALL" && userServiceFilter !== "__none__" && Number(userServiceFilter) !== u.requestingServiceId) return false;
      return true;
    });
  }, [filteredUsers, userRoleFilter, userActiveFilter, userServiceFilter]);

  const usersTotalPages = useMemo(() => Math.max(1, Math.ceil(usersAfterFilters.length / usersPageSize)), [usersAfterFilters.length, usersPageSize]);

  const usersPageItems = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return usersAfterFilters.slice(start, start + usersPageSize);
  }, [usersAfterFilters, usersPage, usersPageSize]);

  const filteredIpRequests = useMemo(() => {
    const q = ipSearch.trim().toLowerCase();
    if (!q) return ipRequests;
    return ipRequests.filter((r) => `${r.email} ${r.ip} ${r.userAgent || ""}`.toLowerCase().includes(q));
  }, [ipRequests, ipSearch]);

  const allowedIpStats = useMemo(() => {
    const total = allowedIps.length;
    const active = allowedIps.filter((r) => r.isActive).length;
    return { total, active, inactive: total - active, pending: ipRequests.length };
  }, [allowedIps, ipRequests.length]);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, userRoleFilter, userActiveFilter, userServiceFilter, usersPageSize]);

  useEffect(() => {
    if (usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [usersPage, usersTotalPages]);

  useEffect(() => {
    const allowed = new Set(usersAfterFilters.map((u) => u.id));
    setSelectedUserIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [usersAfterFilters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/users");
      setUsers(res.data || []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar utilizadores.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRequestingServices = async () => {
    try {
      const res = await axiosInstance.get("/requesting-services");
      setRequestingServices(res.data || []);
    } catch (error: any) {
      // ignore silently; optional feature
    }
  };

  const loadIpAccess = async () => {
    setIpLoading(true);
    try {
      const [reqRes, allowedRes] = await Promise.all([
        axiosInstance.get("/admin/ip-requests", { params: { status: "PENDING" } }),
        axiosInstance.get("/admin/allowed-ips"),
      ]);

      const reqRows: IpRequestRow[] = reqRes.data || [];
      setIpRequests(reqRows);
      setAllowedIps(allowedRes.data || []);

      setApprovalOverrides((prev) => {
        const next = { ...prev };
        for (const r of reqRows) {
          if (!next[r.id]) next[r.id] = r.ip;
        }
        return next;
      });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar IP Access.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setIpLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/");
      return;
    }

    loadUsers();
    loadRequestingServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin]);

  useEffect(() => {
    if (!isLoggedIn || !isAdmin) return;
    const es = new EventSource("/api/realtime/stream");
    const onDone = (evt: Event) => {
      try {
        const msg = evt as MessageEvent;
        const parsed = JSON.parse(msg.data || "{}");
        const payload = parsed?.payload;
        if (payload && typeof payload === "object") {
          setReorgResult(payload as ReorgResult);
          setReorgLoading(false);
          setReorgProgressPct(100);
        }
      } catch {
        // ignore
      }
    };
    es.addEventListener("storage.reorg.done", onDone);
    return () => {
      es.removeEventListener("storage.reorg.done", onDone);
      es.close();
    };
  }, [isLoggedIn, isAdmin]);

  const createUser = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const payload: any = { name: name.trim(), email: email.trim(), password, role };
      if (requestingServiceId) payload.requestingServiceId = Number(requestingServiceId);
      const res = await axiosInstance.post("/admin/users", payload);
      setUsers((prev) => [res.data, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("USER");
      setRequestingServiceId(null);
      toast({ title: "Utilizador criado", description: "Conta criada com sucesso." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar o utilizador.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateRole = async (id: string, newRole: UserRole) => {
    const row = users.find((u) => u.id === id);
    if (!row) return;
    if (!window.confirm(`Alterar role de "${row.name}" para ${newRole}? A sessão atual desse utilizador será terminada.`)) {
      return;
    }
    try {
      const res = await axiosInstance.patch(`/admin/users/${id}`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
      toast({ title: "Role atualizada" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const setUserActive = async (id: string, isActive: boolean) => {
    const row = users.find((u) => u.id === id);
    if (!row) return;
    const actionText = isActive ? "ativar" : "desativar";
    if (!window.confirm(`Confirmar ${actionText} "${row.name}"?`)) return;
    try {
      const res = await axiosInstance.patch(`/admin/users/${id}`, { isActive });
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
      toast({ title: isActive ? "Utilizador ativado" : "Utilizador desativado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const runBulkAction = async (action: "SET_ACTIVE" | "SET_ROLE" | "SET_MUST_CHANGE_PASSWORD", payload: Record<string, any>) => {
    if (selectedUserIds.length === 0) return;
    const count = selectedUserIds.length;
    const summary =
      action === "SET_ROLE"
        ? `mudar role de ${count} utilizador(es)`
        : action === "SET_ACTIVE"
          ? `${payload.isActive ? "ativar" : "desativar"} ${count} utilizador(es)`
          : `alterar flag de password em ${count} utilizador(es)`;
    if (!window.confirm(`Confirmar ação em lote: ${summary}?`)) return;
    setBulkLoading(true);
    try {
      await axiosInstance.post("/admin/users/bulk", {
        ids: selectedUserIds,
        action,
        ...payload,
      });
      await loadUsers();
      setSelectedUserIds([]);
      toast({ title: "Ação em lote aplicada" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível aplicar ação em lote.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const openUserAudit = async (u: UserRow) => {
    setAuditOpen(true);
    setAuditUserName(u.name);
    setAuditLoading(true);
    try {
      const res = await axiosInstance.get(`/admin/users/${u.id}/audit`);
      setAuditRows(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar histórico.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
      setAuditRows([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const createAllowedIp = async () => {
    if (!newAllowedIp.trim()) return;
    setCreatingAllowedIp(true);
    try {
      const res = await axiosInstance.post("/admin/allowed-ips", {
        ipOrCidr: newAllowedIp.trim(),
        note: newAllowedIpNote.trim() || undefined,
        expiresAt: newAllowedIpExpiresAt ? new Date(newAllowedIpExpiresAt).toISOString() : undefined,
      });
      setAllowedIps((prev) => [res.data, ...prev]);
      setNewAllowedIp("");
      setNewAllowedIpNote("");
      setNewAllowedIpExpiresAt("");
      toast({ title: "IP autorizado adicionado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível adicionar o IP.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingAllowedIp(false);
    }
  };

  const updateAllowedIp = async (id: string, patch: Partial<Pick<AllowedIpRow, "ipOrCidr" | "isActive" | "note" | "expiresAt">>) => {
    try {
      const res = await axiosInstance.patch(`/admin/allowed-ips/${id}`, patch);
      setAllowedIps((prev) => prev.map((r) => (r.id === id ? res.data : r)));
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar o IP.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const approveIpRequest = async (id: string) => {
    try {
      await axiosInstance.post(`/admin/ip-requests/${id}/approve`, {
        ipOrCidr: approvalOverrides[id]?.trim() || undefined,
      });
      setIpRequests((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Aprovado", description: "IP adicionado à allowlist." });
      await loadIpAccess();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível aprovar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const rejectIpRequest = async (id: string) => {
    try {
      await axiosInstance.post(`/admin/ip-requests/${id}/reject`, {});
      setIpRequests((prev) => prev.filter((r) => r.id !== id));
      toast({ title: "Rejeitado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível rejeitar.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Pessoas"
          description="Gestão de utilizadores e permissões (apenas ADMIN)."
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => (tab === "users" ? loadUsers() : loadIpAccess())}
                disabled={tab === "users" ? loading : ipLoading}
              >
                {(tab === "users" ? loading : ipLoading) ? "A carregar..." : "Atualizar"}
              </Button>
            </div>
          }
        />

        <Tabs
          value={tab}
          onValueChange={(v) => {
            const next = v as "users" | "ip" | "storage";
            setTab(next);
            if (next === "ip") {
              loadIpAccess();
            }
          }}
        >
          <TabsList className="h-auto flex-wrap gap-1 rounded-2xl bg-[hsl(var(--surface-2)/0.78)] p-1.5">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="ip" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              IP Access
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <HardDrive className="h-4 w-4" />
              Storage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="metric-tile">
                <div className="metric-tile-label">Total</div>
                <div className="metric-tile-value">{userStats.total}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Admins</div>
                <div className="metric-tile-value">{userStats.admins}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Ativos</div>
                <div className="metric-tile-value">{userStats.active}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Inativos</div>
                <div className="metric-tile-value">{userStats.inactive}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
              <SectionCard
                title="Criar utilizador"
                description="Cria contas internas (o registo público está desativado)."
              >
                <div className="space-y-2">
                  <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <Input
                    placeholder="Password (min 8)"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Select
                    value={requestingServiceId ? String(requestingServiceId) : "__none__"}
                    onValueChange={(v) => setRequestingServiceId(v === "__none__" ? null : Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Serviço requisitante (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {requestingServices.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {`${s.codigo} - ${s.designacao}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end mt-3">
                  <Button onClick={createUser} disabled={!canCreate || creating}>
                    {creating ? "A criar..." : "Criar"}
                  </Button>
                </div>
              </SectionCard>

              <SectionCard
                title="Utilizadores"
                description="Lista de contas no sistema."
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={usersView === "table" ? "default" : "outline"} onClick={() => setUsersView("table")}>
                      Compacto
                    </Button>
                    <Button size="sm" variant={usersView === "cards" ? "default" : "outline"} onClick={() => setUsersView("cards")}>
                      Cards
                    </Button>
                  </div>
                }
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                  <Input
                    className="md:col-span-2"
                    placeholder="Pesquisar utilizador..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <Select value={userRoleFilter} onValueChange={(v) => setUserRoleFilter(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todas as roles</SelectItem>
                      <SelectItem value="USER">USER</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={userActiveFilter} onValueChange={(v) => setUserActiveFilter(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="ACTIVE">Ativos</SelectItem>
                      <SelectItem value="INACTIVE">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <Select value={userServiceFilter} onValueChange={setUserServiceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Serviço requisitante" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os serviços</SelectItem>
                      <SelectItem value="__none__">Sem serviço</SelectItem>
                      {requestingServices.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {`${s.codigo} - ${s.designacao}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-sm text-muted-foreground flex items-center justify-end">
                    {usersAfterFilters.length} resultado(s)
                  </div>
                </div>

                {selectedUserIds.length > 0 ? (
                  <div className="mb-3 rounded-md border border-primary/30 bg-primary/5 p-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm">{selectedUserIds.length} selecionado(s)</span>
                    <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("SET_ACTIVE", { isActive: true })}>
                      Ativar
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("SET_ACTIVE", { isActive: false })}>
                      Desativar
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("SET_ROLE", { role: "USER" })}>
                      Role USER
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("SET_ROLE", { role: "ADMIN" })}>
                      Role ADMIN
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => runBulkAction("SET_MUST_CHANGE_PASSWORD", { mustChangePassword: true })}>
                      Forçar troca password
                    </Button>
                    <Button size="sm" variant="ghost" disabled={bulkLoading} onClick={() => setSelectedUserIds([])}>
                      Limpar
                    </Button>
                  </div>
                ) : null}

                {loading ? (
                  <p className="text-sm text-muted-foreground">A carregar...</p>
                ) : usersPageItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem utilizadores.</p>
                ) : usersView === "table" ? (
                  <div className="data-grid-shell">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-2)/0.95)] backdrop-blur">
                        <tr>
                          <th className="h-[var(--table-head-h)] w-10 px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            <Checkbox
                              checked={usersPageItems.every((u) => selectedUserIds.includes(u.id))}
                              onCheckedChange={(v) => {
                                if (v) {
                                  setSelectedUserIds((prev) => Array.from(new Set([...prev, ...usersPageItems.map((u) => u.id)])));
                                } else {
                                  const remove = new Set(usersPageItems.map((u) => u.id));
                                  setSelectedUserIds((prev) => prev.filter((id) => !remove.has(id)));
                                }
                              }}
                            />
                          </th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nome</th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Email</th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Serviço</th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Role</th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estado</th>
                          <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-right text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersPageItems.map((u) => (
                          <tr key={u.id} className="border-t border-border/50 transition-colors hover:bg-[hsl(var(--surface-2)/0.42)]">
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">
                              <Checkbox
                                checked={selectedUserIds.includes(u.id)}
                                onCheckedChange={(v) =>
                                  setSelectedUserIds((prev) =>
                                    v ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id)
                                  )
                                }
                              />
                            </td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">{u.name}</td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">{u.email}</td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">{u.requestingService ? `${u.requestingService.codigo} - ${u.requestingService.designacao}` : "—"}</td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top"><Badge variant="secondary">{u.role}</Badge></td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">
                              <Badge variant="outline" className={u.isActive ? "text-emerald-700 border-emerald-400/40" : "text-amber-700 border-amber-400/40"}>
                                {u.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] align-top">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openUserAudit(u)}>
                                  Histórico
                                </Button>
                                <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as UserRole)}>
                                  <SelectTrigger className="w-[110px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="USER">USER</SelectItem>
                                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant={u.isActive ? "outline" : "default"}
                                  onClick={() => setUserActive(u.id, !u.isActive)}
                                  disabled={u.id === user?.id}
                                >
                                  {u.id === user?.id ? "Atual" : u.isActive ? "Desativar" : "Ativar"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {usersPageItems.map((u) => (
                      <div key={u.id} className="border border-border/70 rounded-xl p-3 bg-[hsl(var(--surface-1)/0.75)] transition-colors hover:bg-[hsl(var(--surface-2)/0.8)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {u.name}{" "}
                              <Badge variant="outline" className={u.isActive ? "text-emerald-700 border-emerald-400/40" : "text-amber-700 border-amber-400/40"}>
                                {u.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                              <Badge variant="secondary">{u.role}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                            {u.requestingService ? (
                              <div className="text-xs text-muted-foreground truncate">{`${u.requestingService.codigo} - ${u.requestingService.designacao}`}</div>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedUserIds.includes(u.id)}
                              onCheckedChange={(v) =>
                                setSelectedUserIds((prev) =>
                                  v ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id)
                                )
                              }
                            />
                            <Button size="sm" variant="ghost" onClick={() => openUserAudit(u)}>
                              Histórico
                            </Button>
                            <Select value={u.role} onValueChange={(v) => updateRole(u.id, v as UserRole)}>
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USER">USER</SelectItem>
                                <SelectItem value="ADMIN">ADMIN</SelectItem>
                              </SelectContent>
                            </Select>

                            <Button
                              variant={u.isActive ? "outline" : "default"}
                              onClick={() => setUserActive(u.id, !u.isActive)}
                              disabled={u.id === user?.id}
                            >
                              {u.id === user?.id ? "Atual" : u.isActive ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Por página</span>
                    <Select value={String(usersPageSize)} onValueChange={(v) => setUsersPageSize(Number(v))}>
                      <SelectTrigger className="w-[90px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setUsersPage((p) => Math.max(1, p - 1))} disabled={usersPage <= 1}>
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {usersPage} de {usersTotalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                      disabled={usersPage >= usersTotalPages}
                    >
                      Seguinte
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="ip" className="mt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="metric-tile">
                <div className="metric-tile-label">Pendentes</div>
                <div className="metric-tile-value">{allowedIpStats.pending}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Allowlist total</div>
                <div className="metric-tile-value">{allowedIpStats.total}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Ativos</div>
                <div className="metric-tile-value">{allowedIpStats.active}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Inativos</div>
                <div className="metric-tile-value">{allowedIpStats.inactive}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Pedidos pendentes"
                description="Pedidos automáticos criados quando alguém tenta entrar de um IP não autorizado."
                actions={
                  <Input
                    className="w-[260px]"
                    placeholder="Pesquisar email/IP..."
                    value={ipSearch}
                    onChange={(e) => setIpSearch(e.target.value)}
                  />
                }
              >
                {ipLoading ? (
                  <p className="text-sm text-muted-foreground">A carregar...</p>
                ) : filteredIpRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pedidos pendentes.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredIpRequests.map((r) => (
                      <div key={r.id} className="border border-border/70 rounded-xl p-3 space-y-2 bg-card/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {r.email}
                              <Badge variant="outline" className="text-amber-700 border-amber-500/30">Pendente</Badge>
                              <Badge variant="outline" className={classifyIpRisk(r.ip, r.userAgent).className}>
                                Risco: {classifyIpRisk(r.ip, r.userAgent).label}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              IP: {r.ip} · {new Date(r.createdAt).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">Geo: N/A (opcional integrar serviço externo)</div>
                            {r.userAgent ? (
                              <div className="text-xs text-muted-foreground truncate">UA: {r.userAgent}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Input
                            placeholder="Aprovar como (IP ou CIDR)"
                            value={approvalOverrides[r.id] ?? r.ip}
                            onChange={(e) =>
                              setApprovalOverrides((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => rejectIpRequest(r.id)}>
                              Rejeitar
                            </Button>
                            <Button onClick={() => approveIpRequest(r.id)}>Aprovar</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Allowlist" description="IPs/CIDRs permitidos para este tenant.">
                <div className="space-y-2">
                  <Input
                    placeholder="Adicionar IP ou CIDR (ex: 203.0.113.10 ou 203.0.113.0/24)"
                    value={newAllowedIp}
                    onChange={(e) => setNewAllowedIp(e.target.value)}
                  />
                  <Input
                    placeholder="Nota (opcional)"
                    value={newAllowedIpNote}
                    onChange={(e) => setNewAllowedIpNote(e.target.value)}
                  />
                  <Input
                    type="date"
                    placeholder="Expira em (opcional)"
                    value={newAllowedIpExpiresAt}
                    onChange={(e) => setNewAllowedIpExpiresAt(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button onClick={createAllowedIp} disabled={!newAllowedIp.trim() || creatingAllowedIp}>
                      {creatingAllowedIp ? "A adicionar..." : "Adicionar"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {allowedIps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem IPs autorizados.</p>
                  ) : (
                    allowedIps.map((row) => (
                      <div key={row.id} className="border border-border/70 rounded-xl p-3 bg-card/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {row.ipOrCidr}
                              <Badge variant="outline" className={row.isActive ? "text-emerald-700 border-emerald-400/40" : "text-slate-500"}>
                                {row.isActive ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>
                            {row.note ? (
                              <div className="text-xs text-muted-foreground truncate">{row.note}</div>
                            ) : null}
                            {row.expiresAt ? (
                              <div className="text-xs text-muted-foreground truncate">
                                Expira: {new Date(row.expiresAt).toLocaleDateString("pt-PT")}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground truncate">Sem expiração</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={row.isActive}
                              onCheckedChange={(v) => updateAllowedIp(row.id, { isActive: Boolean(v) })}
                            />
                            <span className="text-xs text-muted-foreground">Ativo</span>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Input
                            type="date"
                            value={row.expiresAt ? String(row.expiresAt).slice(0, 10) : ""}
                            onChange={(e) =>
                              updateAllowedIp(row.id, {
                                expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                              })
                            }
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Organizar storage"
                description="Move anexos antigos para a nova estrutura por ano/pedido/fatura. Use Dry-run primeiro para ver o que vai acontecer."
                actions={
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Database className="h-4 w-4" />
                    Ferramenta administrativa
                  </div>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={reorgScope} onValueChange={(v) => setReorgScope(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      <SelectItem value="REQUEST">Pedidos</SelectItem>
                      <SelectItem value="INVOICE">Faturas</SelectItem>
                      <SelectItem value="DOCUMENT">Documentos</SelectItem>
                      <SelectItem value="OTHER">Outros</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    placeholder="Limit (ex: 1000)"
                    value={String(reorgLimit)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setReorgLimit(n);
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={reorgIncludeUnlinked}
                      onCheckedChange={(v) => setReorgIncludeUnlinked(Boolean(v))}
                    />
                    Incluir ficheiros sem ligação (DOCUMENT/OTHER e anexos sem requestId/invoiceId)
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={reorgRenameFiles} onCheckedChange={(v) => setReorgRenameFiles(Boolean(v))} />
                    Renomear ficheiros no disco (mais legível) durante a reorganização
                  </label>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={reorgLoading}
                    onClick={async () => {
                      setReorgLoading(true);
                      setReorgProgressPct(15);
                      try {
                        const payload: any = {
                          dryRun: true,
                          limit: Math.min(Math.max(1, reorgLimit || 1000), 5000),
                          includeUnlinked: reorgIncludeUnlinked,
                          renameFiles: reorgRenameFiles,
                        };
                        if (reorgScope !== "ALL") payload.kinds = [reorgScope];

                        const res = await axiosInstance.post("/admin/storage/reorganize", payload);
                        setReorgResult(res.data || null);
                        setReorgProgressPct(100);
                        toast({ title: "Dry-run concluído" });
                      } catch (error: any) {
                        const msg = error?.response?.data?.error || "Não foi possível executar.";
                        toast({ title: "Erro", description: msg, variant: "destructive" });
                      } finally {
                        setReorgLoading(false);
                        setTimeout(() => setReorgProgressPct(null), 1200);
                      }
                    }}
                  >
                    {reorgLoading ? "A executar..." : "Dry-run"}
                  </Button>

                  <Button
                    disabled={reorgLoading}
                    onClick={async () => {
                      const ok = window.confirm(
                        "Isto vai mover ficheiros no servidor e atualizar a BD. Recomendado: correr Dry-run primeiro. Continuar?"
                      );
                      if (!ok) return;

                      setReorgLoading(true);
                      setReorgProgressPct(20);
                      try {
                        const payload: any = {
                          dryRun: false,
                          limit: Math.min(Math.max(1, reorgLimit || 1000), 5000),
                          includeUnlinked: reorgIncludeUnlinked,
                          renameFiles: reorgRenameFiles,
                        };
                        if (reorgScope !== "ALL") payload.kinds = [reorgScope];

                        const res = await axiosInstance.post("/admin/storage/reorganize", payload);
                        setReorgResult(res.data || null);
                        setReorgProgressPct(100);
                        toast({ title: "Reorganização aplicada" });
                      } catch (error: any) {
                        const msg = error?.response?.data?.error || "Não foi possível executar.";
                        toast({ title: "Erro", description: msg, variant: "destructive" });
                      } finally {
                        setReorgLoading(false);
                        setTimeout(() => setReorgProgressPct(null), 1200);
                      }
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="Resultado" description="Resumo e preview (até 200 linhas).">
                {reorgProgressPct !== null ? (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso</span>
                      <span>{Math.round(reorgProgressPct)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, reorgProgressPct))}%` }} />
                    </div>
                  </div>
                ) : null}
                {!reorgResult ? (
                  <p className="text-sm text-muted-foreground">Sem dados. Execute um Dry-run.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Processados</div>
                        <div className="font-semibold">{reorgResult.processed}</div>
                      </div>
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Movidos</div>
                        <div className="font-semibold text-emerald-700">{reorgResult.moved}</div>
                      </div>
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Ignorados</div>
                        <div className="font-semibold">{reorgResult.skipped}</div>
                      </div>
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Erros</div>
                        <div className="font-semibold text-rose-700">{reorgResult.errored}</div>
                      </div>
                    </div>
                    <div className="text-sm">
                      <div>
                        <span className="font-medium">Modo:</span> {reorgResult.dryRun ? "Dry-run" : "Aplicado"}
                      </div>
                      <div>
                        <span className="font-medium">Processados:</span> {reorgResult.processed} ·{" "}
                        <span className="font-medium">Movidos:</span> {reorgResult.moved} ·{" "}
                        <span className="font-medium">Ignorados:</span> {reorgResult.skipped} ·{" "}
                        <span className="font-medium">Em falta:</span> {reorgResult.missing} ·{" "}
                        <span className="font-medium">Erros:</span> {reorgResult.errored}
                      </div>
                      {reorgResult.note ? (
                        <div className="text-xs text-muted-foreground mt-1">{reorgResult.note}</div>
                      ) : null}
                    </div>

                    <div className="flex justify-end">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(JSON.stringify(reorgResult, null, 2));
                              toast({ title: "Copiado" });
                            } catch {
                              toast({
                                title: "Erro",
                                description: "Não foi possível copiar.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Copiar JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(reorgResult, null, 2)], { type: "application/json" });
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(blob);
                            a.download = `storage-reorg-${new Date().toISOString().slice(0, 10)}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }}
                        >
                          Exportar JSON
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-md p-2 max-h-[420px] overflow-auto text-xs">
                      {reorgResult.preview?.length ? (
                        <div className="space-y-1">
                          {reorgResult.preview.map((row) => (
                            <div key={row.id} className="break-all">
                              <span className="font-medium">[{row.action}]</span> {row.kind} · {row.from} → {row.to}
                              {row.reason ? (
                                <span className="text-muted-foreground"> ({row.reason})</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Sem preview.</p>
                      )}
                    </div>
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Histórico de alterações: {auditUserName || "Utilizador"}</DialogTitle>
            </DialogHeader>
            {auditLoading ? (
              <p className="text-sm text-muted-foreground">A carregar...</p>
            ) : auditRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registos.</p>
            ) : (
              <div className="max-h-[60vh] overflow-auto space-y-2 pr-1">
                {auditRows.map((row) => (
                  <div key={row.id} className="rounded-md border border-border/60 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm">{row.action}</div>
                      <div className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Por: {row.actor?.name || row.actor?.email || "Sistema"}
                    </div>
                    {row.note ? <div className="text-sm mt-1">{row.note}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
