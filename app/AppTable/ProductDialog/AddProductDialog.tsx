/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { QRCodeComponent } from "@/components/ui/qr-code";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import ProductName from "./_components/ProductName";
import SKU from "./_components/SKU";
import Quantity from "./_components/Quantity";
import Price from "./_components/Price";
import { Product } from "@/app/types";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";

const ProductSchema = z.object({
  // Fatura
  invoiceNumber: z.string().min(1, "Nº de fatura é obrigatório").max(64),
  reqNumber: z.string().max(64).optional(),
  invoiceNotes: z.string().max(500).optional(),

  // Produto
  productName: z
    .string()
    .min(1, "Nome do produto é obrigatório")
    .max(100, "Nome do produto deve ter no máximo 100 caracteres"),
  productDescription: z.string().max(1000).optional(),
  sku: z
    .string()
    .min(1, "SKU é obrigatório")
    .regex(/^[a-zA-Z0-9-_]+$/, "SKU deve ser alfanumérico"),
  price: z.number().nonnegative("Preço não pode ser negativo"),

  // Stock (por unidade)
  quantity: z
    .number()
    .int("Quantidade tem de ser um número inteiro")
    .positive("Quantidade tem de ser maior que 0"),
});

interface ProductFormData {
  invoiceNumber: string;
  reqNumber?: string;
  invoiceNotes?: string;
  productName: string;
  productDescription?: string;
  sku: string;
  quantity: number;
  price: number;
}

interface AddProductDialogProps {
  allProducts: Product[];
  userId: string;
  trigger?: React.ReactNode;
}

