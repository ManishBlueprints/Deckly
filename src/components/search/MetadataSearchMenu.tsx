import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  type MetadataSearchDateFilter,
  type MetadataSearchDatePreset,
  type MetadataSearchFilterState,
  METADATA_SEARCH_DATE_PRESETS,
} from "../../types";
import { cn } from "@/lib/utils";

const DATE_PRESET_LABELS: Record<MetadataSearchDatePreset, string> = {
  today: "Today",
  last_7_days: "7 days",
  last_30_days: "30 days",
  custom: "Custom range",
};

export interface MetadataSearchMenuProps {
  filter: MetadataSearchFilterState;
  isActive: boolean;
  onModeChange: (mode: MetadataSearchFilterState["mode"]) => void;
  onQueryChange: (query: string) => void;
  onDatePresetChange: (preset: MetadataSearchDatePreset) => void;
  onCustomDateRangeChange: (startDate: string, endDate: string) => void;
  onClear: () => void;
  resultCount?: number;
  className?: string;
  triggerLabel?: string;
  namePlaceholder?: string;
  filterOptions?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  selectedFilterId?: string | null;
  onFilterChange?: (filterId: string | null) => void;
  filterEmptyMessage?: string;
}

/**
 * Shared metadata-only search control for page-scoped search.
 * Pages keep item rendering and field matching logic; this component only captures filter state.
 */
