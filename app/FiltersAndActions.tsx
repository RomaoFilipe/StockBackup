"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { Product } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as ExcelJS from "exceljs";
import {
  Bell,
  Boxes,
  ChevronDown,
  CircleOff,
  CircleDollarSign,
  Download,
  Filter,
  LayoutGrid,
  Plus,
  Search,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import AddProductDialog from "./AppTable/ProductDialog/AddProductDialog";
import PaginationSelection, {
  PaginationType,
} from "./Products/PaginationSelection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FiltersAndActionsProps = {
  userId: string;
  userName: string;
  allProducts: Product[];
  selectedCategory: string[];
  setSelectedCategory: Dispatch<SetStateAction<string[]>>;
  selectedStatuses: string[];
  setSelectedStatuses: Dispatch<SetStateAction<string[]>>;
  selectedSuppliers: string[];
  setSelectedSuppliers: Dispatch<SetStateAction<string[]>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  viewMode: "table" | "grid";
  setViewMode: Dispatch<SetStateAction<"table" | "grid">>;
  priceRange: [number, number];
  setPriceRange: Dispatch<SetStateAction<[number, number]>>;
  maxPrice: number;
  pagination: PaginationType;
  setPagination: (
    updater: PaginationType | ((old: PaginationType) => PaginationType)
  ) => void;
};

function formatProductStatus(status: string) {
  switch (status) {
    case "Available":
      return "Disponível";
    case "Stock Low":
      return "Stock baixo";
    case "Stock Out":
      return "Sem stock";
    default:
      return status;
  }
}

function Sparkline({ values }: { values: number[] }) {
  return (
    <div className="mt-2 flex h-8 items-end gap-1">
      {values.map((value, idx) => (
        <span
          key={idx}
          className="w-1.5 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500/70"
          style={{ height: `${Math.max(20, Math.min(100, value))}%` }}
        />
      ))}
    </div>
  );
}