export default function AddProductDialog({
  allProducts,
  userId,
  trigger,
}: AddProductDialogProps) {
  const methods = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      invoiceNumber: "",
      reqNumber: "",
      invoiceNotes: "",
      productName: "",
      productDescription: "",
      sku: "",
      quantity: 1,
      price: 0.0,
    },
  });

  const { reset } = methods;

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Button loading state
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [createdUnitPreviewCodes, setCreatedUnitPreviewCodes] = useState<string[]>([]);

  const {
    isLoading,
    setOpenProductDialog,
    openProductDialog,
    setSelectedProduct,
    selectedProduct,
    addProduct,
    updateProduct,
    loadProducts,
    loadCategories,
    loadSuppliers,
    categories,
    suppliers,
  } = useProductStore();
  const { isLoggedIn } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isLoggedIn && openProductDialog) {
      loadCategories();
      loadSuppliers();
    }
  }, [isLoggedIn, openProductDialog, loadCategories, loadSuppliers]);

  useEffect(() => {
    if (selectedProduct) {
      reset({
        invoiceNumber: "",
        reqNumber: "",
        invoiceNotes: "",
        productName: selectedProduct.name,
        productDescription: (selectedProduct as any).description ?? "",
        sku: selectedProduct.sku,
        quantity: selectedProduct.quantity,
        price: selectedProduct.price,
      });
      setSelectedCategory(selectedProduct.categoryId || "");
      setSelectedSupplier(selectedProduct.supplierId || "");
    } else {
      // Reset form to default values for adding a new product
      reset({
        invoiceNumber: "",
        reqNumber: "",
        invoiceNotes: "",
        productName: "",
        productDescription: "",
        sku: "",
        quantity: 1,
        price: 0.0,
      });
      setSelectedCategory("");
      setSelectedSupplier("");
      setAttachment(null);
      setCreatedInvoiceId(null);
      setCreatedUnitPreviewCodes([]);
    }
  }, [selectedProduct, openProductDialog, reset]);

  const calculateStatus = (quantity: number): string => {
    if (quantity > 20) return "Available";
    if (quantity > 0 && quantity <= 20) return "Stock Low";
    return "Stock Out";
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true); // Start loading
    const status: Product["status"] = calculateStatus(data.quantity);

    try {
      if (!selectedProduct) {
        if (!selectedCategory || !selectedSupplier) {
          toast({
            title: "Campos em falta",
            description: "Seleciona a categoria e o fornecedor.",
            variant: "destructive",
          });
          return;
        }

        // Create product + invoice + per-unit QR codes
        const intakeRes = await axiosInstance.post("/intake", {
          invoiceNumber: data.invoiceNumber,
          reqNumber: data.reqNumber || undefined,
          notes: data.invoiceNotes || undefined,
          quantity: data.quantity,
          unitPrice: data.price,
          product: {
            name: data.productName,
            description: data.productDescription || undefined,
            sku: data.sku,
            price: data.price,
            categoryId: selectedCategory,
            supplierId: selectedSupplier,
          },
        });

        const created = intakeRes.data as {
          product: any;
          invoice: { id: string };
          units: { count: number; previewCodes: string[] };
        };

        setCreatedInvoiceId(created.invoice.id);
        setCreatedUnitPreviewCodes(created.units.previewCodes || []);

        // Upload invoice attachment (optional) linked to invoiceId
        if (attachment) {
          const form = new FormData();
          form.append("kind", "INVOICE");
          form.append("invoiceId", created.invoice.id);
          form.append("file", attachment);
          await fetch("/api/storage", {
            method: "POST",
            body: form,
          });
        }

        toast({
          title: "Entrada registada",
          description: `Fatura criada e ${data.quantity} QR(s) gerado(s) por unidade.`,
        });

        // Refresh list
        await loadProducts();
      } else {
        const productToUpdate: Product = {
          id: selectedProduct.id,
          createdAt: new Date(selectedProduct.createdAt), // Convert string to Date
          supplierId: selectedSupplier,
          name: data.productName,
          description: data.productDescription || null,
          price: data.price,
          quantity: data.quantity,
          sku: data.sku,
          status,
          categoryId: selectedCategory,
          userId: selectedProduct.userId,
        };

        const result = await updateProduct(productToUpdate);
        if (result.success) {
          toast({
            title: "Product Updated Successfully!",
            description: `"${data.productName}" has been updated in your inventory.`,
          });
          loadProducts();
          setOpenProductDialog(false);
        } else {
          toast({
            title: "Update Failed",
            description: "Failed to update the product. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Operation Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // When opening the dialog for adding a new product, clear any selected product
      setSelectedProduct(null);
    } else {
      // When closing the dialog, also clear the selected product to ensure clean state
      setSelectedProduct(null);
    }
    setOpenProductDialog(open);
  };

  return (
    <Dialog open={openProductDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="h-10 font-semibold">Adicionar produto</Button>}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-4 sm:p-7 sm:px-8"
        aria-describedby="dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">
            {selectedProduct ? "Atualizar produto" : "Adicionar produto"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription id="dialog-description">
          {selectedProduct
            ? "Atualiza os dados do produto."
            : "Regista a entrada por fatura e gera 1 QR por unidade."}
        </DialogDescription>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            {!selectedProduct ? (
              <div className="grid grid-cols-1 gap-4">
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">1) Fatura</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Fatura Nº</label>
                      <input
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("invoiceNumber")}
                        placeholder="FT 2026/0001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">REQ Nº</label>
                      <input
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("reqNumber")}
                        placeholder="REQ-1234"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium">Notas</label>
                      <Textarea
                        {...methods.register("invoiceNotes")}
                        placeholder="Observações da fatura (opcional)"
                        className="min-h-[90px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">2) Produto</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium">Nome do Produto</label>
                      <input
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("productName")}
                        placeholder="Laptop HP 300 G3"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium">Descrição do Produto</label>
                      <Textarea
                        {...methods.register("productDescription")}
                        placeholder="Descrição (opcional)"
                        className="min-h-[90px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">SKU</label>
                      <input
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("sku")}
                        placeholder="HP300G3-001"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Preço (unitário)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("price", { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Categoria</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                      >
                        <option value="">Selecionar categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Fornecedor</label>
                      <select
                        value={selectedSupplier}
                        onChange={(e) => setSelectedSupplier(e.target.value)}
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                      >
                        <option value="">Selecionar fornecedor</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">3) Stock</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Quantidade (unidades)</label>
                      <input
                        type="number"
                        step="1"
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                        {...methods.register("quantity", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Vai gerar 1 QR por unidade.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">4) Anexo</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Cópia da fatura</label>
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        className="block w-full text-sm"
                        onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        PDF ou imagem. (Opcional)
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">5) QRs (pré-visualização)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!createdInvoiceId ? (
                      <p className="text-sm text-muted-foreground">
                        Depois de guardar, vais ver aqui uma pré-visualização dos QRs.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Fatura criada. Pré-visualização de alguns QRs (podes listar todos via fatura).
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {createdUnitPreviewCodes.map((code) => (
                            <QRCodeComponent
                              key={code}
                              data={`${typeof window !== "undefined" ? window.location.origin : ""}/scan/${code}`}
                              title="QR • Unidade"
                              size={180}
                              showDownload
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ProductName />
                <SKU allProducts={allProducts} />
                <Quantity />
                <Price />
                <div>
                  <label htmlFor="category" className="block text-sm font-medium">
                    Categoria
                  </label>
                  <select
                    id="category"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Selecionar categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="supplier" className="block text-sm font-medium">
                    Fornecedor
                  </label>
                  <select
                    id="supplier"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Selecionar fornecedor</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <DialogFooter className="mt-9 mb-4 flex flex-col sm:flex-row items-center gap-4">
              <DialogClose asChild>
                <Button
                  ref={dialogCloseRef}
                  variant="secondary"
                  className="h-11 w-full sm:w-auto px-11"
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="h-11 w-full sm:w-auto px-11"
                isLoading={isSubmitting} // Button loading effect
              >
                {isSubmitting
                  ? "A guardar..."
                  : selectedProduct
                  ? "Atualizar produto"
                  : "Guardar entrada"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
