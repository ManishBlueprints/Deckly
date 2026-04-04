import { motion, HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "small" | "medium" | "large";
  icon?: React.ElementType;
  fullWidth?: boolean;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "medium",
  disabled = false,
  type = "button",
  className = "",
  icon: Icon,
  fullWidth = false,
  loading = false,
  ...props
}) => {
  const variants = {
    primary:
      "bg-deckly-primary text-slate-950 hover:bg-opacity-90 active:scale-95",
    secondary:
      "bg-deckly-secondary text-slate-950 hover:bg-opacity-90 backdrop-blur-md active:scale-95",
    danger: "bg-destructive text-destructive-foreground hover:bg-opacity-90 active:scale-95",
    ghost: "bg-transparent text-white hover:bg-white/10 active:scale-95",
  };

  const sizes = {
    small: "px-3 py-1.5 text-sm gap-1.5",
    medium: "px-4 py-2 gap-2",
    large: "px-6 py-3 text-lg gap-3",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "relative flex items-center justify-center font-bold rounded-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs",
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={size === "large" ? 22 : 18} strokeWidth={3} />}
          {children}
        </>
      )}
    </motion.button>
  );
};

export default Button;
