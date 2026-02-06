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
  createdAt: string;
};

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, isAuthLoading, user } = useAuth();

  const [tab, setTab] = useState<"users" | "ip" | "storage">("users");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [creating, setCreating] = useState(false);

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

  const canCreate = useMemo(() => {
    return Boolean(name.trim()) && Boolean(email.trim()) && password.length >= 8;
  }, [name, email, password]);

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

  const [ipRequests, setIpRequests] = useState<IpRequestRow[]>([]);
  const [allowedIps, setAllowedIps] = useState<AllowedIpRow[]>([]);
  const [ipLoading, setIpLoading] = useState(false);

  const [newAllowedIp, setNewAllowedIp] = useState("");
  const [newAllowedIpNote, setNewAllowedIpNote] = useState("");
  const [creatingAllowedIp, setCreatingAllowedIp] = useState(false);
  const [approvalOverrides, setApprovalOverrides] = useState<Record<string, string>>({});

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn, isAdmin]);

  const createUser = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const payload = { name: name.trim(), email: email.trim(), password, role };
      const res = await axiosInstance.post("/admin/users", payload);
      setUsers((prev) => [res.data, ...prev]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("USER");
      toast({ title: "Utilizador criado", description: "Conta criada com sucesso." });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar o utilizador.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const updateRole = async (id: string, newRole: UserRole) => {
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
    try {
      const res = await axiosInstance.patch(`/admin/users/${id}`, { isActive });
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
      toast({ title: isActive ? "Utilizador ativado" : "Utilizador desativado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível remover.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  const createAllowedIp = async () => {
    if (!newAllowedIp.trim()) return;
    setCreatingAllowedIp(true);
    try {
      const res = await axiosInstance.post("/admin/allowed-ips", {
        ipOrCidr: newAllowedIp.trim(),
        note: newAllowedIpNote.trim() || undefined,
      });
      setAllowedIps((prev) => [res.data, ...prev]);
      setNewAllowedIp("");
      setNewAllowedIpNote("");
      toast({ title: "IP autorizado adicionado" });
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível adicionar o IP.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setCreatingAllowedIp(false);
    }
  };

  const updateAllowedIp = async (id: string, patch: Partial<Pick<AllowedIpRow, "ipOrCidr" | "isActive" | "note">>) => {
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
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="ip">IP Access</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Criar utilizador"
                description="Cria contas internas (o registo público está desativado)."
              >
                <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Input
                  placeholder="Password (min 8)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">USER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex justify-end">
                  <Button onClick={createUser} disabled={!canCreate || creating}>
                    {creating ? "A criar..." : "Criar"}
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="Utilizadores" description="Lista de contas no sistema.">
                {loading ? (
                  <p className="text-sm text-muted-foreground">A carregar...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem utilizadores.</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div key={u.id} className="border rounded-md p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {u.name}{" "}
                              {!u.isActive ? (
                                <span className="text-xs text-muted-foreground">(inativo)</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                          </div>

                          <div className="flex items-center gap-2">
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
                              {u.isActive ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="ip" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard
                title="Pedidos pendentes"
                description="Pedidos automáticos criados quando alguém tenta entrar de um IP não autorizado."
              >
                {ipLoading ? (
                  <p className="text-sm text-muted-foreground">A carregar...</p>
                ) : ipRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem pedidos pendentes.</p>
                ) : (
                  <div className="space-y-3">
                    {ipRequests.map((r) => (
                      <div key={r.id} className="border rounded-md p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.email}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              IP: {r.ip} · {new Date(r.createdAt).toLocaleString()}
                            </div>
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
                      <div key={row.id} className="border rounded-md p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{row.ipOrCidr}</div>
                            {row.note ? (
                              <div className="text-xs text-muted-foreground truncate">{row.note}</div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={row.isActive}
                              onCheckedChange={(v) => updateAllowedIp(row.id, { isActive: Boolean(v) })}
                            />
                            <span className="text-xs text-muted-foreground">Ativo</span>
                          </div>
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
                        toast({ title: "Dry-run concluído" });
                      } catch (error: any) {
                        const msg = error?.response?.data?.error || "Não foi possível executar.";
                        toast({ title: "Erro", description: msg, variant: "destructive" });
                      } finally {
                        setReorgLoading(false);
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
                        toast({ title: "Reorganização aplicada" });
                      } catch (error: any) {
                        const msg = error?.response?.data?.error || "Não foi possível executar.";
                        toast({ title: "Erro", description: msg, variant: "destructive" });
                      } finally {
                        setReorgLoading(false);
                      }
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="Resultado" description="Resumo e preview (até 200 linhas).">
                {!reorgResult ? (
                  <p className="text-sm text-muted-foreground">Sem dados. Execute um Dry-run.</p>
                ) : (
                  <div className="space-y-3">
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
      </div>
    </AuthenticatedLayout>
  );
}
