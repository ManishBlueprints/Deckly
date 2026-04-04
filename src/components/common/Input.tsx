import React from "react";
import { cn } from "../../utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ElementType;
  rightElement?: React.ReactNode;
  error?: string | null;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  rightElement,
  error,
  className = "",
  onClick,
  readOnly = false,
  ...props
}) => {
  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {label && (
        <label className="text-sm font-medium text-slate-400 px-1">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 bg-surface-low border border-border rounded-none transition-all duration-200 focus-within:border-primary/50 focus-within:bg-surface-high group",
          error ? "border-destructive/50 bg-destructive/5" : "",
          onClick ? "cursor-pointer" : "",
        )}
        onClick={onClick}
      >
        {Icon && (
          <Icon
            size={18}
            className={cn(
              "text-slate-500 group-focus-within:text-primary transition-colors",
              error ? "text-destructive" : "",
            )}
          />
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className="bg-transparent border-none outline-none w-full text-white placeholder-slate-600"
          {...props}
        />
        {rightElement && (
          <div className="flex items-center justify-center shrink-0">
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
  );
};

export default Input;
