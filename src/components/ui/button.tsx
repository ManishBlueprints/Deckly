import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { buttonVariants } from "./button-variants"
import { type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: React.ElementType
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, fullWidth = false, icon: Icon, children, ...props }, ref) => {
    const Comp = asChild && !loading && !Icon ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), fullWidth ? "w-full" : "")}
        ref={ref}
        {...props}
        disabled={props.disabled || loading}
      >
        {loading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            {Icon && <Icon className="shrink-0" />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button }
