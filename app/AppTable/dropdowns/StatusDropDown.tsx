import React from "react";
import { FaCheck } from "react-icons/fa";
import { IoClose } from "react-icons/io5";
import { LuGitPullRequestDraft } from "react-icons/lu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button, ButtonProps } from "@/components/ui/button";
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

type Status = {
  value: "Available" | "Stock Out" | "Stock Low";
  label: string;
  icon: React.ReactNode;
};

const statuses: Status[] = [
  { value: "Available", label: "Disponível", icon: <FaCheck /> },
  { value: "Stock Out", label: "Sem stock", icon: <IoClose /> },
  { value: "Stock Low", label: "Stock baixo", icon: <LuGitPullRequestDraft /> },
];

type StatusDropDownProps = {
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  buttonClassName?: string;
  buttonVariant?: ButtonProps["variant"];
  label?: string;
};

export function StatusDropDown({
  selectedStatuses,
  setSelectedStatuses,
  buttonClassName,
  buttonVariant = "outline",
  label = "Estado",
}: StatusDropDownProps) {
  const [open, setOpen] = React.useState(false);

  const selectedCount = selectedStatuses.length;
  const displayLabel = selectedCount > 0 ? `${label} (${selectedCount})` : label;

  function returnColor(status: string) {
    switch (status) {
      case "Available":
        return "text-green-600 bg-green-100";
      case "Stock Out":
        return "text-red-600 bg-red-100";
      case "Stock Low":
        return "text-orange-600 bg-orange-100";
      default:
        return "";
    }
  }

  function handleCheckboxChange(value: string) {
    setSelectedStatuses((prev) => {
      const updatedStatuses = prev.includes(value)
        ? prev.filter((status) => status !== value)
        : [...prev, value];
      return updatedStatuses;
    });
  }

  function clearFilters() {
    setSelectedStatuses([]);
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
        <PopoverContent
          className="p-0 w-48 poppins"
          side="bottom"
          align="center"
        >
          <Command className="p-1">
            <CommandList>
              <CommandGroup>
                {statuses.map((status) => (
                  <CommandItem
                    className="h-10 mb-2 flex items-center"
                    key={status.value}
                    value={status.value}
                    onClick={() => handleCheckboxChange(status.value)}
                  >
                    <Checkbox
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={() => handleCheckboxChange(status.value)}
                      className="size-4 rounded-[4px] mr-2"
                    />
                    <div
                      className={`flex items-center gap-1 ${returnColor(
                        status.value
                      )} p-1 rounded-lg px-4 text-[13px]`}
                    >
                      {status.icon}
                      {status.label}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="flex flex-col gap-2 text-[23px]">
              <Separator />
              <Button
                variant="ghost"
                className="text-[12px] mb-1"
                onClick={clearFilters}
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
