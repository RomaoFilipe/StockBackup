"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";

import { Product } from "@/app/types";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ProductActionsIconsProps {
	product: Product;
}

export default function ProductActionsIcons({ product }: ProductActionsIconsProps) {
	const { deleteProduct, setSelectedProduct, setOpenProductDialog } = useProductStore();
	const router = useRouter();
	const { toast } = useToast();
	const [isDeleting, setIsDeleting] = useState(false);

	const handleView = () => {
		router.push(`/products/${product.id}`);
	};

	const handleEdit = () => {
		try {
			setSelectedProduct(product);
			setOpenProductDialog(true);
		} catch (error) {
			console.error("Error opening edit dialog:", error);
		}
	};

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			const result = await deleteProduct(product.id);
			if (result.success) {
				toast({
					title: "Product Deleted Successfully!",
					description: `"${product.name}" has been permanently deleted.`,
				});
				router.refresh();
			} else {
				toast({
					title: "Delete Failed",
					description: "Failed to delete the product. Please try again.",
					variant: "destructive",
				});
			}
		} catch {
			toast({
				title: "Delete Failed",
				description: "An unexpected error occurred while deleting the product.",
				variant: "destructive",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="flex items-center justify-end gap-1" data-no-row-click>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={handleView}
				title="Detalhes"
				aria-label="Ver detalhes do produto"
				className="h-8 w-8"
			>
				<Eye className="h-4 w-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={handleEdit}
				title="Editar"
				aria-label="Editar produto"
				className="h-8 w-8"
			>
				<Pencil className="h-4 w-4" />
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={handleDelete}
				title="Apagar"
				aria-label="Apagar produto"
				className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
				isLoading={isDeleting}
			>
				<Trash2 className="h-4 w-4" />
			</Button>
		</div>
	);
}

