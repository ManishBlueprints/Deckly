import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface AnalyticsTabItem {
  value: string;
  label: string;
  shortLabel?: string;
}

export function AnalyticsSectionHeader({
  icon,
  title,
  tabs,
  rightSlot,
}: {
  icon: ReactNode;
  title: string;
  tabs?: ReactNode;
  rightSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      <div className="flex items-center gap-3 md:flex-1">
        <div className="w-8 h-8 rounded-md bg-surface-lowest flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {title}
        </h3>
      </div>

      <div className="flex-1 flex justify-center">{tabs}</div>

      <div className="hidden md:block md:flex-1">{rightSlot}</div>
    </div>
  );
}

export function AnalyticsTabs({
  value,
  onValueChange,
  tabs,
  className,
  tabsListClassName,
  triggerClassName,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: AnalyticsTabItem[];
  className?: string;
  tabsListClassName?: string;
  triggerClassName?: string;
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <div className="w-full overflow-x-auto custom-scrollbar flex justify-center">
        <TabsList
          className={cn(
            "bg-surface-lowest border border-border p-1 h-auto rounded-md gap-1 flex shrink-0 w-fit",
            tabsListClassName,
          )}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "rounded-sm text-[11px] font-bold px-4 py-1.5 text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200 whitespace-nowrap shrink-0",
                triggerClassName,
              )}
            >
              {tab.shortLabel ? (
                <>
                  <span className="md:hidden">{tab.shortLabel}</span>
                  <span className="hidden md:inline">{tab.label}</span>
                </>
              ) : (
                tab.label
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
}

export function AnalyticsStatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col bg-surface-card rounded-lg p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-md bg-surface-lowest flex items-center justify-center text-primary">
          {icon}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

export function AnalyticsEmptyState({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="py-20 text-center space-y-6">
      <div className="w-24 h-24 bg-surface-low rounded-[2.5rem] flex items-center justify-center mx-auto text-muted-foreground relative">
        <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full" />
        {icon}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
          {text}
        </p>
      </div>
    </div>
  );
}

export function AnalyticsLocationColumn<T extends { count: number }>({
  icon,
  title,
  items,
  max,
  renderLabel,
  barClassName,
}: {
  icon: ReactNode;
  title: string;
  items: T[];
  max: number;
  renderLabel: (item: T) => string;
  barClassName: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="space-y-4">
        {items.map((item, i) => (
          <div key={`${renderLabel(item)}-${i}`} className="space-y-2">
            <div className="flex justify-between text-[11px] font-medium">
              <span className="text-foreground flex items-center gap-2">
                <span className="text-muted-foreground">#{i + 1}</span>
                {renderLabel(item)}
              </span>
            </div>
            <div className="h-1.5 bg-surface-container rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.count / max) * 100}%` }}
                className={cn("h-full", barClassName)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsMetricRow({
  leftLabel,
  valueLabel,
  percent,
  barClassName,
  valueClassName,
  rowClassName,
  labelClassName,
  barContainerClassName,
  minPercent = 4,
  title,
}: {
  leftLabel: ReactNode;
  valueLabel: ReactNode;
  percent: number;
  barClassName: string;
  valueClassName?: string;
  rowClassName?: string;
  labelClassName?: string;
  barContainerClassName?: string;
  minPercent?: number;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center sm:gap-4",
        rowClassName,
      )}
      title={title}
    >
      <div className={cn("min-w-0", labelClassName)}>{leftLabel}</div>
      <div
        className={cn(
          "relative min-w-0 h-10 bg-surface-low overflow-hidden",
          barContainerClassName,
        )}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(percent, minPercent)}%` }}
          className={cn(
            "h-full flex items-center justify-end px-4 transition-all duration-300",
            barClassName,
          )}
        >
          <span className={cn("text-sm font-medium whitespace-nowrap", valueClassName)}>
            {valueLabel}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
