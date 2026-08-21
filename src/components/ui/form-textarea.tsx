import * as React from "react"
import { cn } from "@/lib/utils"
import { Textarea } from "./textarea"
import { Label } from "./label"

interface FormTextareaProps extends React.ComponentProps<typeof Textarea> {
  label?: string
  error?: string | null
  containerClassName?: string
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, className, containerClassName, id, ...props }, ref) => {
    const generatedId = React.useId()
    const textareaId = id || generatedId

    return (
      <div className={cn("flex flex-col gap-2 w-full", containerClassName)}>
        {label && (
          <Label 
            htmlFor={textareaId}
            className="px-1 text-sm font-medium text-ui-muted"
          >
            {label}
          </Label>
        )}
        <div className="relative">
          <Textarea
            ref={ref}
            id={textareaId}
            className={cn(
              error && "border-destructive focus-visible:ring-destructive",
              "min-h-[120px] rounded-none border-ui-border bg-ui-surface transition-all focus-visible:bg-ui-subtle",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <span className="animate-in fade-in slide-in-from-top-1 px-1 text-xs font-medium text-ui-destructive">
            {error}
          </span>
        )}
      </div>
    )
  }
)
FormTextarea.displayName = "FormTextarea"

export { FormTextarea }
