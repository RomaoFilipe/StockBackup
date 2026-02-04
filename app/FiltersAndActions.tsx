
"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { Product } from "@/app/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as ExcelJS from "exceljs";
import { Plus, Search, SlidersHorizontal, MoreHorizontal, Download, X } from "lucide-react";
import { CategoryDropDown } from "./AppTable/dropdowns/CategoryDropDown";
import { StatusDropDown } from "./AppTable/dropdowns/StatusDropDown";
import { SuppliersDropDown } from "./AppTable/dropdowns/SupplierDropDown";
import AddProductDialog from "./AppTable/ProductDialog/AddProductDialog";
import AddCategoryDialog from "./AppTable/ProductDialog/AddCategoryDialog";
import AddSupplierDialog from "./AppTable/ProductDialog/AddSupplierDialog";
import PaginationSelection, {
  PaginationType,
} from "./Products/PaginationSelection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type FiltersAndActionsProps = {
  userId: string;
  allProducts: Product[];
  selectedCategory: string[];
  setSelectedCategory: Dispatch<SetStateAction<string[]>>;
  selectedStatuses: string[];
  setSelectedStatuses: Dispatch<SetStateAction<string[]>>;
  selectedSuppliers: string[];
  setSelectedSuppliers: Dispatch<SetStateAction<string[]>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
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

