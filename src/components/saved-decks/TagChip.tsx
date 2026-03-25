import { LibraryTag } from "../../types";
import { cn } from "../../utils/cn";

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
        backgroundColor: `${tag.color}15`, // 15% opacity
        color: tag.color,
        border: `1px solid ${tag.color}30`, // 30% opacity
      }}
    >
      {tag.name}
    </span>
  );
}
