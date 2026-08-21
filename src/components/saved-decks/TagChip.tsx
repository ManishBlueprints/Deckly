import { LibraryTag } from "../../types";
import { FOLDER_COLORS } from "../../constants/folderColors";
import { cn } from "../../lib/utils";
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";

interface TagChipProps {
  tag: LibraryTag;
  className?: string;
  size?: "sm" | "md";
}

export function TagChip({ tag, className, size = "sm" }: TagChipProps) {
  const { theme } = useTheme();
  const resolvedColor =
    FOLDER_COLORS.find((color) => color.key === tag.color)?.hex ?? tag.color;
  const colorVariables = asItemColorVariables(getAccessibleColorSet(resolvedColor, theme));

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--item-color-border)] bg-[var(--item-color)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[var(--item-color-foreground)] transition-colors",
        size === "md" && "px-2.5 py-1 text-[10px]",
        className,
      )}
      style={colorVariables}
    >
      {tag.name}
    </span>
  );
}