export default function FiltersAndActions({
  userId,
  allProducts,
  selectedCategory,
  setSelectedCategory,
  selectedStatuses,
  setSelectedStatuses,
  selectedSuppliers,
  setSelectedSuppliers,
  searchTerm,
  setSearchTerm,
  pagination,
  setPagination,
}: FiltersAndActionsProps) {
  const { toast } = useToast();
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Filter products based on current filters
  const getFilteredProducts = () => {
    return allProducts.filter((product) => {
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
  };

  const exportToCSV = () => {
    try {
      const filteredProducts = getFilteredProducts();

      if (filteredProducts.length === 0) {
        toast({
          title: "Sem dados para exportar",
          description: "Não existem produtos para exportar com os filtros atuais.",
          variant: "destructive",
        });
        return;
      }

      const csvData = filteredProducts.map(product => ({
        'Nome do produto': product.name,
        'SKU': product.sku,
        'Preço': `$${product.price.toFixed(2)}`,
        'Quantidade': product.quantity,
        'Estado': formatProductStatus(product.status ?? ""),
        'Categoria': product.category || 'Desconhecida',
        'Fornecedor': product.supplier || 'Desconhecido',
        'Data de criação': new Date(product.createdAt).toLocaleDateString("pt-PT"),
      }));

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `stockly-products-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportação CSV concluída",
        description: `${filteredProducts.length} produtos exportados para CSV.`,
      });
    } catch (error) {
      toast({
        title: "Falha na exportação",
        description: "Não foi possível exportar para CSV. Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = async () => {
    try {
      const filteredProducts = getFilteredProducts();

      if (filteredProducts.length === 0) {
        toast({
          title: "Sem dados para exportar",
          description: "Não existem produtos para exportar com os filtros atuais.",
          variant: "destructive",
        });
        return;
      }

      const excelData = filteredProducts.map(product => ({
        'Nome do produto': product.name,
        'SKU': product.sku,
        'Preço': product.price,
        'Quantidade': product.quantity,
        'Estado': formatProductStatus(product.status ?? ""),
        'Categoria': product.category || 'Desconhecida',
        'Fornecedor': product.supplier || 'Desconhecido',
        'Data de criação': new Date(product.createdAt).toLocaleDateString("pt-PT"),
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
      link.download = `stockly-products-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Exportação Excel concluída",
        description: `${filteredProducts.length} produtos exportados para Excel.`,
      });
    } catch (error) {
      toast({
        title: "Falha na exportação",
        description: "Não foi possível exportar para Excel. Tenta novamente.",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center lg:items-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Pesquisar produtos"
              className="h-11 w-full rounded-full border-border/60 bg-background/60 pl-10 pr-10 shadow-sm backdrop-blur"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full"
                onClick={() => setSearchTerm("")}
                aria-label="Limpar pesquisa"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <CategoryDropDown
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            buttonVariant="outline"
            buttonClassName="h-11 rounded-full px-4"
            label="Categoria"
          />
          <StatusDropDown
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            buttonVariant="outline"
            buttonClassName="h-11 rounded-full px-4"
            label="Estado"
          />
          <SuppliersDropDown
            selectedSuppliers={selectedSuppliers}
            setSelectedSuppliers={setSelectedSuppliers}
            buttonVariant="outline"
            buttonClassName="h-11 rounded-full px-4"
            label="Fornecedor"
          />
          <div className="flex items-center gap-2 lg:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-10 gap-2 rounded-full">
                  <Plus className="h-4 w-4" />
                  Criar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Criar</DropdownMenuLabel>
                <DropdownMenuGroup>
                  <AddProductDialog
                    allProducts={allProducts}
                    userId={userId}
                    trigger={<DropdownMenuItem>Produto</DropdownMenuItem>}
                  />
                  <AddCategoryDialog trigger={<DropdownMenuItem>Categoria</DropdownMenuItem>} />
                  <AddSupplierDialog trigger={<DropdownMenuItem>Fornecedor</DropdownMenuItem>} />
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 gap-2 rounded-full">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filtros
                </Button>
              </DialogTrigger>
              <DialogContent className="bottom-0 top-auto max-w-none translate-y-0 rounded-t-2xl border-t border-border/70 px-4 pb-8 pt-6">
                <DialogHeader>
                  <DialogTitle className="text-base">Filtros</DialogTitle>
                </DialogHeader>
                <div className="mt-2 flex flex-col gap-3">
                  <CategoryDropDown
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    buttonVariant="outline"
                    buttonClassName="h-11 w-full justify-start rounded-xl"
                    label="Categoria"
                  />
                  <StatusDropDown
                    selectedStatuses={selectedStatuses}
                    setSelectedStatuses={setSelectedStatuses}
                    buttonVariant="outline"
                    buttonClassName="h-11 w-full justify-start rounded-xl"
                    label="Estado"
                  />
                  <SuppliersDropDown
                    selectedSuppliers={selectedSuppliers}
                    setSelectedSuppliers={setSelectedSuppliers}
                    buttonVariant="outline"
                    buttonClassName="h-11 w-full justify-start rounded-xl"
                    label="Fornecedor"
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => {
                      setSelectedStatuses([]);
                      setSelectedCategory([]);
                      setSelectedSuppliers([]);
                    }}
                  >
                    Limpar
                  </Button>
                  <Button className="w-full rounded-xl" onClick={() => setIsFilterOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Exportar</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel}>
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11 gap-2 rounded-full px-5 font-semibold">
                <Plus className="h-4 w-4" />
                Criar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Criar</DropdownMenuLabel>
              <DropdownMenuGroup>
                <AddProductDialog
                  allProducts={allProducts}
                  userId={userId}
                  trigger={<DropdownMenuItem>Produto</DropdownMenuItem>}
                />
                <AddCategoryDialog trigger={<DropdownMenuItem>Categoria</DropdownMenuItem>} />
                <AddSupplierDialog trigger={<DropdownMenuItem>Fornecedor</DropdownMenuItem>} />
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <PaginationSelection
            pagination={pagination}
            setPagination={setPagination}
            label="Linhas"
            triggerClassName="h-11 w-[76px] rounded-full"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 rounded-full">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={exportToCSV}>
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <FilterArea
        selectedStatuses={selectedStatuses}
        setSelectedStatuses={setSelectedStatuses}
        selectedCategories={selectedCategory}
        setSelectedCategories={setSelectedCategory}
        selectedSuppliers={selectedSuppliers}
        setSelectedSuppliers={setSelectedSuppliers}
      />

    </div>
  );
}
// Add the FilterArea component here
function FilterArea({
  selectedStatuses,
  setSelectedStatuses,
  selectedCategories,
  setSelectedCategories,
  selectedSuppliers,
  setSelectedSuppliers,
}: {
  selectedStatuses: string[];
  setSelectedStatuses: Dispatch<SetStateAction<string[]>>;
  selectedCategories: string[];
  setSelectedCategories: Dispatch<SetStateAction<string[]>>;
  selectedSuppliers: string[];
  setSelectedSuppliers: Dispatch<SetStateAction<string[]>>;
}) {
  if (
    selectedStatuses.length === 0 &&
    selectedCategories.length === 0 &&
    selectedSuppliers.length === 0
  ) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedStatuses.length > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <span>Estado</span>
          <Separator orientation="vertical" className="h-3" />
          <Badge variant="secondary" className="rounded-full">
            {selectedStatuses.length}
          </Badge>
        </div>
      )}
      {selectedCategories.length > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <span>Categoria</span>
          <Separator orientation="vertical" className="h-3" />
          <Badge variant="secondary" className="rounded-full">
            {selectedCategories.length}
          </Badge>
        </div>
      )}

      {selectedSuppliers.length > 0 && (
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          <span>Fornecedor</span>
          <Separator orientation="vertical" className="h-3" />
          <Badge variant="secondary" className="rounded-full">
            {selectedSuppliers.length}
          </Badge>
        </div>
      )}

      {(selectedStatuses.length > 0 ||
        selectedCategories.length > 0 ||
        selectedSuppliers.length > 0) && (
        <Button
          onClick={() => {
            setSelectedStatuses([]);
            setSelectedCategories([]);
            setSelectedSuppliers([]);
          }}
          variant="ghost"
          size="sm"
          className="h-8 gap-1 rounded-full"
        >
          Limpar
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
