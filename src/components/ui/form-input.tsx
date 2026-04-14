import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Label } from "./label"

interface FormInputProps extends React.ComponentProps<typeof Input> {
  label?: string
  icon?: React.ElementType
  rightElement?: React.ReactNode
  error?: string | null
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, icon: Icon, rightElement, error, className, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {label && (
          <Label className="text-sm font-medium text-slate-400 px-1">
            {label}
          </Label>
        )}
        <div className="relative">
          {Icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <Icon size={18} />
            </div>
          )}
          <Input
            ref={ref}
            className={cn(
              Icon && "pl-12",
              rightElement && "pr-12",
              error && "border-destructive focus-visible:ring-destructive",
              "h-12 bg-surface-low border-border rounded-none focus-visible:bg-surface-high transition-all"
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span className="text-xs text-destructive px-1 font-medium animate-in fade-in slide-in-from-top-1">
            {error}
          </span>
        )}
      </div>
    )
  }
)
FormInput.displayName = "FormInput"

export { FormInput }
