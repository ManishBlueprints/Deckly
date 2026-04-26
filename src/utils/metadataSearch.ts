import {
  type MetadataSearchDateFilter,
  type MetadataSearchFilterState,
  type MetadataSearchPageScope,
  METADATA_SEARCH_PAGE_SCOPES,
} from "../types";

const EMPTY_DATE_FILTER: MetadataSearchDateFilter = {
  preset: "custom",
  startDate: "",
  endDate: "",
};

export interface MetadataDateWindow {
  start: Date;
  end: Date;
}

export function createDefaultMetadataSearchFilter(
  scope: MetadataSearchPageScope,
): MetadataSearchFilterState {
  return {
    scope,
    mode: "name",
    query: "",
    date: { ...EMPTY_DATE_FILTER },
  };
}

export function createDefaultMetadataSearchStateByPage() {
  return METADATA_SEARCH_PAGE_SCOPES.reduce(
    (acc, scope) => {
      acc[scope] = createDefaultMetadataSearchFilter(scope);
      return acc;
    },
    {} as Record<MetadataSearchPageScope, MetadataSearchFilterState>,
  );
}

export function normalizeMetadataSearchFilter(
  filter: MetadataSearchFilterState,
): MetadataSearchFilterState {
  return {
    ...filter,
    query: filter.query.trim(),
    date: {
      ...filter.date,
      startDate: filter.date.startDate.trim(),
      endDate: filter.date.endDate.trim(),
    },
  };
}

export function hasActiveMetadataSearch(
  filter: MetadataSearchFilterState,
): boolean {
  switch (filter.mode) {
    case "name":
      return filter.query.trim().length > 0;
    case "date":
      return getMetadataDateWindow(filter.date) !== null;
    case "filter":
      return false;
  }
}

export function matchesMetadataNameQuery(value: string | null | undefined, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return (value ?? "").toLowerCase().includes(normalizedQuery);
}

export function getMetadataDateWindow(
  filter: MetadataSearchDateFilter,
  now = new Date(),
): MetadataDateWindow | null {
  const today = startOfDay(now);

  switch (filter.preset) {
    case "today":
      return { start: today, end: endOfDay(today) };
    case "last_7_days":
      return { start: addDays(today, -6), end: endOfDay(today) };
    case "last_30_days":
      return { start: addDays(today, -29), end: endOfDay(today) };
    case "custom": {
      if (!filter.startDate || !filter.endDate) return null;

      const start = parseDateOnly(filter.startDate);
      const end = parseDateOnly(filter.endDate);
      if (!start || !end || start.getTime() > end.getTime()) {
        return null;
      }

      return {
        start,
        end: endOfDay(end),
      };
    }
  }
}

export function matchesMetadataDateFilter(
  value: string | Date | null | undefined,
  filter: MetadataSearchDateFilter,
  now = new Date(),
): boolean {
  const window = getMetadataDateWindow(filter, now);
  if (!window) return true;

  const candidate = value instanceof Date ? value : value ? new Date(value) : null;
  if (!candidate || Number.isNaN(candidate.getTime())) {
    return false;
  }

  return candidate >= window.start && candidate <= window.end;
}

function parseDateOnly(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addDays(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + amount);
}
