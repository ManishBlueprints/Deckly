import * as React from "react";
import { cn } from "../../lib/utils";

export function Surface({
  tone = "plain",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "plain" | "subtle" | "elevated" }) {
  return (
    <div
      className={cn(
        "border border-ui-border text-ui-text",
        tone === "plain" && "bg-ui-surface",
        tone === "subtle" && "bg-ui-subtle",
        tone === "elevated" && "bg-ui-elevated shadow-[var(--ui-shadow-surface)]",
        className,
      )}
      {...props}
    />
  );
}
