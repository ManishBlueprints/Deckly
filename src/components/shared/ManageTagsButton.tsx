import { Tag } from "lucide-react";

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
      className={`flex items-center gap-3 px-6 py-3 bg-surface-low border border-border text-xs font-bold text-[#bbcbbb]/60 hover:text-white transition-all ${className}`.trim()}
    >
      <Tag size={14} />
      {label}
    </button>
  );
}
