import { LibraryTag } from "../../types";
import { cn } from "../../utils/cn";
import { hexWithAlpha } from "../../utils/colorHelpers";

interface TagChipProps {
  tag: LibraryTag;
  className?: string;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, className, size = 'sm' }: TagChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-colors",
        size === 'md' && "px-2.5 py-1 text-[10px]",
        className
      )}
      style={{
        backgroundColor: hexWithAlpha(tag.color, 0.15),
        color: tag.color,
        border: `1px solid ${hexWithAlpha(tag.color, 0.30)}`,
      }}
    >
      {tag.name}
    </span>
  );
}
