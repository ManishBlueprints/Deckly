import { LibraryTag } from "../../types";
import { FOLDER_COLORS } from "../../constants/folderColors";
import { cn } from "../../utils/cn";
import { hexWithAlpha } from "../../utils/colorHelpers";

interface TagChipProps {
  tag: LibraryTag;
  className?: string;
  size?: "sm" | "md";
}

export function TagChip({ tag, className, size = "sm" }: TagChipProps) {
  const resolvedColor =
    FOLDER_COLORS.find((color) => color.key === tag.color)?.hex ?? tag.color;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors",
        size === "md" && "px-2.5 py-1 text-[10px]",
        className,
      )}
      style={{
        backgroundColor: hexWithAlpha(resolvedColor, 0.15),
        color: resolvedColor,
        border: `1px solid ${hexWithAlpha(resolvedColor, 0.3)}`,
      }}
    >
      {tag.name}
    </span>
  );
}
