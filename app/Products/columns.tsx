"use client";

import { Product } from "@/app/types";
import { Column, ColumnDef } from "@tanstack/react-table";

import ProductActionsIcons from "./ProductActionsIcons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import { IoMdArrowDown, IoMdArrowUp } from "react-icons/io";
import { QRCodeHover } from "@/components/ui/qr-code-hover";

type SortableHeaderProps = {
  column: Column<Product, unknown>;
  label: string;
  align?: "left" | "right";
};

function SortableHeader({ column, label, align = "left" }: SortableHeaderProps) {
  const isSorted = column.getIsSorted();
  const SortingIcon =
    isSorted === "asc"
      ? IoMdArrowUp
      : isSorted === "desc"
        ? IoMdArrowDown
        : ArrowUpDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1 select-none cursor-pointer ${align === "right" ? "justify-end" : ""} ${isSorted ? "text-primary" : ""}`}
          aria-label={`Sort by ${label}`}
        >
          {label}
          <SortingIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        {/* Ascending Sorting */}
        <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
          <IoMdArrowUp className="mr-2 h-4 w-4" />
          Asc
        </DropdownMenuItem>
        {/* Descending Sorting */}
        <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
          <IoMdArrowDown className="mr-2 h-4 w-4" />
          Desc
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader column={column} label="Created At" />
    ),
    cell: ({ getValue }) => {
      const dateValue = getValue<string | Date>();
      const date =
        typeof dateValue === "string" ? new Date(dateValue) : dateValue;

      if (!date || isNaN(date.getTime())) {
        return <span>Unknown Date</span>;
      }

      return (
        <span>
          {date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      );
    },
  },
  {
    accessorKey: "name",
    cell: ({ row }) => {
      const name = row.original.name;
      return (
        <span className="font-medium">{name}</span>
      );
    },
    header: ({ column }) => <SortableHeader column={column} label="Name" />,
  },
  {
    accessorKey: "sku",
    header: ({ column }) => <SortableHeader column={column} label="SKU" />,
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => <SortableHeader column={column} label="Quantity" />,
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      const isLowStock = quantity > 0 && quantity < 10;
      const isOutOfStock = quantity === 0;

      return (
        <div className="flex items-center gap-2">
          <span className={isLowStock || isOutOfStock ? "font-semibold" : ""}>
            {quantity}
          </span>
          {isLowStock && (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
          {isOutOfStock && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => <SortableHeader column={column} label="Price" />,
    cell: ({ getValue }) => `$${getValue<number>().toFixed(2)}`,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      let status = "";
      let colorClass = "";

      if (quantity > 20) {
        status = "Available";
        colorClass = "bg-green-100 text-green-600";
      } else if (quantity > 0 && quantity <= 20) {
        status = "Stock Low";
        colorClass = "bg-orange-100 text-orange-600";
      } else {
        status = "Stock Out";
        colorClass = "bg-red-100 text-red-600";
      }

      return (
        <span
          className={`px-3 py-[2px] rounded-full font-medium ${colorClass} flex gap-1 items-center w-fit`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const categoryName = row.original.category;
      return <span>{categoryName || "Unknown"}</span>;
    },
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => {
      const supplierName = row.original.supplier; // Display supplier name
      return <span>{supplierName || "Unknown"}</span>;
    },
  },
  {
    id: "qrCode",
    header: "QR Code",
    cell: ({ row }) => {
      const product = row.original;
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
        <QRCodeHover
          data={qrData}
          title={`${product.name} QR`}
          size={200}
        />
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-right">Ações</div>,
    enableSorting: false,
    meta: { align: "right" },
    cell: ({ row }) => {
      return <ProductActionsIcons product={row.original} />;
    },
  },
];

// Debug log for columns - only log in development
if (process.env.NODE_ENV === 'development') {
  console.log("Columns passed to useReactTable:", columns);
}
