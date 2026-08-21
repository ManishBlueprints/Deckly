import * as React from "react";
import { cn } from "../../lib/utils";

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const description = error ?? hint;
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ui-text">
        {label}{required && <span className="ml-1 text-ui-destructive" aria-hidden="true">*</span>}
      </label>
      {children}
      {description && (
        <p className={cn("text-xs", error ? "text-ui-destructive" : "text-ui-muted")} role={error ? "alert" : undefined}>
          {description}
        </p>
      )}
    </div>
  );
}
