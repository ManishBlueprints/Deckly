import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-[10px] font-bold uppercase tracking-[0.2em] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-deckly-primary text-slate-950 shadow hover:bg-deckly-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-white/10 bg-transparent shadow-sm hover:bg-white/5 hover:text-accent-foreground",
        secondary:
          "bg-slate-800 text-slate-100 shadow-sm hover:bg-slate-700",
        ghost: "hover:bg-white/5 text-slate-400 hover:text-white",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 text-[9px]",
        lg: "h-14 px-10 text-xs",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
