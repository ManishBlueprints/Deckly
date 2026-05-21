/**
 * Explicit page taxonomy for the metadata-only search release.
 * Search state is local to one of these page scopes and does not imply global search.
 */
export const METADATA_SEARCH_PAGE_SCOPES = [
  "content_library",
  "data_room",
  "saved_library",
] as const;

export type MetadataSearchPageScope =
  (typeof METADATA_SEARCH_PAGE_SCOPES)[number];

/** Metadata-only v1 modes. Inside-document search is intentionally excluded. */
export const METADATA_SEARCH_MODES = ["name", "date", "filter"] as const;

export type MetadataSearchMode = (typeof METADATA_SEARCH_MODES)[number];

export const METADATA_SEARCH_DATE_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "custom",
] as const;

export type MetadataSearchDatePreset =
  (typeof METADATA_SEARCH_DATE_PRESETS)[number];

/**
 * Custom ranges use inclusive YYYY-MM-DD boundaries.
 * Partial ranges stay representable so pages can preserve draft input.
 */
export interface MetadataSearchDateFilter {
  preset: MetadataSearchDatePreset;
  startDate: string;
  endDate: string;
}

/**
 * Reusable page-scoped search state shared by Content Library, Data Room, and Saved Library.
 * Pages keep their own rendering and field-selection logic.
 */
export interface MetadataSearchFilterState {
  scope: MetadataSearchPageScope;
  mode: MetadataSearchMode;
  query: string;
  date: MetadataSearchDateFilter;
}

export type MetadataSearchStateByPage = Record<
  MetadataSearchPageScope,
  MetadataSearchFilterState
>;
