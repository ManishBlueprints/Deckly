import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useTheme } from "../../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../../utils/accessibleColor";

export interface ColorSwatchOption {
  key: string;
  label: string;
  hex: string;
}

interface ColorSwatchPickerProps {
  colors: readonly ColorSwatchOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  swatchClassName?: string;
  checkClassName?: string;
  renderLabel?: (color: ColorSwatchOption) => ReactNode;
}

export function ColorSwatchPicker({
  colors,
  value,
  onChange,
  className,
  swatchClassName,
  checkClassName,
  renderLabel,
}: ColorSwatchPickerProps) {
  const { theme } = useTheme();
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {colors.map((color) => {
        const isSelected = value === color.key;
        return (
          <button
            key={color.key}
            type="button"
            onClick={() => onChange(color.key)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--item-color-border)] bg-[var(--item-color)] transition-all",
              isSelected ? "scale-110 border-primary/50" : "border-border hover:scale-105",
              swatchClassName,
            )}
            style={asItemColorVariables(getAccessibleColorSet(color.hex, theme))}
            title={color.label}
            aria-label={color.label}
          >
            {isSelected && (
              <Check size={14} className={checkClassName ?? "text-[var(--item-color-foreground)]"} />
            )}
            {renderLabel?.(color)}
          </button>
        );
      })}
    </div>
  );
}
