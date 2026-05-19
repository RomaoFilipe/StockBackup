"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, RefreshCcw, Search, UserRound } from "lucide-react";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import EmptyState from "@/app/components/EmptyState";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { useAuth } from "@/app/authContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type UserDto = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  isActive?: boolean;
};

type PersonReport = {
  generatedAt: string;
  person: {
    id: string;
    name: string;
    email: string;
    role: string;
    requestingService?: string | null;
  };
  summary: {
    currentUnitCount: number;
    currentAggregateProductCount: number;
    movementsCount: number;
    requestsCount: number;
  };
  currentUnits: Array<{
    id: string;
    code: string;
    status: string;
    serialNumber?: string | null;
    assetTag?: string | null;
    acquiredAt?: string | null;
    product?: {
      name: string;
      sku: string;
      category?: { name: string } | null;
      supplier?: { name: string } | null;
    } | null;
    invoice?: { invoiceNumber?: string | null; reqNumber?: string | null } | null;
  }>;
  currentAggregates: Array<{
    productId: string;
    productName: string;
    sku: string;
    currentQuantity: number;
    totalDelivered: number;
    totalReturned: number;
  }>;
  movements: Array<{
    id: string;
    type: string;
    quantity: number;
    createdAt: string;
    reason?: string | null;
    notes?: string | null;
    product?: { name: string; sku: string } | null;
    unit?: { code: string; serialNumber?: string | null; assetTag?: string | null } | null;
    invoice?: { invoiceNumber?: string | null; reqNumber?: string | null } | null;
    request?: { gtmiNumber?: string | null; status?: string | null; title?: string | null } | null;
  }>;
  requests: Array<{
    id: string;
    gtmiNumber: string;
    status: string;
    requestType: string;
    title?: string | null;
    requestedAt: string;
    pickupSignedAt?: string | null;
    items: Array<{
      quantity: number;
      destination?: string | null;
      role: string;
      product?: { name: string; sku: string } | null;
      reservedUnit?: { code: string } | null;
    }>;
  }>;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-PT");
};

const typeLabel: Record<string, string> = {
  IN: "Entrada",
  OUT: "Entrega",
  RETURN: "Devolução",
  REPAIR_OUT: "Reparação",
  REPAIR_IN: "Receção",
  SCRAP: "Abate",
  LOST: "Perdido",
};

