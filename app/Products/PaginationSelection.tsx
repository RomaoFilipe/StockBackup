"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Dispatch, SetStateAction } from "react";

// Define PaginationType locally
export interface PaginationType {
  pageIndex: number;
  pageSize: number;
}

export default function PaginationSelection({
  pagination,
  setPagination,
  label = "Linhas por página",
  className,
  triggerClassName,
}: {
  pagination: PaginationType;
  setPagination: Dispatch<SetStateAction<PaginationType>>;
  label?: string;
  className?: string;
  triggerClassName?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <Select
        value={pagination.pageSize.toString()}
        onValueChange={(value) =>
          setPagination((prev) => ({
            ...prev,
            pageSize: Number(value),
          }))
        }
      >
        <SelectTrigger className={triggerClassName ?? "h-9 w-[84px]"}>
          <SelectValue placeholder={pagination.pageSize.toString()} />
        </SelectTrigger>
        <SelectContent>
          {[4, 6, 8, 10, 15, 20, 30].map((size) => (
            <SelectItem key={size} value={size.toString()}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
