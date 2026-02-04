"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";

export default function AddSupplierDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [supplierName, setSupplierName] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Button loading state
  const [isEditing, setIsEditing] = useState(false); // Loading state for edit
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const {
    suppliers,
    addSupplier,
    editSupplier,
    deleteSupplier,
    loadSuppliers,
  } = useProductStore();
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      loadSuppliers();
    }
  }, [isLoggedIn, loadSuppliers]);

  const handleAddSupplier = async () => {
    if (supplierName.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome do fornecedor não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true); // Start loading
    try {
      const response = await axiosInstance.post("/suppliers", {
        name: supplierName,
        userId: user?.id,
      });

      if (response.status !== 201) {
        throw new Error("Failed to add supplier");
      }

      const newSupplier = response.data;
      addSupplier(newSupplier);
      setSupplierName("");
      toast({
        title: "Fornecedor criado",
        description: `"${supplierName}" foi adicionado.`,
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error adding supplier:", error);
      toast({
        title: "Falha ao criar",
        description: "Não foi possível criar o fornecedor. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const handleEditSupplier = async (supplierId: string) => {
    if (newSupplierName.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome do fornecedor não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true); // Start loading
    try {
      const response = await axiosInstance.put("/suppliers", {
        id: supplierId,
        name: newSupplierName,
      });

      if (response.status !== 200) {
        throw new Error("Failed to edit supplier");
      }

      const updatedSupplier = response.data;
      editSupplier(supplierId, updatedSupplier.name);
      setEditingSupplier(null);
      setNewSupplierName("");
      toast({
        title: "Fornecedor atualizado",
        description: `"${updatedSupplier.name}" foi atualizado.`,
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error editing supplier:", error);
      toast({
        title: "Falha ao atualizar",
        description: "Não foi possível atualizar o fornecedor. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false); // Stop loading
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    setDeletingSupplierId(supplierId);

    // Find the supplier name before deleting for the toast message
    const supplierToDelete = suppliers.find(sup => sup.id === supplierId);
    const supplierName = supplierToDelete?.name || "Fornecedor desconhecido";

    try {
      const response = await axiosInstance.delete("/suppliers", {
        data: { id: supplierId },
      });

      if (response.status !== 204) {
        throw new Error("Failed to delete supplier");
      }

      deleteSupplier(supplierId);
      toast({
        title: "Fornecedor removido",
        description: `"${supplierName}" foi removido.`,
      });
      loadSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Falha ao remover",
        description: "Não foi possível remover o fornecedor. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingSupplierId(null);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button className="h-10 font-semibold">Adicionar fornecedor</Button>}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-4 sm:p-7 sm:px-8"
        aria-describedby="supplier-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">Adicionar fornecedor</DialogTitle>
        </DialogHeader>
        <DialogDescription id="supplier-dialog-description">
          Indica o nome do novo fornecedor
        </DialogDescription>
        <Input
          value={supplierName}
          onChange={(e) => setSupplierName(e.target.value)}
          placeholder="Novo fornecedor"
          className="mt-4"
        />
        <DialogFooter className="mt-9 mb-4 flex flex-col sm:flex-row items-center gap-4">
          <DialogClose asChild>
            <Button
              variant={"secondary"}
              className="h-11 w-full sm:w-auto px-11"
            >
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={handleAddSupplier}
            className="h-11 w-full sm:w-auto px-11"
            isLoading={isSubmitting}
          >
            Adicionar fornecedor
          </Button>
        </DialogFooter>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Fornecedores</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {suppliers
              .filter((supplier) => supplier.userId === user?.id)
              .map((supplier) => (
              <div
                key={supplier.id}
                className="p-4 border rounded-lg shadow-sm flex flex-col justify-between"
              >
                {editingSupplier === supplier.id ? (
                  <div className="flex flex-col space-y-2">
                    <Input
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="Edit Supplier"
                      className="h-8"
                    />
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => handleEditSupplier(supplier.id)}
                        className="h-8 w-full"
                        isLoading={isEditing}
                      >
                        Guardar
                      </Button>
                      <Button
                        onClick={() => setEditingSupplier(null)}
                        variant="outline"
                        className="h-8 w-full"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <span className="font-medium">{supplier.name}</span>
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => {
                          setEditingSupplier(supplier.id);
                          setNewSupplierName(supplier.name);
                        }}
                        variant="outline"
                        className="h-8 w-full"
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        variant="destructive"
                        className="h-8 w-full"
                        isLoading={deletingSupplierId === supplier.id}
                      >
                        <FaTrash />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
