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
        "rounded-lg border border-[#222] overflow-hidden h-full bg-[#10120f]",
        className,
      )}
    >
      {(title || headerAction) && (
        <div
          className={cn(
            "px-5 py-4 border-b border-[#222] flex flex-row items-center justify-between bg-[#10120f]",
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
