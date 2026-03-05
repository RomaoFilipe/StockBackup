"use client";

import * as React from "react";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { LuGitPullRequestDraft } from "react-icons/lu";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useProductStore } from "@/app/useProductStore";
import { useAuth } from "@/app/authContext";

type CategoryDropDownProps = {
  selectedCategory: string[];
  setSelectedCategory: React.Dispatch<React.SetStateAction<string[]>>;
  buttonClassName?: string;
  buttonVariant?: ButtonProps["variant"];
  label?: string;
};

export function CategoryDropDown({
  selectedCategory,
  setSelectedCategory,
  buttonClassName,
  buttonVariant = "outline",
  label = "Categoria",
}: CategoryDropDownProps) {
  const [open, setOpen] = React.useState(false);
  const { categories, loadCategories } = useProductStore();
  const { user } = useAuth(); // Get the logged-in user's info

  const selectedCount = selectedCategory.length;
  const displayLabel = selectedCount > 0 ? `${label} (${selectedCount})` : label;

  React.useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Filter categories by userId
  const userCategories = React.useMemo(() => {
    return categories.filter((category) => category.userId === user?.id);
  }, [categories, user]);

  function handleCheckboxChange(value: string) {
    setSelectedCategory((prev) => {
      const updatedCategories = prev.includes(value)
        ? prev.filter((category) => category !== value)
        : [...prev, value];
      return updatedCategories;
    });
  }

  function clearFilters() {
    setSelectedCategory([]);
  }

  return (
    <div className="poppins">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={buttonVariant} className={buttonClassName ?? "h-10"}>
            <LuGitPullRequestDraft />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-56 poppins" side="bottom" align="end">
          <Command className="p-1">
            <CommandInput placeholder="Categoria" />
            <CommandList>
              <CommandEmpty className="text-slate-500 text-sm text-center p-5">
                Nenhuma categoria encontrada.
              </CommandEmpty>
              <CommandGroup>
                {userCategories.map((category) => (
                  <CommandItem className="h-9" key={category.id}>
                    <Checkbox
                      checked={selectedCategory.includes(category.id)} // Use category ID
                      onClick={() => handleCheckboxChange(category.id)} // Pass category ID
                      className="size-4 rounded-[4px]"
                    />
                    <div
                      className={`flex items-center gap-1 p-1 rounded-lg px-3 text-[14px]`}
                    >
                      {category.name}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="flex flex-col gap-2 text-[23px]">
              <Separator />
              <Button
                onClick={clearFilters}
                variant={"ghost"}
                className="text-[12px] mb-1"
              >
                Limpar filtros
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