export function MetadataSearchMenu({
  filter,
  isActive,
  onModeChange,
  onQueryChange,
  onDatePresetChange,
  onCustomDateRangeChange,
  onClear,
  resultCount,
  className,
  triggerLabel = "Search",
  namePlaceholder = "Search by name...",
  filterOptions = [],
  selectedFilterId = null,
  onFilterChange,
  filterEmptyMessage = "No filters available",
}: MetadataSearchMenuProps) {
  const activeSummary = buildActiveSummary(
    filter,
    selectedFilterId ? filterOptions.find((option) => option.id === selectedFilterId)?.name : null,
  );
  const [open, setOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || (filter.mode !== "name" && filter.mode !== "filter")) return;

    const timeout = window.setTimeout(() => {
      if (filter.mode === "name") {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open, filter.mode]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          className={cn(
            "inline-flex h-11 w-[220px] items-center justify-between border border-border bg-surface-low px-4 text-sm font-semibold text-foreground shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-all hover:border-primary/35 hover:bg-surface-high",
            isActive && "border-primary/45 bg-primary/10 text-foreground shadow-[0_14px_34px_rgba(34,197,94,0.10)]",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Search size={17} className={cn("shrink-0 text-muted-foreground", isActive && "text-primary")} />
            <span className="leading-none">{triggerLabel}</span>
          </span>

          <span className="flex items-center gap-2">
            {typeof resultCount === "number" && isActive ? (
              <Badge variant="secondary" className="h-5 border-0 bg-primary/15 px-1.5 text-[10px] leading-none text-primary">
                {resultCount}
              </Badge>
            ) : null}
            {isActive ? (
              <Badge
                variant="outline"
                className="max-w-[120px] truncate border-primary/25 bg-primary/10 text-[10px] leading-none text-primary"
              >
                {activeSummary}
              </Badge>
            ) : null}
            <SlidersHorizontal size={15} className="shrink-0 opacity-70" />
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[320px] space-y-5 border border-border bg-popover/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-primary">Page Search</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Filter the current page by name or date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={!isActive}
            className="inline-flex items-center gap-1 px-0 py-0 text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={12} />
            Clear
          </button>
        </div>

        <div className={cn("grid border border-border bg-surface-low", filterOptions.length > 0 ? "grid-cols-3" : "grid-cols-2")}>
          <ModeButton
            active={filter.mode === "name"}
            icon={<Search size={16} />}
            label="Name"
            onClick={() => onModeChange("name")}
          />
          <ModeButton
            active={filter.mode === "date"}
            icon={<CalendarDays size={16} />}
            label="Date"
            onClick={() => onModeChange("date")}
          />
          {filterOptions.length > 0 && (
            <ModeButton
              active={filter.mode === "filter"}
              icon={<Filter size={16} />}
              label="Filter"
              onClick={() => onModeChange("filter")}
            />
          )}
        </div>

        {filter.mode === "name" ? (
          <div className="space-y-3">
            <label className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Search query
            </label>
            <Input
              ref={nameInputRef}
              value={filter.query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={namePlaceholder}
              aria-label="Search by name"
              className="h-12 border-primary/35 bg-surface-low px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
            />
          </div>
        ) : filter.mode === "filter" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Available filters
              </label>
              <button
                type="button"
                onClick={() => onFilterChange?.(null)}
                disabled={!selectedFilterId}
                className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={11} />
                Clear
              </button>
            </div>

            {filterOptions.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface-low px-4 py-6 text-sm text-muted-foreground">
                {filterEmptyMessage}
              </div>
            ) : (
              <div className="space-y-2">
                {filterOptions.map((option) => {
                  const isSelected = selectedFilterId === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        onFilterChange?.(isSelected ? null : option.id)
                      }
                      className={cn(
                        "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-all",
                        isSelected
                          ? "border-primary/35 bg-primary/12"
                          : "border-border bg-surface-low hover:border-primary/20 hover:bg-surface-high",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: option.color }}
                        />
                        <span className="truncate text-sm font-semibold text-foreground">
                          {option.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          Applied
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-3">
              <label className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Date range
              </label>
              <div className="grid grid-cols-2 gap-2">
                {METADATA_SEARCH_DATE_PRESETS.map((preset) => (
                  <DatePresetButton
                    key={preset}
                    preset={preset}
                    active={filter.date.preset === preset}
                    onClick={() => onDatePresetChange(preset)}
                  />
                ))}
              </div>
            </div>

            {filter.date.preset === "custom" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Start
                  </label>
                  <Input
                    type="date"
                    value={filter.date.startDate}
                    onChange={(event) =>
                      onCustomDateRangeChange(event.target.value, filter.date.endDate)
                    }
                    aria-label="Custom start date"
                    className="h-10 border-primary/35 bg-surface-low px-3 text-sm text-foreground focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    End
                  </label>
                  <Input
                    type="date"
                    value={filter.date.endDate}
                    onChange={(event) =>
                      onCustomDateRangeChange(filter.date.startDate, event.target.value)
                    }
                    aria-label="Custom end date"
                    className="h-10 border-primary/35 bg-surface-low px-3 text-sm text-foreground focus-visible:ring-primary/40"
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function buildActiveSummary(filter: MetadataSearchFilterState, activeFilterName?: string | null) {
  if (filter.mode === "name") {
    const query = filter.query.trim();
    return query ? `Name: ${query}` : "Name";
  }

  if (filter.mode === "filter") {
    return activeFilterName ? `Filter: ${activeFilterName}` : "Filter";
  }

  return `Date: ${formatDateFilterSummary(filter.date)}`;
}

function formatDateFilterSummary(filter: MetadataSearchDateFilter) {
  if (filter.preset !== "custom") {
    return DATE_PRESET_LABELS[filter.preset];
  }

  if (filter.startDate && filter.endDate) {
    return `${filter.startDate} → ${filter.endDate}`;
  }

  return DATE_PRESET_LABELS.custom;
}

interface ModeButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

function ModeButton({ active, icon, label, onClick }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[48px] items-center justify-center gap-2.5 border-y-0 px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.12em] transition-all first:border-r",
        active
          ? "border-primary/45 bg-primary/12 text-primary shadow-[inset_0_0_0_1px_rgba(34,197,94,0.15)]"
          : "border-border text-muted-foreground hover:bg-background/40 hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface DatePresetButtonProps {
  preset: MetadataSearchDatePreset;
  active: boolean;
  onClick: () => void;
}

function DatePresetButton({ preset, active, onClick }: DatePresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-3 py-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-all",
        active
          ? "border-primary/35 bg-primary/12 text-foreground"
          : "border-border bg-surface-low text-muted-foreground hover:border-primary/20 hover:text-foreground",
      )}
    >
      {DATE_PRESET_LABELS[preset]}
    </button>
  );
}
