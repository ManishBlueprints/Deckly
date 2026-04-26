import { Tag } from "lucide-react";
import { cn } from "../../utils/cn";

interface ManageTagsButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function ManageTagsButton({
  onClick,
  label = "Edit Tags",
  className = "",
}: ManageTagsButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center bg-surface-low border border-border text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all md:w-auto md:px-6 md:gap-3",
        className,
      )}
    >
      <Tag size={14} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
