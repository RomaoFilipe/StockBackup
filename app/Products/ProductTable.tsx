
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Product } from "@/app/types";
import { useAuth } from "../authContext";
import { useRouter } from "next/navigation";
import Skeleton from "@/components/Skeleton"; // Skeleton component for loading state
import PaginationSelection, { PaginationType } from "./PaginationSelection";
import { Button } from "@/components/ui/button";
import EmptyState from "@/app/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import ProductQrDialog from "./ProductQrDialog";
import ProductDropDown from "./ProductsDropDown";

interface DataTableProps<TData, TValue> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
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
}

function formatProductStatus(status?: string | null) {
  switch (status) {
    case "Available":
      return { label: "Disponível", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" };
    case "Stock Low":
      return { label: "Stock baixo", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" };
    case "Stock Out":
      return { label: "Sem stock", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20" };
    default:
      return { label: status || "—", className: "bg-muted/50 text-muted-foreground border-border/60" };
  }
}

export const ProductTable = React.memo(function ProductTable({
  data,
  columns,
  userId: _userId,
  isLoading,
  searchTerm,
  pagination,
  setPagination,
  selectedCategory,
  selectedStatuses,
  selectedSuppliers,
}: DataTableProps<Product, unknown>) {
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, router]);

  const filteredData = useMemo(() => {
    const filtered = data.filter((product) => {
      // Search term filtering
      const searchMatch = !searchTerm ||
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

      return searchMatch && categoryMatch && supplierMatch && statusMatch;
    });
    return filtered;
  }, [data, searchTerm, selectedCategory, selectedSuppliers, selectedStatuses]);

  const table = useReactTable({
    data: filteredData || [],
    columns,
    state: {
      pagination,
      sorting,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleRowClick = (id: string) => (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-row-click]")) return;
    router.push(`/products/${id}`);
  };

  const pageCount = Math.max(1, table.getPageCount());
  const totalRows = filteredData.length;
  const startRow = totalRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const endRow = Math.min(totalRows, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-4">
          <div className="hidden lg:block">
            <Skeleton rows={6} columns={columns.length} />
          </div>
          <div className="grid gap-3 lg:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-border/60 bg-card/60 p-4">
                <div className="h-4 w-1/2 rounded bg-muted/70" />
                <div className="mt-2 h-3 w-1/3 rounded bg-muted/60" />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="h-3 rounded bg-muted/60" />
                  <div className="h-3 rounded bg-muted/60" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-6 w-20 rounded-full bg-muted/60" />
                  <div className="h-6 w-24 rounded-full bg-muted/60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="hidden lg:block rounded-2xl border border-border/60 bg-card/60 shadow-sm">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as { align?: string } | undefined;
                      const alignClass = meta?.align === "right" ? "text-right" : "text-left";
                      return (
                        <TableHead key={header.id} className={`h-12 px-4 text-xs uppercase tracking-[0.18em] ${alignClass}`}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      onClick={handleRowClick(row.original.id)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as { align?: string } | undefined;
                        const alignClass = meta?.align === "right" ? "text-right" : "text-left";
                        return (
                          <TableCell key={cell.id} className={`px-4 py-4 ${alignClass}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="py-10">
                      <EmptyState title="Sem resultados" description="Ajusta os filtros ou tenta outra pesquisa." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const product = row.original;
                const status = formatProductStatus(product.status);
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
                  <div
                    key={row.id}
                    onClick={handleRowClick(product.id)}
                    className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{product.name}</div>
                        <div className="text-xs text-muted-foreground">SKU {product.sku}</div>
                      </div>
                      <div data-no-row-click>
                        <ProductDropDown row={{ original: product }} />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Quantidade</div>
                        <div className="font-medium">{product.quantity}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Preço</div>
                        <div className="font-medium">${product.price.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className={`rounded-full border ${status.className}`} variant="secondary">
                        {status.label}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground">
                        {product.category || "Sem categoria"}
                      </Badge>
                      <Badge variant="secondary" className="rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground">
                        {product.supplier || "Sem fornecedor"}
                      </Badge>
                    </div>

                    <div className="mt-4 flex items-center gap-2" data-no-row-click>
                      <ProductQrDialog
                        data={qrData}
                        title={`QR • ${product.name}`}
                        trigger={
                          <Button variant="outline" size="sm" className="h-8 rounded-full">
                            Ver QR
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        Detalhes
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title="Sem resultados" description="Ajusta os filtros ou tenta outra pesquisa." />
            )}
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm lg:flex-row lg:justify-between">
            <div className="text-sm text-muted-foreground">
              A mostrar {startRow}-{endRow} de {totalRows} produtos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-9 rounded-full px-4"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-9 rounded-full px-4"
              >
                Próxima
              </Button>
            </div>
            <div className="w-full lg:w-auto">
              <PaginationSelection
                pagination={pagination}
                setPagination={setPagination}
                label="Linhas"
                triggerClassName="h-9 w-[72px] rounded-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
});
