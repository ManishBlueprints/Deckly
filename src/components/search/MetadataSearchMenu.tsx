import { useEffect, useId, useRef, useState, type ReactNode } from "react";
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
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";

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
  mobileIconOnly?: boolean;
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
  mobileIconOnly = false,
}: MetadataSearchMenuProps) {
  const { theme } = useTheme();
  const activeSummary = buildActiveSummary(
    filter,
    selectedFilterId ? filterOptions.find((option) => option.id === selectedFilterId)?.name : null,
  );
  const [open, setOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fieldIdPrefix = useId();

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
            "inline-flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-ui-border bg-ui-subtle px-3.5 text-sm font-semibold text-ui-text shadow-control transition-colors hover:border-ui-primary/35 hover:bg-ui-elevated md:w-[220px]",
            mobileIconOnly && "relative h-10 w-10 shrink-0 justify-center px-0 md:w-[220px] md:justify-between md:px-3.5",
            isActive && "border-ui-primary/45 bg-ui-primary/10 text-ui-text",
            className,
          )}
        >
          <span className={cn("flex min-w-0 items-center gap-2.5", mobileIconOnly && "gap-0 md:gap-2.5")}>
            <Search size={17} className={cn("shrink-0 text-ui-muted", isActive && "text-ui-primary")} />
            <span className={cn("leading-none", mobileIconOnly && "hidden md:inline")}>
              {triggerLabel}
            </span>
          </span>

          <span className={cn("flex items-center gap-2", mobileIconOnly && "hidden md:flex")}>
            {typeof resultCount === "number" && isActive ? (
              <Badge variant="secondary" className="h-5 border-0 bg-ui-primary/15 px-1.5 text-[10px] leading-none text-ui-primary">
                {resultCount}
              </Badge>
            ) : null}
            {isActive ? (
              <Badge
                variant="outline"
                className="max-w-[120px] truncate border-ui-primary/25 bg-ui-primary/10 text-[10px] leading-none text-ui-primary"
              >
                {activeSummary}
              </Badge>
            ) : null}
            <SlidersHorizontal size={15} className="shrink-0 opacity-70" />
          </span>
          {mobileIconOnly && isActive ? (
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-ui-primary md:hidden" />
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-1.5rem)] max-w-[360px] space-y-4 rounded-lg border border-ui-border bg-ui-elevated p-4 text-ui-text shadow-overlay"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ui-text">Search this page</p>
            <p className="mt-1 text-xs leading-5 text-ui-muted">
              Filter by name, date, or available tags.
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={!isActive}
            className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs font-medium text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text disabled:pointer-events-none disabled:opacity-40"
          >
            <X size={12} />
            Clear
          </button>
        </div>

        <div className={cn("grid rounded-md bg-ui-subtle p-1", filterOptions.length > 0 ? "grid-cols-3" : "grid-cols-2")}>
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
          <div className="space-y-2">
            <label
              htmlFor={`${fieldIdPrefix}-query`}
              className="text-xs font-medium text-ui-muted"
            >
              Search query
            </label>
            <Input
              ref={nameInputRef}
              id={`${fieldIdPrefix}-query`}
              name={`${fieldIdPrefix}-query`}
              value={filter.query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={namePlaceholder}
              aria-label="Search by name"
              className="h-11 rounded-md border-ui-border bg-ui-surface px-3.5 text-sm text-ui-text shadow-none placeholder:text-ui-muted focus-visible:border-ui-primary/45 focus-visible:ring-ui-primary/20"
            />
          </div>
        ) : filter.mode === "filter" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-ui-muted">
                Available filters
              </label>
              <button
                type="button"
                onClick={() => onFilterChange?.(null)}
                disabled={!selectedFilterId}
                className="inline-flex items-center gap-1 text-xs font-medium text-ui-muted transition-colors hover:text-ui-text disabled:pointer-events-none disabled:opacity-40"
              >
                <X size={11} />
                Clear
              </button>
            </div>

            {filterOptions.length === 0 ? (
              <div className="rounded-md border border-dashed border-ui-border bg-ui-subtle px-4 py-6 text-sm text-ui-muted">
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
                        "flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "border-ui-primary/35 bg-ui-primary/10"
                          : "border-ui-border bg-ui-surface hover:border-ui-primary/20 hover:bg-ui-subtle",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="h-3 w-3 shrink-0 rounded-full bg-[var(--item-color-border)]" style={asItemColorVariables(getAccessibleColorSet(option.color, theme))} />
                        <span className="truncate text-sm font-medium text-ui-text">
                          {option.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ui-primary">
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
              <label className="text-xs font-medium text-ui-muted">
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
                  <label
                    htmlFor={`${fieldIdPrefix}-start-date`}
                    className="text-xs font-medium text-ui-muted"
                  >
                    Start
                  </label>
                  <Input
                    id={`${fieldIdPrefix}-start-date`}
                    name={`${fieldIdPrefix}-start-date`}
                    type="date"
                    value={filter.date.startDate}
                    onChange={(event) =>
                      onCustomDateRangeChange(event.target.value, filter.date.endDate)
                    }
                    aria-label="Custom start date"
                    className="h-10 rounded-md border-ui-border bg-ui-surface px-3 text-sm text-ui-text focus-visible:ring-ui-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${fieldIdPrefix}-end-date`}
                    className="text-xs font-medium text-ui-muted"
                  >
                    End
                  </label>
                  <Input
                    id={`${fieldIdPrefix}-end-date`}
                    name={`${fieldIdPrefix}-end-date`}
                    type="date"
                    value={filter.date.endDate}
                    onChange={(event) =>
                      onCustomDateRangeChange(filter.date.startDate, event.target.value)
                    }
                    aria-label="Custom end date"
                    className="h-10 rounded-md border-ui-border bg-ui-surface px-3 text-sm text-ui-text focus-visible:ring-ui-primary/20"
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
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-sm px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-ui-surface text-ui-primary shadow-control"
          : "text-ui-muted hover:bg-ui-surface/70 hover:text-ui-text",
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
        "rounded-md border px-3 py-2.5 text-xs font-medium transition-colors",
        active
          ? "border-ui-primary/35 bg-ui-primary/10 text-ui-text"
          : "border-ui-border bg-ui-surface text-ui-muted hover:border-ui-primary/20 hover:text-ui-text",
      )}
    >
      {DATE_PRESET_LABELS[preset]}
    </button>
  );
}
