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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 px-6 py-3 border text-xs font-bold transition-all outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#54e98a] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-lowest",
        active
          ? "bg-[#54e98a]/10 border-[#54e98a]/20 text-[#54e98a]"
          : "bg-surface-low border-border text-[#bbcbbb]/60 hover:text-white",
        className,
      )}
    >
      <Filter size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
