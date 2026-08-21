import React from "react";
import { cn } from "../../lib/utils";

interface DashboardCardProps {
  title?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
}

export function DashboardCard({
  title,
  headerAction,
  children,
  className,
  contentClassName,
  headerClassName,
}: DashboardCardProps) {
  return (
    <div
      className={cn(
        "h-full w-full rounded-card border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-surface)]",
        !className?.includes("overflow-") && "overflow-hidden",
        className,
      )}
    >
      {(title || headerAction) && (
        <div
          className={cn(
            "flex flex-row items-center justify-between border-b border-ui-border bg-ui-surface px-5 py-4",
            headerClassName,
          )}
        >
          {title && (
            <h3 className="text-sm font-medium text-ui-text">{title}</h3>
          )}
          {headerAction}
        </div>
      )}
      <div className={cn("p-0 text-sm", contentClassName)}>{children}</div>
    </div>
  );
}
