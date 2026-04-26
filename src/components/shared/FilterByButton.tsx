import { Filter } from "lucide-react";
import { cn } from "../../lib/utils";

interface FilterByButtonProps {
  onClick: () => void;
  active?: boolean;
  label?: string;
  className?: string;
}

export function FilterByButton({
  onClick,
  active = false,
  label = "Filter By",
  className = "",
}: FilterByButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-6 py-3 border text-xs font-bold transition-all",
        active
          ? "bg-[#54e98a]/10 border-[#54e98a]/20 text-[#54e98a]"
          : "bg-surface-low border-border text-[#bbcbbb]/60 hover:text-white",
        className,
      )}
    >
      <Filter size={14} />
      {label}
    </button>
  );
}