export default function FiltersAndActions({
  userId,
  userName,
  allProducts,
  selectedCategory,
  setSelectedCategory,
  selectedStatuses,
  setSelectedStatuses,
  selectedSuppliers,
  setSelectedSuppliers,
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
  priceRange,
  setPriceRange,
  maxPrice,
  pagination,
  setPagination,
}: FiltersAndActionsProps) {
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of allProducts) {
      if (product.categoryId && product.category) {
        map.set(product.categoryId, product.category);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allProducts]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of allProducts) {
      if (product.supplierId && product.supplier) {
        map.set(product.supplierId, product.supplier);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allProducts]);

  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
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
      return searchMatch && categoryMatch && supplierMatch && statusMatch && priceMatch;
    });
  }, [
    allProducts,
    searchTerm,
    selectedCategory,
    selectedSuppliers,
    selectedStatuses,
    priceRange,
  ]);

  const analytics = useMemo(() => {
    const total = allProducts.length;
    const inStock = allProducts.filter((p) => p.quantity > 20).length;
    const lowStock = allProducts.filter((p) => p.quantity > 0 && p.quantity <= 20).length;
    const outOfStock = allProducts.filter((p) => p.quantity <= 0).length;
    const inventoryValue = allProducts.reduce((acc, p) => acc + p.price * p.quantity, 0);
    const averageTicket = total > 0 ? inventoryValue / total : 0;
    return { total, inStock, lowStock, outOfStock, inventoryValue, averageTicket };
  }, [allProducts]);

  const exportToCSV = () => {
    try {
      if (filteredProducts.length === 0) {
        toast({
          title: "Sem dados para exportar",
          description: "Não existem produtos para exportar com os filtros atuais.",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredProducts.map((product) => ({
        "Nome do produto": product.name,
        SKU: product.sku,
        Preço: `${product.price.toFixed(2)} €`,
        Quantidade: product.quantity,
        Estado: formatProductStatus(product.status ?? ""),
        Categoria: product.category || "Desconhecida",
        Fornecedor: product.supplier || "Desconhecido",
        "Data de criação": new Date(product.createdAt).toLocaleDateString("pt-PT"),
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `stockly-produtos-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast({
        title: "Falha na exportação",
        description: "Não foi possível exportar para CSV. Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = async () => {
    try {
      if (filteredProducts.length === 0) {
        toast({
          title: "Sem dados para exportar",
          description: "Não existem produtos para exportar com os filtros atuais.",
          variant: "destructive",
        });
        return;
      }

      const excelData = filteredProducts.map((product) => ({
        "Nome do produto": product.name,
        SKU: product.sku,
        Preço: product.price,
        Quantidade: product.quantity,
        Estado: formatProductStatus(product.status ?? ""),
        Categoria: product.category || "Desconhecida",
        Fornecedor: product.supplier || "Desconhecido",
        "Data de criação": new Date(product.createdAt).toLocaleDateString("pt-PT"),
      }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Produtos");
      const keys = Object.keys(excelData[0] || {});
      worksheet.columns = keys.map((header) => ({
        header,
        key: header,
        width: Math.max(12, Math.min(40, header.length + 6)),
      }));
      worksheet.addRows(excelData);
      worksheet.getRow(1).font = { bold: true };
      worksheet.views = [{ state: "frozen", ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stockly-produtos-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Falha na exportação",
        description: "Não foi possível exportar para Excel. Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setSelectedCategory([]);
    setSelectedStatuses([]);
    setSelectedSuppliers([]);
    setPriceRange([0, maxPrice]);
  };

  const activeFilterCount =
    selectedCategory.length +
    selectedStatuses.length +
    selectedSuppliers.length +
    (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0);

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategory[0]) return null;
    return categoryOptions.find((opt) => opt.id === selectedCategory[0])?.name ?? "Categoria";
  }, [categoryOptions, selectedCategory]);

  const selectedSupplierName = useMemo(() => {
    if (!selectedSuppliers[0]) return null;
    return supplierOptions.find((opt) => opt.id === selectedSuppliers[0])?.name ?? "Fornecedor";
  }, [selectedSuppliers, supplierOptions]);

  const selectedStatusName = useMemo(() => {
    if (!selectedStatuses[0]) return null;
    return formatProductStatus(selectedStatuses[0]);
  }, [selectedStatuses]);

  const stockCoverage = analytics.total > 0 ? Math.round((analytics.inStock / analytics.total) * 100) : 0;
  const lowStockRatio = analytics.total > 0 ? Math.round((analytics.lowStock / analytics.total) * 100) : 0;
  const outStockRatio = analytics.total > 0 ? Math.round((analytics.outOfStock / analytics.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="sticky top-3 z-20 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.72)] p-3 backdrop-blur-xl">
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border border-border/70 px-2 py-1 text-sm ${
            viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
          onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
          title="Alternar vista"
        >
          <LayoutGrid className="h-4 w-4" />
          {viewMode === "table" ? "Tabela" : "Grelha"}
        </button>

        <div className="flex w-full max-w-2xl items-center gap-2 rounded-xl border border-border/70 bg-[hsl(var(--surface-1)/0.84)] px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisa global de produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full px-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <UserRound className="h-4 w-4" />
                </div>
                <span className="hidden sm:inline">{userName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel">
              <DropdownMenuLabel>Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Perfil</DropdownMenuItem>
              <DropdownMenuItem>Definições</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de inventário e controlo de stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddProductDialog
            allProducts={allProducts}
            userId={userId}
            trigger={
              <Button className="h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-white hover:from-blue-500 hover:to-indigo-500">
                <Plus className="h-4 w-4" />
                Criar Produto
              </Button>
            }
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 rounded-2xl border-border/70 px-4">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel">
              <DropdownMenuItem onClick={exportToCSV}>Exportar CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>Exportar Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Total Produtos</span>
            <Boxes className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{analytics.total}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {filteredProducts.length} após filtros
          </div>
          <Sparkline values={[20, 32, 48, 56, 68, 72, Math.max(24, stockCoverage)]} />
        </article>
        <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Produtos em Stock</span>
            <Badge variant="secondary" className="rounded-full">
              Disponível
            </Badge>
          </div>
          <div className="mt-2 text-3xl font-semibold">{analytics.inStock}</div>
          <div className="mt-1 text-xs text-emerald-600">{stockCoverage}% do catálogo</div>
          <Sparkline values={[22, 38, 45, 57, 61, 64, Math.max(26, stockCoverage)]} />
        </article>
        <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Baixo Stock</span>
            <TriangleAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{analytics.lowStock}</div>
          <div className="mt-1 text-xs text-amber-600">{lowStockRatio}% com reposição recomendada</div>
          <Sparkline values={[55, 48, 42, 38, 32, 28, Math.max(20, lowStockRatio)]} />
        </article>
        <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Sem Stock</span>
            <CircleOff className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-3xl font-semibold">{analytics.outOfStock}</div>
          <div className="mt-1 text-xs text-rose-600">{outStockRatio}% sem disponibilidade</div>
          <Sparkline values={[16, 24, 20, 28, 26, 32, Math.max(18, outStockRatio)]} />
        </article>
        <article className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <span>Valor de Inventário</span>
            <CircleDollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {analytics.inventoryValue.toLocaleString("pt-PT", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Ticket médio: {analytics.averageTicket.toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
          </div>
          <Sparkline values={[24, 30, 42, 45, 52, 58, Math.max(24, stockCoverage)]} />
        </article>
      </div>

      <div className="rounded-2xl border border-border/60 bg-[hsl(var(--surface-1)/0.8)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            className="h-10 rounded-xl border-border/70"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <Filter className="h-4 w-4" />
            Filtros avançados
            <Badge variant="secondary" className="ml-1 rounded-full">
              {activeFilterCount}
            </Badge>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </Button>

          <div className="flex items-center gap-3">
            <PaginationSelection
              pagination={pagination}
              setPagination={setPagination}
              className="gap-2"
              triggerClassName="h-10 w-[88px] rounded-xl"
            />
            {activeFilterCount > 0 ? (
              <Button variant="ghost" className="h-10 rounded-xl" onClick={clearFilters}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        </div>

        {showFilters ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Categoria</div>
              <Select
                value={selectedCategory[0] || "ALL"}
                onValueChange={(value) =>
                  setSelectedCategory(value === "ALL" ? [] : [value])
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  <SelectItem value="ALL">Todas</SelectItem>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Estado</div>
              <div className="flex h-11 items-center gap-1 rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.6)] p-1">
                {[
                  { value: "ALL", label: "Todos" },
                  { value: "Available", label: "Stock" },
                  { value: "Stock Low", label: "Baixo" },
                  { value: "Stock Out", label: "Sem" },
                ].map((option) => {
                  const active =
                    option.value === "ALL"
                      ? selectedStatuses.length === 0
                      : selectedStatuses.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`h-full flex-1 rounded-lg text-xs transition ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted/70"
                      }`}
                      onClick={() =>
                        setSelectedStatuses(option.value === "ALL" ? [] : [option.value])
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fornecedor</div>
              <Select
                value={selectedSuppliers[0] || "ALL"}
                onValueChange={(value) =>
                  setSelectedSuppliers(value === "ALL" ? [] : [value])
                }
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent className="glass-panel">
                  <SelectItem value="ALL">Todos</SelectItem>
                  {supplierOptions.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <span>Preço</span>
                <span>
                  {priceRange[0]}€ - {priceRange[1]}€
                </span>
              </div>
              <div className="rounded-xl border border-border/60 bg-[hsl(var(--surface-2)/0.6)] px-3 py-2">
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  value={priceRange[0]}
                  className="w-full accent-blue-600"
                  onChange={(e) => {
                    const nextMin = Number(e.target.value);
                    setPriceRange((prev) => [Math.min(nextMin, prev[1]), prev[1]]);
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={maxPrice}
                  value={priceRange[1]}
                  className="mt-1 w-full accent-indigo-600"
                  onChange={(e) => {
                    const nextMax = Number(e.target.value);
                    setPriceRange((prev) => [prev[0], Math.max(nextMax, prev[0])]);
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeFilterCount > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="rounded-full">Filtros ativos: {activeFilterCount}</Badge>
            {selectedCategoryName ? <Badge variant="outline" className="rounded-full">Categoria: {selectedCategoryName}</Badge> : null}
            {selectedStatusName ? <Badge variant="outline" className="rounded-full">Estado: {selectedStatusName}</Badge> : null}
            {selectedSupplierName ? <Badge variant="outline" className="rounded-full">Fornecedor: {selectedSupplierName}</Badge> : null}
            {(priceRange[0] > 0 || priceRange[1] < maxPrice) ? (
              <Badge variant="outline" className="rounded-full">Preço: {priceRange[0]}-{priceRange[1]}€</Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