export default function PersonReportPage() {
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [query, setQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [report, setReport] = useState<PersonReport | null>(null);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(needle));
  }, [query, users]);

  const loadUsers = async () => {
    if (!isLoggedIn) return;
    setLoadingUsers(true);
    try {
      const res = await axiosInstance.get<UserDto[]>("/users");
      const list = (res.data || []).sort((a, b) => a.name.localeCompare(b.name, "pt"));
      setUsers(list);
      setSelectedUserId((current) => current || list[0]?.id || user?.id || "");
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.response?.data?.error || "Não foi possível carregar utilizadores.",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReport = async (userId = selectedUserId) => {
    if (!userId) return;
    setLoadingReport(true);
    try {
      const res = await axiosInstance.get<PersonReport>("/reports/person-assets", {
        params: { userId },
      });
      setReport(res.data);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.response?.data?.error || "Não foi possível gerar relatório.",
        variant: "destructive",
      });
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && isLoggedIn) {
      void loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, isLoggedIn]);

  useEffect(() => {
    if (selectedUserId) {
      void loadReport(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const exportCsv = () => {
    if (!selectedUserId) return;
    window.open(`/api/reports/person-assets?userId=${selectedUserId}&format=csv`, "_blank");
  };

  if (isAuthLoading) return null;

  return (
    <AuthenticatedLayout>
      <div className="space-y-5">
        <PageHeader
          title="Relatório por pessoa"
          description="Exporta o que uma pessoa tem atualmente e o histórico do material que já lhe foi entregue."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => void loadReport()} disabled={!selectedUserId || loadingReport}>
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </Button>
              <Button onClick={exportCsv} disabled={!report || loadingReport}>
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
          }
        />

        <SectionCard title="Pessoa" description="Escolhe o utilizador para consultar posse atual e histórico.">
          <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Pesquisar</div>
              <div className="flex items-center gap-2 rounded-md border border-border/80 px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nome ou email..."
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Utilizador</div>
              <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingUsers}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? "A carregar..." : "Selecionar pessoa"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        {report ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="metric-tile">
                <div className="metric-tile-label">Unidades atuais</div>
                <div className="metric-tile-value">{report.summary.currentUnitCount}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Produtos agregados</div>
                <div className="metric-tile-value">{report.summary.currentAggregateProductCount}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Movimentos</div>
                <div className="metric-tile-value">{report.summary.movementsCount}</div>
              </div>
              <div className="metric-tile">
                <div className="metric-tile-label">Pedidos</div>
                <div className="metric-tile-value">{report.summary.requestsCount}</div>
              </div>
            </div>

            <SectionCard
              title="Atualmente em posse"
              description={`${report.person.name} • ${report.person.email}${report.person.requestingService ? ` • ${report.person.requestingService}` : ""}`}
            >
              {report.currentUnits.length === 0 && report.currentAggregates.length === 0 ? (
                <EmptyState title="Sem material em posse" description="Não existem unidades ou quantidades atribuídas atualmente." />
              ) : (
                <div className="space-y-4">
                  {report.currentUnits.length > 0 ? (
                    <div className="data-grid-shell">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>QR / Unidade</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.currentUnits.map((unit) => (
                            <TableRow key={unit.id}>
                              <TableCell>
                                <div className="font-medium">{unit.product?.name || "-"}</div>
                                <div className="text-xs text-muted-foreground">{unit.product?.sku || ""}</div>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-xs">{unit.code}</div>
                                <div className="text-xs text-muted-foreground">{unit.serialNumber || unit.assetTag || ""}</div>
                              </TableCell>
                              <TableCell>{unit.product?.supplier?.name || "-"}</TableCell>
                              <TableCell>
                                <div>{unit.invoice?.invoiceNumber || "-"}</div>
                                <div className="text-xs text-muted-foreground">{unit.invoice?.reqNumber || ""}</div>
                              </TableCell>
                              <TableCell>{formatDate(unit.acquiredAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}

                  {report.currentAggregates.length > 0 ? (
                    <div className="data-grid-shell">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto sem QR</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Qtd atual</TableHead>
                            <TableHead className="text-right">Entregue</TableHead>
                            <TableHead className="text-right">Devolvido</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {report.currentAggregates.map((row) => (
                            <TableRow key={row.productId}>
                              <TableCell className="font-medium">{row.productName}</TableCell>
                              <TableCell>{row.sku}</TableCell>
                              <TableCell className="text-right">{row.currentQuantity}</TableCell>
                              <TableCell className="text-right">{row.totalDelivered}</TableCell>
                              <TableCell className="text-right">{row.totalReturned}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : null}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Histórico de movimentos" description="Entregas, devoluções e outros movimentos associados à pessoa.">
              {report.movements.length === 0 ? (
                <EmptyState title="Sem movimentos" description="Não existem movimentos associados a esta pessoa." />
              ) : (
                <div className="data-grid-shell">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>QR</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Notas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.movements.slice(0, 120).map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(movement.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{typeLabel[movement.type] || movement.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{movement.product?.name || "-"}</div>
                            <div className="text-xs text-muted-foreground">{movement.product?.sku || ""}</div>
                          </TableCell>
                          <TableCell>{movement.quantity}</TableCell>
                          <TableCell className="font-mono text-xs">{movement.unit?.code || "-"}</TableCell>
                          <TableCell>{movement.request?.gtmiNumber || "-"}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{movement.reason || movement.notes || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </SectionCard>

            <SectionCard title="Pedidos relacionados" description="Pedidos criados para esta pessoa.">
              {report.requests.length === 0 ? (
                <EmptyState title="Sem pedidos" description="Não existem pedidos registados para esta pessoa." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {report.requests.slice(0, 50).map((request) => (
                    <article key={request.id} className="rounded-lg border border-border/80 bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{request.gtmiNumber}</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatDate(request.requestedAt)}</div>
                        </div>
                        <Badge variant="outline">{request.status}</Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-sm">
                        {request.items.map((item, idx) => (
                          <div key={`${request.id}-${idx}`} className="flex justify-between gap-3 border-t border-border/60 py-1 first:border-t-0">
                            <span className="truncate">{item.product?.name || "-"}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {item.quantity} {item.reservedUnit?.code || item.destination || ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : (
          <EmptyState
            title={loadingReport ? "A gerar relatório..." : "Seleciona uma pessoa"}
            description="Depois de escolher uma pessoa, o relatório aparece aqui."
            action={<UserRound className="h-5 w-5 text-muted-foreground" />}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
