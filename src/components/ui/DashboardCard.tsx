import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "./card";
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
    <Card
      className={cn(
        "rounded-[32px] border-white/5 overflow-hidden h-full bg-white/[0.02] backdrop-blur-xl shadow-2xl glass-shiny",
        className,
      )}
    >
      {(title || headerAction) && (
        <CardHeader
          className={cn(
            "p-6 md:p-8 border-b border-white/5 flex flex-row items-center justify-between space-y-0 bg-white/[0.01]",
            headerClassName,
          )}
        >
          {title && (
            <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {title}
            </CardTitle>
          )}
          {headerAction}
        </CardHeader>
      )}
      <CardContent className={cn("p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
