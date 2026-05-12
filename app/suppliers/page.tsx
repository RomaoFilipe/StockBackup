"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Mail, Phone, RefreshCcw, Search, Truck } from "lucide-react";

import { useAuth } from "@/app/authContext";
import type { Product, ProductInvoice, Supplier } from "@/app/types";
import AddSupplierDialog from "@/app/AppTable/ProductDialog/AddSupplierDialog";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import EmptyState from "@/app/components/EmptyState";
import PageHeader from "@/app/components/PageHeader";
import SectionCard from "@/app/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";

type SupplierStats = {
  productCount: number;
  stockQuantity: number;
  stockValue: number;
};

type StockMovement = {
  id: string;
  type: "IN" | "OUT" | "RETURN" | "REPAIR_OUT" | "REPAIR_IN" | "SCRAP" | "LOST";
  quantity: number;
  createdAt: string;
  product?: { id: string; name: string; sku: string } | null;
  invoice?: { id: string; invoiceNumber: string; reqNumber: string | null } | null;
  request?: { id: string; title: string | null } | null;
  performedBy?: { id: string; name: string; email: string } | null;
};

type SupplierInvoice = ProductInvoice & {
  productName: string;
  productSku: string;
};

type SupplierHistory = {
  products: Product[];
  invoices: SupplierInvoice[];
  movements: StockMovement[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
  });

