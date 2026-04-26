import { useCallback, useMemo, useState } from "react";
import {
  type MetadataSearchDateFilter,
  type MetadataSearchFilterState,
  type MetadataSearchPageScope,
} from "../types";
import {
  createDefaultMetadataSearchFilter,
  hasActiveMetadataSearch,
} from "../utils/metadataSearch";

type MetadataSearchStatePatch = Partial<
  Omit<MetadataSearchFilterState, "scope" | "date">
> & {
  date?: Partial<MetadataSearchDateFilter>;
};

/**
 * Shared page-scoped metadata search state.
 * Each page owns its rendering and chooses which title/date fields to evaluate.
 */
export function useMetadataSearchState(
  scope: MetadataSearchPageScope,
  initialState?: Partial<Omit<MetadataSearchFilterState, "scope">>,
) {
  const [filter, setFilter] = useState<MetadataSearchFilterState>(() => ({
    ...createDefaultMetadataSearchFilter(scope),
    ...initialState,
    date: {
      ...createDefaultMetadataSearchFilter(scope).date,
      ...initialState?.date,
    },
  }));

  const patchFilter = useCallback((patch: MetadataSearchStatePatch) => {
    setFilter((current) => ({
      ...current,
      ...patch,
      date: patch.date ? { ...current.date, ...patch.date } : current.date,
    }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilter(createDefaultMetadataSearchFilter(scope));
  }, [scope]);

  const setMode = useCallback(
    (mode: MetadataSearchFilterState["mode"]) => patchFilter({ mode }),
    [patchFilter],
  );

  const setQuery = useCallback(
    (query: string) => patchFilter({ query }),
    [patchFilter],
  );

  const setDatePreset = useCallback(
    (preset: MetadataSearchDateFilter["preset"]) =>
      patchFilter({
        date:
          preset === "custom"
            ? { preset }
            : { preset, startDate: "", endDate: "" },
      }),
    [patchFilter],
  );

  const setCustomDateRange = useCallback(
    (startDate: string, endDate: string) => {
      patchFilter({
        date: {
          preset: "custom",
          startDate,
          endDate,
        },
      });
    },
    [patchFilter],
  );

  const isActive = useMemo(() => hasActiveMetadataSearch(filter), [filter]);

  return {
    filter,
    isActive,
    setFilter,
    patchFilter,
    resetFilter,
    setMode,
    setQuery,
    setDatePreset,
    setCustomDateRange,
  };
}
