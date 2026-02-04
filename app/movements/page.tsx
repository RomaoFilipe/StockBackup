"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import PageHeader from "@/app/components/PageHeader";
import EmptyState from "@/app/components/EmptyState";
import SectionCard from "@/app/components/SectionCard";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCcw } from "lucide-react";

type UserDto = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
};

type ProductDto = {
  id: string;
  name: string;
  sku: string;
};

type StockMovement = {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  reason?: string | null;
  costCenter?: string | null;
  notes?: string | null;
  createdAt: string;

  productId: string;
  product?: ProductDto | null;

  unitId?: string | null;
  unit?: { code: string } | null;

  invoiceId?: string | null;
  invoice?: { id: string; invoiceNumber: string; reqNumber: string | null } | null;

  requestId?: string | null;
  request?: { id: string; title: string | null } | null;

  performedBy?: { id: string; name: string; email: string } | null;
  assignedTo?: { id: string; name: string; email: string } | null;
};

const downloadTextFile = (fileName: string, contents: string, mimeType: string) => {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default function MovementsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, user } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const [users, setUsers] = useState<UserDto[]>([]);
  const [asUserId, setAsUserId] = useState<string>("");

  const [products, setProducts] = useState<ProductDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState<string>("");
  const [type, setType] = useState<"" | "IN" | "OUT">("");
  const [productId, setProductId] = useState<string>("");
  const [performedByUserId, setPerformedByUserId] = useState<string>("");
  const [assignedToUserId, setAssignedToUserId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [reqNumber, setReqNumber] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const effectiveAsUserId = useMemo(() => {
    return isAdmin && asUserId ? asUserId : undefined;
  }, [isAdmin, asUserId]);

  const toIsoStart = (dateOnly: string) =>
    dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`).toISOString() : undefined;
  const toIsoEnd = (dateOnly: string) =>
    dateOnly ? new Date(`${dateOnly}T23:59:59.999Z`).toISOString() : undefined;

  const loadBootstrap = async () => {
    if (!isLoggedIn) return;

    setLoading(true);
    try {
      if (isAdmin) {
        const resUsers = await axiosInstance.get("/users");
        const list = (resUsers.data || []) as UserDto[];
        setUsers(list);
        if (!asUserId && user?.id) {
          setAsUserId(user.id);
        }
      }

      // Products list for filtering
      const resProducts = await axiosInstance.get("/products", {
        params: effectiveAsUserId ? { asUserId: effectiveAsUserId } : undefined,
      });

      const listProducts = (resProducts.data || []) as any[];
      setProducts(
        listProducts
          .map((p) => ({ id: p.id, name: p.name, sku: p.sku } as ProductDto))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      // ignore; page still works without dropdowns
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async (opts?: { reset?: boolean }) => {
    const reset = opts?.reset ?? false;
    setMovementsLoading(true);
    try {
      const response = (await axiosInstance.get(
        "/stock-movements",
        {
        params: {
          asUserId: effectiveAsUserId,
          limit: 50,
          cursor: reset ? undefined : nextCursor ?? undefined,
          q: q.trim() ? q.trim() : undefined,
          type: type || undefined,
          productId: productId || undefined,
          performedByUserId: performedByUserId || undefined,
          assignedToUserId: assignedToUserId || undefined,
            invoiceNumber: invoiceNumber.trim() ? invoiceNumber.trim() : undefined,
            reqNumber: reqNumber.trim() ? reqNumber.trim() : undefined,
            requestId: requestId.trim() && isUuid(requestId.trim()) ? requestId.trim() : undefined,
          from: from ? toIsoStart(from) : undefined,
          to: to ? toIsoEnd(to) : undefined,
        },
        }
      )) as { data: { items?: StockMovement[]; nextCursor?: string | null } };

      const incoming: StockMovement[] = response.data?.items ?? [];
      const next: string | null = response.data?.nextCursor ?? null;

      setMovements((prev) => (reset ? incoming : [...prev, ...incoming]));
      setNextCursor(next);
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível carregar movimentos.";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }

    loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, isAdmin]);

  useEffect(() => {
    // When admin changes tenant/user, refresh dropdowns + movements
    if (!isAdmin) return;
    loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asUserId]);

  useEffect(() => {
    if (!isLoggedIn) return;

    const handle = setTimeout(() => {
      setMovements([]);
      setNextCursor(null);
      loadMovements({ reset: true });
    }, 250);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoggedIn,
    effectiveAsUserId,
    q,
    type,
    productId,
    performedByUserId,
    assignedToUserId,
    invoiceNumber,
    reqNumber,
    requestId,
    from,
    to,
  ]);

  const exportCsv = async () => {
    try {
      toast({ title: "A preparar export…", description: "A carregar movimentos filtrados." });

      const all: StockMovement[] = [];
      let cursor: string | null | undefined = undefined;
      let loops = 0;
      const maxRows = 5000;

      while (loops < 100) {
        loops += 1;
        const response = (await axiosInstance.get(
          "/stock-movements",
          {
          params: {
            asUserId: effectiveAsUserId,
            limit: 100,
            cursor: cursor ?? undefined,
            q: q.trim() ? q.trim() : undefined,
            type: type || undefined,
            productId: productId || undefined,
            performedByUserId: performedByUserId || undefined,
            assignedToUserId: assignedToUserId || undefined,
              invoiceNumber: invoiceNumber.trim() ? invoiceNumber.trim() : undefined,
              reqNumber: reqNumber.trim() ? reqNumber.trim() : undefined,
              requestId: requestId.trim() && isUuid(requestId.trim()) ? requestId.trim() : undefined,
            from: from ? toIsoStart(from) : undefined,
            to: to ? toIsoEnd(to) : undefined,
          },
          }
        )) as { data: { items?: StockMovement[]; nextCursor?: string | null } };

        const items: StockMovement[] = response.data?.items ?? [];
        all.push(...items);
        cursor = response.data?.nextCursor ?? null;
        if (!cursor) break;
        if (all.length >= maxRows) break;
      }

      const rows = all.slice(0, maxRows).map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        type: m.type,
        quantity: m.quantity,
        productName: m.product?.name ?? "",
        productSku: m.product?.sku ?? "",
        unitCode: m.unit?.code ?? "",
        invoiceNumber: m.invoice?.invoiceNumber ?? "",
        reqNumber: m.invoice?.reqNumber ?? "",
        requestId: m.request?.id ?? m.requestId ?? "",
        requestTitle: m.request?.title ?? "",
        performedBy: m.performedBy?.name ?? "",
        performedByEmail: m.performedBy?.email ?? "",
        assignedTo: m.assignedTo?.name ?? "",
        assignedToEmail: m.assignedTo?.email ?? "",
        reason: m.reason ?? "",
        costCenter: m.costCenter ?? "",
        notes: m.notes ?? "",
      }));

      const csv = Papa.unparse(rows, { delimiter: ";" });
      const dateSuffix = new Date().toISOString().slice(0, 10);
      downloadTextFile(`movimentos_${dateSuffix}.csv`, csv, "text/csv;charset=utf-8");

      toast({ title: "Export concluído", description: `${rows.length} linha(s) exportadas.` });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error?.response?.data?.error || error?.message || "Falha ao exportar CSV.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <PageHeader
          title="Movimentos"
          description="Histórico global de entradas e saídas (com filtros e export CSV)."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => loadMovements({ reset: true })} disabled={movementsLoading}>
                <RefreshCcw className="h-4 w-4" />
                {movementsLoading ? "A carregar..." : "Atualizar"}
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={movementsLoading}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          }
        />

        <SectionCard title="Filtros" description="Refine por pessoa, produto, tipo e intervalo de datas.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {isAdmin ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Pessoa (tenant)</div>
                <Select value={asUserId} onValueChange={setAsUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha a pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1 lg:col-span-2">
              <div className="text-xs text-muted-foreground">Pesquisa</div>
              <Input
                placeholder="Produto, fatura, REQ, motivo, centro de custo, utilizador, QR…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Nº Fatura</div>
              <Input
                placeholder="Ex: FT-2026-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Nº REQ</div>
              <Input
                placeholder="Ex: REQ-123"
                value={reqNumber}
                onChange={(e) => setReqNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Request ID</div>
              <Input
                placeholder="UUID (opcional)"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Tipo</div>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as any)}
              >
                <option value="">Todos</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>

            <div className="space-y-1 lg:col-span-2">
              <div className="text-xs text-muted-foreground">Produto</div>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="(Todos)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">(Todos)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAdmin ? (
              <>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Por (quem executou)</div>
                  <Select value={performedByUserId} onValueChange={setPerformedByUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Todos)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(Todos)</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Atribuído a</div>
                  <Select value={assignedToUserId} onValueChange={setAssignedToUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="(Todos)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">(Todos)</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">De</div>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Até</div>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Resultados"
          description={`${movements.length} movimento(s)${nextCursor ? " • (há mais para carregar)" : ""}`}
          actions={
            nextCursor ? (
              <Button variant="outline" onClick={() => loadMovements({ reset: false })} disabled={movementsLoading}>
                Mais
              </Button>
            ) : null
          }
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">A carregar…</p>
          ) : movements.length === 0 && !movementsLoading ? (
            <EmptyState title="Sem resultados" description="Não há movimentos com estes filtros." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[165px]">Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[70px]">Tipo</TableHead>
                  <TableHead className="w-[60px]">Qtd</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Utilizadores</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const typeClass = m.type === "IN" ? "text-emerald-600" : "text-rose-600";
                  const docParts = [
                    m.invoice?.invoiceNumber ? `FT: ${m.invoice.invoiceNumber}` : null,
                    m.invoice?.reqNumber ? `REQ: ${m.invoice.reqNumber}` : null,
                    m.request
                      ? `Req: ${m.request.title?.trim() ? m.request.title : m.request.id}`
                      : m.requestId
                        ? `Req: ${m.requestId}`
                        : null,
                    m.unit?.code ? `Unidade: ${m.unit.code}` : null,
                  ].filter(Boolean);

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString("pt-PT")}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{m.product?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{m.product?.sku ?? ""}</div>
                      </TableCell>
                      <TableCell className={`font-medium ${typeClass}`}>{m.type}</TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell>
                        <div className="text-sm">{docParts.length ? docParts.join(" • ") : "—"}</div>
                        {m.unit?.code ? (
                          <div className="mt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/scan/${m.unit!.code}`)}
                            >
                              Abrir scan
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {m.performedBy ? `Por: ${m.performedBy.name}` : ""}
                          {m.assignedTo ? `${m.performedBy ? " • " : ""}Atribuído: ${m.assignedTo.name}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {m.reason ? `Motivo: ${m.reason}` : ""}
                          {m.costCenter ? `${m.reason ? " • " : ""}CC: ${m.costCenter}` : ""}
                        </div>
                        {m.notes ? <div className="text-xs">{m.notes}</div> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {movementsLoading && movements.length > 0 ? (
            <div className="mt-3 text-sm text-muted-foreground">A carregar mais…</div>
          ) : null}
        </SectionCard>
      </div>
    </AuthenticatedLayout>
  );
}
