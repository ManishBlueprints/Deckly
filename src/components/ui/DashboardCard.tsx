import React from "react";
import { cn } from "../../utils/cn";

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
        "rounded-none border border-border h-full bg-surface-card",
        !className?.includes("overflow-") && "overflow-hidden",
        className,
      )}
    >
      {(title || headerAction) && (
        <div
          className={cn(
            "px-5 py-4 border-b border-border flex flex-row items-center justify-between bg-surface-card",
            headerClassName,
          )}
        >
          {title && (
            <h3 className="text-sm font-medium text-slate-200">{title}</h3>
          )}
          {headerAction}
        </div>
      )}
      <div className={cn("p-0 text-sm", contentClassName)}>{children}</div>
    </div>
  );
}
