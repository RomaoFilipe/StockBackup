"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";

type SupplierDraft = {
  name: string;
  nif: string;
  email: string;
  phone: string;
  contactName: string;
  address: string;
  notes: string;
  isActive: boolean;
};

const emptyDraft = (): SupplierDraft => ({
  name: "",
  nif: "",
  email: "",
  phone: "",
  contactName: "",
  address: "",
  notes: "",
  isActive: true,
});

const toOptionalTrimmed = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toNullableTrimmed = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export default function AddSupplierDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Button loading state
  const [isEditing, setIsEditing] = useState(false); // Loading state for edit
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<SupplierDraft>(emptyDraft());
  const [editDraft, setEditDraft] = useState<SupplierDraft>(emptyDraft());
  const {
    suppliers,
    addSupplier,
    editSupplier,
    deleteSupplier,
    loadSuppliers,
  } = useProductStore();
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();

  const isAdmin = user?.role === "ADMIN";

  const canCreate = useMemo(() => Boolean(createDraft.name.trim()), [createDraft.name]);
  const canSaveEdit = useMemo(() => Boolean(editDraft.name.trim()), [editDraft.name]);

  useEffect(() => {
    if (isLoggedIn) {
      loadSuppliers();
    }
  }, [isLoggedIn, loadSuppliers]);

  const handleAddSupplier = async () => {
    if (!canCreate) {
      toast({
        title: "Erro",
        description: "O nome do fornecedor é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true); // Start loading
    try {
      const payload = {
        name: createDraft.name.trim(),
        nif: toOptionalTrimmed(createDraft.nif),
        email: toOptionalTrimmed(createDraft.email),
        phone: toOptionalTrimmed(createDraft.phone),
        contactName: toOptionalTrimmed(createDraft.contactName),
        address: toOptionalTrimmed(createDraft.address),
        notes: toOptionalTrimmed(createDraft.notes),
        isActive: createDraft.isActive,
      };

      const response = await axiosInstance.post("/suppliers", payload);

      if (response.status !== 201) {
        throw new Error("Failed to add supplier");
      }

      const newSupplier = response.data;
      addSupplier(newSupplier);
      setCreateDraft(emptyDraft());
      toast({
        title: "Fornecedor criado",
        description: `"${newSupplier?.name ?? createDraft.name}" foi adicionado.`,
      });
      loadSuppliers();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível criar o fornecedor. Tenta novamente.";
      console.error("Error adding supplier:", error);
      toast({
        title: "Falha ao criar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const handleEditSupplier = async (supplierId: string) => {
    if (!canSaveEdit) {
      toast({
        title: "Erro",
        description: "O nome do fornecedor é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true); // Start loading
    try {
      const response = await axiosInstance.put("/suppliers", {
        id: supplierId,
        name: editDraft.name.trim(),
        nif: toNullableTrimmed(editDraft.nif),
        email: toNullableTrimmed(editDraft.email),
        phone: toNullableTrimmed(editDraft.phone),
        contactName: toNullableTrimmed(editDraft.contactName),
        address: toNullableTrimmed(editDraft.address),
        notes: toNullableTrimmed(editDraft.notes),
        isActive: editDraft.isActive,
      });

      if (response.status !== 200) {
        throw new Error("Failed to edit supplier");
      }

      const updatedSupplier = response.data;
      editSupplier(supplierId, updatedSupplier.name);
      setEditingSupplier(null);
      setEditDraft(emptyDraft());
      toast({
        title: "Fornecedor atualizado",
        description: `"${updatedSupplier.name}" foi atualizado.`,
      });
      loadSuppliers();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Não foi possível atualizar o fornecedor. Tenta novamente.";
      console.error("Error editing supplier:", error);
      toast({
        title: "Falha ao atualizar",
        description: msg,
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

  // Suppliers mutations are admin-only in the API.
  if (!isAdmin) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button className="h-10 font-semibold">Adicionar fornecedor</Button>}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] w-[95vw] max-w-[980px] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-4 sm:p-7 sm:px-8"
        aria-describedby="supplier-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">Adicionar fornecedor</DialogTitle>
        </DialogHeader>
        <DialogDescription id="supplier-dialog-description">
          Preenche os campos mínimos recomendados do fornecedor.
        </DialogDescription>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Nome *</div>
            <Input
              value={createDraft.name}
              onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: HP"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">NIF</div>
            <Input
              value={createDraft.nif}
              onChange={(e) => setCreateDraft((p) => ({ ...p, nif: e.target.value }))}
              placeholder="Ex: 123456789"
            />
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Telefone</div>
            <Input
              value={createDraft.phone}
              onChange={(e) => setCreateDraft((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+351 ..."
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Email</div>
            <Input
              value={createDraft.email}
              onChange={(e) => setCreateDraft((p) => ({ ...p, email: e.target.value }))}
              placeholder="compras@fornecedor.pt"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Contacto</div>
            <Input
              value={createDraft.contactName}
              onChange={(e) => setCreateDraft((p) => ({ ...p, contactName: e.target.value }))}
              placeholder="Nome do contacto"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Morada</div>
            <Textarea
              value={createDraft.address}
              onChange={(e) => setCreateDraft((p) => ({ ...p, address: e.target.value }))}
              placeholder="Morada completa (opcional)"
              className="min-h-[90px]"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <div className="text-sm font-medium">Notas</div>
            <Textarea
              value={createDraft.notes}
              onChange={(e) => setCreateDraft((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas internas (opcional)"
              className="min-h-[90px]"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              checked={createDraft.isActive}
              onCheckedChange={(v) => setCreateDraft((p) => ({ ...p, isActive: Boolean(v) }))}
            />
            <div className="text-sm">Ativo</div>
          </div>
        </div>
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
            disabled={!canCreate || isSubmitting}
          >
            Adicionar fornecedor
          </Button>
        </DialogFooter>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Fornecedores</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {suppliers.map((supplier: any) => (
              <div
                key={supplier.id}
                className="p-4 border rounded-lg shadow-sm flex flex-col justify-between"
              >
                {editingSupplier === supplier.id ? (
                  <div className="flex flex-col space-y-2">
                    <div className="grid grid-cols-1 gap-2">
                      <Input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nome *"
                        className="h-8"
                      />
                      <Input
                        value={editDraft.nif}
                        onChange={(e) => setEditDraft((p) => ({ ...p, nif: e.target.value }))}
                        placeholder="NIF"
                        className="h-8"
                      />
                      <Input
                        value={editDraft.email}
                        onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))}
                        placeholder="Email"
                        className="h-8"
                      />
                      <Input
                        value={editDraft.phone}
                        onChange={(e) => setEditDraft((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="Telefone"
                        className="h-8"
                      />
                      <Input
                        value={editDraft.contactName}
                        onChange={(e) => setEditDraft((p) => ({ ...p, contactName: e.target.value }))}
                        placeholder="Contacto"
                        className="h-8"
                      />
                      <Textarea
                        value={editDraft.address}
                        onChange={(e) => setEditDraft((p) => ({ ...p, address: e.target.value }))}
                        placeholder="Morada"
                        className="min-h-[70px]"
                      />
                      <Textarea
                        value={editDraft.notes}
                        onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Notas"
                        className="min-h-[70px]"
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={editDraft.isActive}
                          onCheckedChange={(v) => setEditDraft((p) => ({ ...p, isActive: Boolean(v) }))}
                        />
                        <div className="text-sm">Ativo</div>
                      </div>
                    </div>
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => handleEditSupplier(supplier.id)}
                        className="h-8 w-full"
                        isLoading={isEditing}
                        disabled={!canSaveEdit || isEditing}
                      >
                        Guardar
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingSupplier(null);
                          setEditDraft(emptyDraft());
                        }}
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
                    <div className="text-xs text-muted-foreground">
                      {supplier.nif ? `NIF: ${supplier.nif}` : ""}
                      {supplier.nif && supplier.phone ? " · " : ""}
                      {supplier.phone ? supplier.phone : ""}
                      {!supplier.isActive ? " · Inativo" : ""}
                    </div>
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => {
                          setEditingSupplier(supplier.id);
                          setEditDraft({
                            name: supplier.name ?? "",
                            nif: supplier.nif ?? "",
                            email: supplier.email ?? "",
                            phone: supplier.phone ?? "",
                            contactName: supplier.contactName ?? "",
                            address: supplier.address ?? "",
                            notes: supplier.notes ?? "",
                            isActive: supplier.isActive ?? true,
                          });
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
