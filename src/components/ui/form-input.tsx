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
  ({ label, icon: Icon, rightElement, error, id, className, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`

    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {label && (
          <Label 
            htmlFor={inputId}
            className="px-1 text-sm font-medium text-ui-muted"
          >
            {label}
          </Label>
        )}
        <div className="relative">
          {Icon && (
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ui-muted">
              <Icon size={18} />
            </div>
          )}
          <Input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              Icon && "pl-12",
              rightElement && "pr-12",
              error && "border-ui-destructive focus-visible:ring-ui-destructive",
              "h-12 rounded-md border-ui-border bg-ui-surface text-ui-text transition-colors placeholder:text-ui-muted focus-visible:bg-ui-surface"
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
          <span id={errorId} className="animate-in fade-in slide-in-from-top-1 px-1 text-xs font-medium text-ui-destructive">
            {error}
          </span>
        )}
      </div>
    )
  }
)
FormInput.displayName = "FormInput"

export { FormInput }