const csvEscape = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadCsv = (fileName: string, headers: string[], rows: Array<Array<unknown>>) => {
  const content = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "fornecedor";

export default function SuppliersPage() {
  const { isLoggedIn, isAuthLoading, user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [history, setHistory] = useState<SupplierHistory | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const loadData = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const [suppliersRes, productsRes] = await Promise.all([
        axiosInstance.get<Supplier[]>("/suppliers", {
          params: isAdmin ? { includeInactive: "1" } : undefined,
        }),
        axiosInstance.get<Product[]>("/products"),
      ]);
      setSuppliers(suppliersRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível carregar fornecedores.";
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

  const statsBySupplier = useMemo(() => {
    const map = new Map<string, SupplierStats>();
    for (const product of products) {
      if (!product.supplierId) continue;
      const current = map.get(product.supplierId) ?? {
        productCount: 0,
        stockQuantity: 0,
        stockValue: 0,
      };
      current.productCount += 1;
      current.stockQuantity += Number(product.quantity || 0);
      current.stockValue += Number(product.quantity || 0) * Number(product.price || 0);
      map.set(product.supplierId, current);
    }
    return map;
  }, [products]);

  const filteredSuppliers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) => {
      const haystack = [
        supplier.name,
        supplier.nif,
        supplier.email,
        supplier.phone,
        supplier.contactName,
        supplier.address,
        supplier.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [query, suppliers]);

  const totals = useMemo(() => {
    return suppliers.reduce(
      (acc, supplier) => {
        const stats = statsBySupplier.get(supplier.id);
        acc.total += 1;
        if (supplier.isActive !== false) acc.active += 1;
        if (supplier.isActive === false) acc.inactive += 1;
        acc.products += stats?.productCount ?? 0;
        acc.stockValue += stats?.stockValue ?? 0;
        return acc;
      },
      { total: 0, active: 0, inactive: 0, products: 0, stockValue: 0 },
    );
  }, [statsBySupplier, suppliers]);

  const exportSuppliers = () => {
    downloadCsv(
      `fornecedores-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Nome", "NIF", "Email", "Telefone", "Contacto", "Ativo", "Produtos", "Unidades", "Valor stock", "Morada", "Notas"],
      filteredSuppliers.map((supplier) => {
        const stats = statsBySupplier.get(supplier.id) ?? {
          productCount: 0,
          stockQuantity: 0,
          stockValue: 0,
        };
        return [
          supplier.name,
          supplier.nif,
          supplier.email,
          supplier.phone,
          supplier.contactName,
          supplier.isActive === false ? "Não" : "Sim",
          stats.productCount,
          stats.stockQuantity,
          stats.stockValue.toFixed(2),
          supplier.address,
          supplier.notes,
        ];
      }),
    );
  };

  const openHistory = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistory(null);
    const supplierProducts = products.filter((product) => product.supplierId === supplier.id);

    try {
      const [invoiceResults, movementResults] = await Promise.all([
        Promise.all(
          supplierProducts.map(async (product) => {
            const res = await axiosInstance.get<ProductInvoice[]>("/invoices", {
              params: { productId: product.id, take: 50 },
            });
            return (res.data || []).map((invoice) => ({
              ...invoice,
              productName: product.name,
              productSku: product.sku,
            }));
          }),
        ),
        Promise.all(
          supplierProducts.map(async (product) => {
            const res = await axiosInstance.get<{ items: StockMovement[] }>("/stock-movements", {
              params: { productId: product.id, limit: 50 },
            });
            return res.data?.items || [];
          }),
        ),
      ]);

      const invoices = invoiceResults
        .flat()
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      const movements = movementResults
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setHistory({
        products: supplierProducts,
        invoices,
        movements,
      });
    } catch (error: any) {
      const message = error?.response?.data?.error || "Não foi possível carregar o histórico do fornecedor.";
      toast({ title: "Erro", description: message, variant: "destructive" });
      setHistory({ products: supplierProducts, invoices: [], movements: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const exportSupplierHistory = () => {
    if (!selectedSupplier || !history) return;
    const base = safeFileName(selectedSupplier.name);
    const date = new Date().toISOString().slice(0, 10);
    const rows = [
      ...history.products.map((product) => [
        "Produto",
        product.name,
        product.sku,
        product.quantity,
        Number(product.price || 0).toFixed(2),
        "",
        "",
        "",
      ]),
      ...history.invoices.map((invoice) => [
        "Fatura",
        invoice.productName,
        invoice.productSku,
        invoice.quantity,
        Number(invoice.unitPrice || 0).toFixed(2),
        invoice.invoiceNumber,
        invoice.reqNumber,
        new Date(invoice.issuedAt).toLocaleDateString("pt-PT"),
      ]),
      ...history.movements.map((movement) => [
        "Movimento",
        movement.product?.name || "",
        movement.product?.sku || "",
        movement.quantity,
        movement.type,
        movement.invoice?.invoiceNumber || "",
        movement.invoice?.reqNumber || "",
        new Date(movement.createdAt).toLocaleString("pt-PT"),
      ]),
    ];

    downloadCsv(
      `historico-${base}-${date}.csv`,
      ["Tipo", "Produto", "SKU", "Quantidade", "Valor/Movimento", "Fatura", "Pedido", "Data"],
      rows,
    );
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-4">
        <PageHeader
          title="Fornecedores"
          description="Lista local de fornecedores ligados ao inventário e às entradas de material."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
              <Button variant="outline" onClick={exportSuppliers} disabled={loading || filteredSuppliers.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
              {isAdmin ? (
                <AddSupplierDialog
                  trigger={
                    <Button>
                      <Truck className="mr-2 h-4 w-4" />
                      Novo fornecedor
                    </Button>
                  }
                />
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="metric-tile">
            <div className="metric-tile-label">Fornecedores</div>
            <div className="metric-tile-value">{totals.total}</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-label">Ativos</div>
            <div className="metric-tile-value">{totals.active}</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-label">Produtos ligados</div>
            <div className="metric-tile-value">{totals.products}</div>
          </div>
          <div className="metric-tile">
            <div className="metric-tile-label">Valor em stock</div>
            <div className="metric-tile-value text-base">{formatCurrency(totals.stockValue)}</div>
          </div>
        </div>

        <SectionCard
          title="Diretório"
          description="Contactos e impacto no stock por fornecedor."
          actions={
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar fornecedor..."
                className="pl-9"
              />
            </div>
          }
        >
          {loading ? (
            <div className="text-sm text-muted-foreground">A carregar fornecedores...</div>
          ) : filteredSuppliers.length === 0 ? (
            <EmptyState
              title="Sem fornecedores"
              description={query.trim() ? "Nenhum fornecedor corresponde à pesquisa." : "Ainda não existem fornecedores registados."}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredSuppliers.map((supplier) => {
                const stats = statsBySupplier.get(supplier.id) ?? {
                  productCount: 0,
                  stockQuantity: 0,
                  stockValue: 0,
                };
                return (
                  <article key={supplier.id} className="rounded-lg border border-border/70 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-semibold">{supplier.name}</h3>
                          <Badge variant="outline" className={supplier.isActive === false ? "text-slate-500" : "text-emerald-700"}>
                            {supplier.isActive === false ? "Inativo" : "Ativo"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {supplier.nif ? `NIF: ${supplier.nif}` : "Sem NIF"}
                          {supplier.contactName ? ` · ${supplier.contactName}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Produtos</div>
                        <div className="font-semibold">{stats.productCount}</div>
                      </div>
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Unidades</div>
                        <div className="font-semibold">{stats.stockQuantity}</div>
                      </div>
                      <div className="rounded-md border border-border/60 p-2">
                        <div className="text-[11px] text-muted-foreground">Valor</div>
                        <div className="font-semibold">{formatCurrency(stats.stockValue)}</div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-sm">
                      {supplier.email ? (
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{supplier.email}</span>
                        </div>
                      ) : null}
                      {supplier.phone ? (
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span className="truncate">{supplier.phone}</span>
                        </div>
                      ) : null}
                      {supplier.address ? <div className="line-clamp-2 text-muted-foreground">{supplier.address}</div> : null}
                      {supplier.notes ? <div className="line-clamp-2 text-xs text-muted-foreground">{supplier.notes}</div> : null}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => void openHistory(supplier)}>
                        <FileText className="mr-2 h-4 w-4" />
                        Histórico
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Histórico do fornecedor</DialogTitle>
              <DialogDescription>
                {selectedSupplier ? selectedSupplier.name : "Fornecedor"} · produtos, faturas e movimentos ligados ao stock.
              </DialogDescription>
            </DialogHeader>

            {historyLoading ? (
              <div className="text-sm text-muted-foreground">A carregar histórico...</div>
            ) : history ? (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border/60 p-2">
                    <div className="text-[11px] text-muted-foreground">Produtos</div>
                    <div className="font-semibold">{history.products.length}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-2">
                    <div className="text-[11px] text-muted-foreground">Faturas</div>
                    <div className="font-semibold">{history.invoices.length}</div>
                  </div>
                  <div className="rounded-md border border-border/60 p-2">
                    <div className="text-[11px] text-muted-foreground">Movimentos</div>
                    <div className="font-semibold">{history.movements.length}</div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={exportSupplierHistory}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar histórico
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Produtos</h3>
                  {history.products.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem produtos associados.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>SKU</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.products.map((product) => (
                          <TableRow key={product.id}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                            <TableCell className="text-right">{product.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(product.price || 0))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Faturas / entradas</h3>
                  {history.invoices.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem faturas registadas.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fatura</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Pedido</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Unitário</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.invoices.slice(0, 25).map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{invoice.productName}</TableCell>
                            <TableCell>{invoice.reqNumber || "—"}</TableCell>
                            <TableCell className="text-right">{invoice.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(Number(invoice.unitPrice || 0))}</TableCell>
                            <TableCell>{new Date(invoice.issuedAt).toLocaleDateString("pt-PT")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Movimentos recentes</h3>
                  {history.movements.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Sem movimentos registados.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead>Documento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.movements.slice(0, 25).map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(movement.createdAt).toLocaleString("pt-PT")}
                            </TableCell>
                            <TableCell>{movement.product?.name || "—"}</TableCell>
                            <TableCell>{movement.type}</TableCell>
                            <TableCell className="text-right">{movement.quantity}</TableCell>
                            <TableCell>
                              {movement.invoice?.invoiceNumber || movement.invoice?.reqNumber || movement.request?.title || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
