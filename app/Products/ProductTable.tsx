"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Product } from "@/app/types";
import { useAuth } from "../authContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PackageSearch, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import PaginationSelection, { PaginationType } from "./PaginationSelection";
import ProductDropDown from "./ProductsDropDown";
import ProductActionsIcons from "./ProductActionsIcons";
import { QRCodeHover } from "@/components/ui/qr-code-hover";

interface DataTableProps<TData, TValue> {
  data: TData[];
  columns: unknown[];
  userId: string;
  isLoading: boolean;
  searchTerm: string;
  pagination: PaginationType;
  setPagination: (
    updater: PaginationType | ((old: PaginationType) => PaginationType)
  ) => void;
  selectedCategory: string[];
  selectedStatuses: string[];
  selectedSuppliers: string[];
  viewMode: "table" | "grid";
  priceRange: [number, number];
}

function statusMeta(quantity: number) {
  if (quantity > 20) {
    return {
      label: "Disponível",
      className:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }
  if (quantity > 0) {
    return {
      label: "Stock baixo",
      className:
        "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Sem stock",
    className: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };
}

export const ProductTable = React.memo(function ProductTable({
  data,
  columns: _columns,
  userId: _userId,
  isLoading,
  searchTerm,
  pagination,
  setPagination,
  selectedCategory,
  selectedStatuses,
  selectedSuppliers,
  viewMode,
  priceRange,
}: DataTableProps<Product, unknown>) {
  const { isLoggedIn, isAuthLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isLoggedIn) {
      router.replace("/login");
    }
  }, [isAuthLoading, isLoggedIn, router]);

  const filteredData = useMemo(() => {
    const filtered = data
      .filter((product) => {
        const searchMatch =
          !searchTerm ||
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchTerm.toLowerCase());

        const categoryMatch =
          selectedCategory.length === 0 ||
          selectedCategory.includes(product.categoryId ?? "");

        const supplierMatch =
          selectedSuppliers.length === 0 ||
          selectedSuppliers.includes(product.supplierId ?? "");

        const statusMatch =
          selectedStatuses.length === 0 ||
          selectedStatuses.includes(product.status ?? "");

        const priceMatch = product.price >= priceRange[0] && product.price <= priceRange[1];

        return (
          searchMatch && categoryMatch && supplierMatch && statusMatch && priceMatch
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    return filtered;
  }, [
    data,
    searchTerm,
    selectedCategory,
    selectedSuppliers,
    selectedStatuses,
    priceRange,
  ]);

  useEffect(() => {
    const allowed = new Set(filteredData.map((p) => p.id));
    setSelectedIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filteredData]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredData.length / Math.max(1, pagination.pageSize))
  );
  const safePageIndex = Math.min(pagination.pageIndex, pageCount - 1);
  const start = safePageIndex * pagination.pageSize;
  const pageRows = filteredData.slice(start, start + pagination.pageSize);
  const startRow = filteredData.length === 0 ? 0 : start + 1;
  const endRow = Math.min(filteredData.length, start + pagination.pageSize);

  useEffect(() => {
    if (pagination.pageIndex !== safePageIndex) {
      setPagination((prev) => ({ ...prev, pageIndex: safePageIndex }));
    }
  }, [pagination.pageIndex, safePageIndex, setPagination]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedSet.has(row.id));

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)
    );
  };

  const togglePage = (checked: boolean) => {
    if (!checked) {
      const pageSet = new Set(pageRows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageRows.map((r) => r.id)])));
  };

  const exportSelection = () => {
    const selectedProducts = filteredData.filter((p) => selectedSet.has(p.id));
    if (selectedProducts.length === 0) return;
    const csv = Papa.unparse(
      selectedProducts.map((p) => ({
        Nome: p.name,
        SKU: p.sku,
        Preco: p.price,
        Quantidade: p.quantity,
        Estado: p.status,
        Categoria: p.category || "",
        Fornecedor: p.supplier || "",
      }))
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `stockly-selecao-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Exportação concluída",
      description: `${selectedProducts.length} produtos exportados.`,
    });
  };

  const pages = useMemo(() => {
    const list: number[] = [];
    const current = safePageIndex + 1;
    const from = Math.max(1, current - 2);
    const to = Math.min(pageCount, current + 2);
    for (let i = from; i <= to; i += 1) list.push(i);
    return list;
  }, [safePageIndex, pageCount]);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-3">
          <div className="hidden grid-cols-12 gap-2 rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.68)] p-3 lg:grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.7)] p-4">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted/70" />
                <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted/60" />
                <div className="mt-4 h-10 animate-pulse rounded-xl bg-muted/60" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-[hsl(var(--surface-1)/0.65)] p-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <PackageSearch className="h-6 w-6 text-primary" />
          </div>
          <div className="text-lg font-semibold">Sem produtos nesta vista</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Ajusta os filtros para encontrares resultados.
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pageRows.map((product) => {
            const status = statusMeta(product.quantity);
            return (
              <article
                key={product.id}
                className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.74)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted-foreground">SKU {product.sku}</p>
                  </div>
                  <ProductDropDown row={{ original: product }} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="outline" className={`rounded-full border ${status.className}`}>
                    {status.label}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full">
                    {product.quantity} unid.
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {product.category || "Sem categoria"} • {product.supplier || "Sem fornecedor"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Criado em {new Date(product.createdAt).toLocaleDateString("pt-PT")}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preço</span>
                  <span className="text-lg font-semibold">
                    {product.price.toLocaleString("pt-PT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => router.push(`/products/${product.id}`)}
                  >
                    Ver detalhe
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="overflow-auto rounded-2xl border border-border/70 bg-[hsl(var(--surface-1)/0.78)]">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-2)/0.95)] backdrop-blur">
              <tr>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">
                  <Checkbox checked={allPageSelected} onCheckedChange={(v) => togglePage(Boolean(v))} />
                </th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Nome</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">SKU</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Qtd.</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Preço</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Estado</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Categoria</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-left">Fornecedor</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-center">QR</th>
                <th className="h-[var(--table-head-h)] px-[var(--table-cell-px)] text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((product) => {
                const status = statusMeta(product.quantity);
                const qrData = JSON.stringify({
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  price: product.price,
                  quantity: product.quantity,
                  status: product.status,
                  category: product.category,
                  supplier: product.supplier,
                });
                return (
                  <tr
                    key={product.id}
                    className="border-t border-border/55 transition-all odd:bg-[hsl(var(--surface-2)/0.2)] hover:bg-[hsl(var(--surface-2)/0.52)] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]"
                  >
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      <Checkbox
                        checked={selectedSet.has(product.id)}
                        onCheckedChange={(v) => toggleRow(product.id, Boolean(v))}
                      />
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] font-mono text-xs">{product.sku}</td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      <span
                        className={`inline-flex min-w-10 justify-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          product.quantity > 20
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : product.quantity > 0
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      {product.price.toLocaleString("pt-PT", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      <Badge variant="outline" className={`rounded-full border ${status.className}`}>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">{product.category || "—"}</td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">{product.supplier || "—"}</td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)] text-center">
                      <div className="inline-flex rounded-full border border-border/65 bg-[hsl(var(--surface-2)/0.75)] p-0.5">
                        <QRCodeHover data={qrData} title={`${product.name} QR`} size={180} />
                      </div>
                    </td>
                    <td className="px-[var(--table-cell-px)] py-[var(--table-cell-py)]">
                      <ProductActionsIcons product={product} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.74)] px-4 py-3 md:flex-row">
        <div className="text-sm text-muted-foreground">
          A mostrar {startRow}-{endRow} de {filteredData.length}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            disabled={safePageIndex === 0}
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                pageIndex: Math.max(0, prev.pageIndex - 1),
              }))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  pageIndex: page - 1,
                }))
              }
              className={`h-8 min-w-8 rounded-full px-2 text-sm transition ${
                page === safePageIndex + 1
                  ? "bg-primary/14 text-primary"
                  : "text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {page}
            </button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            disabled={safePageIndex >= pageCount - 1}
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                pageIndex: Math.min(pageCount - 1, prev.pageIndex + 1),
              }))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <PaginationSelection
          pagination={pagination}
          setPagination={setPagination}
          className="gap-2"
          triggerClassName="h-9 w-[86px] rounded-xl"
        />
      </div>

      {selectedIds.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(95vw,680px)] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-[hsl(var(--surface-1)/0.88)] px-4 py-3 shadow-2xl backdrop-blur-xl">
          <div className="text-sm">
            <span className="font-semibold">{selectedIds.length}</span> produto(s) selecionado(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-9 rounded-xl border-border/70"
              onClick={exportSelection}
            >
              <Download className="h-4 w-4" />
              Exportar seleção
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-xl"
              onClick={() => setSelectedIds([])}
            >
              Limpar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
});
