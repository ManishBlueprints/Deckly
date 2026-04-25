import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

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
              "w-8 h-8 rounded-full border transition-all flex items-center justify-center",
              isSelected ? "scale-110 border-primary/50" : "border-border hover:scale-105",
              swatchClassName,
            )}
            style={{ backgroundColor: color.hex }}
            title={color.label}
            aria-label={color.label}
          >
            {isSelected && (
              <Check size={14} className={checkClassName ?? "text-primary-foreground/80"} />
            )}
            {renderLabel?.(color)}
          </button>
        );
      })}
    </div>
  );
}
