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
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border bg-surface-low text-xs font-bold text-muted-foreground transition-all hover:border-primary/35 hover:bg-surface-high hover:text-foreground md:w-auto md:px-6 md:gap-3",
        className,
      )}
    >
      <Tag size={15} />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
