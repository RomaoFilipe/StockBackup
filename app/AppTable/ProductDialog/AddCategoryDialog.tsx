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

export default function AddCategoryDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Button loading state
  const [isEditing, setIsEditing] = useState(false); // Loading state for edit
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const {
    categories,
    addCategory,
    editCategory,
    deleteCategory,
    loadCategories,
  } = useProductStore();
  const { toast } = useToast();
  const { user, isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      loadCategories();
    }
  }, [isLoggedIn, loadCategories]);

  const handleAddCategory = async () => {
    if (categoryName.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome da categoria não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true); // Start loading
    try {
      const response = await axiosInstance.post("/categories", {
        name: categoryName,
        userId: user?.id,
      });

      if (response.status !== 201) {
        throw new Error("Failed to add category");
      }

      const newCategory = response.data;
      addCategory(newCategory);
      setCategoryName("");
      toast({
        title: "Categoria criada",
        description: `"${categoryName}" foi adicionada.`,
      });
      loadCategories();
    } catch (error) {
      console.error("Error adding category:", error);
      toast({
        title: "Falha ao criar",
        description: "Não foi possível criar a categoria. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const handleEditCategory = async (categoryId: string) => {
    if (newCategoryName.trim() === "") {
      toast({
        title: "Erro",
        description: "O nome da categoria não pode estar vazio.",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true); // Start loading
    try {
      const response = await axiosInstance.put("/categories", {
        id: categoryId,
        name: newCategoryName,
      });

      if (response.status !== 200) {
        throw new Error("Failed to edit category");
      }

      const updatedCategory = response.data;
      editCategory(categoryId, updatedCategory.name);
      setEditingCategory(null);
      setNewCategoryName("");
      toast({
        title: "Categoria atualizada",
        description: `"${updatedCategory.name}" foi atualizada.`,
      });
      loadCategories();
    } catch (error) {
      console.error("Error editing category:", error);
      toast({
        title: "Falha ao atualizar",
        description: "Não foi possível atualizar a categoria. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false); // Stop loading
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setDeletingCategoryId(categoryId);

    // Find the category name before deleting for the toast message
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    const categoryName = categoryToDelete?.name || "Categoria desconhecida";

    try {
      const response = await axiosInstance.delete("/categories", {
        data: { id: categoryId },
      });

      if (response.status !== 204) {
        throw new Error("Failed to delete category");
      }

      deleteCategory(categoryId);
      toast({
        title: "Categoria removida",
        description: `"${categoryName}" foi removida.`,
      });
      loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Falha ao remover",
        description: "Não foi possível remover a categoria. Tenta novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingCategoryId(null);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? <Button className="h-10 font-semibold">Adicionar categoria</Button>}
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-4 sm:p-7 sm:px-8"
        aria-describedby="category-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">Adicionar categoria</DialogTitle>
        </DialogHeader>
        <DialogDescription id="category-dialog-description">
          Indica o nome da nova categoria
        </DialogDescription>
        <Input
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          placeholder="Nova categoria"
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
            onClick={handleAddCategory}
            className="h-11 w-full sm:w-auto px-11"
            isLoading={isSubmitting}
          >
            Adicionar categoria
          </Button>
        </DialogFooter>
        <div className="mt-4">
          <h3 className="text-lg font-semibold">Categorias</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {categories
              .filter((category) => category.userId === user?.id)
              .map((category) => (
              <div
                key={category.id}
                className="p-4 border rounded-lg shadow-sm flex flex-col justify-between"
              >
                {editingCategory === category.id ? (
                  <div className="flex flex-col space-y-2">
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Edit Category"
                      className="h-8"
                    />
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => handleEditCategory(category.id)}
                        className="h-8 w-full"
                        isLoading={isEditing}
                      >
                        Guardar
                      </Button>
                      <Button
                        onClick={() => setEditingCategory(null)}
                        variant="outline"
                        className="h-8 w-full"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => {
                          setEditingCategory(category.id);
                          setNewCategoryName(category.name);
                        }}
                        variant="outline"
                        className="h-8 w-full"
                      >
                        <FaEdit />
                      </Button>
                      <Button
                        onClick={() => handleDeleteCategory(category.id)}
                        variant="destructive"
                        className="h-8 w-full"
                        isLoading={deletingCategoryId === category.id}
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
