import * as React from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "./textarea"
import { Label } from "./label"

interface FormTextareaProps extends React.ComponentProps<typeof Textarea> {
  label?: string
  error?: string | null
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-2 w-full", className)}>
        {label && (
          <Label className="text-sm font-medium text-slate-400 px-1">
            {label}
          </Label>
        )}
        <div className="relative">
          <Textarea
            ref={ref}
            className={cn(
              error && "border-destructive focus-visible:ring-destructive",
              "min-h-[120px] bg-slate-900 border-white/10 rounded-none focus-visible:bg-slate-800 transition-all",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="text-xs text-red-500 px-1 font-medium animate-in fade-in slide-in-from-top-1">
            {error}
          </span>
        )}
      </div>
    )
  }
)
FormTextarea.displayName = "FormTextarea"

export { FormTextarea }
