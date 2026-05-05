import type { AiScopeType } from "./aiScopeResolutionBuilder";

export const AI_SUMMARY_CACHE_WINDOW_HOURS = 24;
const AI_SUMMARY_CACHE_WINDOW_MS = AI_SUMMARY_CACHE_WINDOW_HOURS * 60 * 60 * 1000;

export type AiSummaryCacheStoredStatus =
  | "pending"
  | "ready"
  | "error"
  | "stale"
  | "no_content";

export type AiSummaryCacheState =
  | "cached"
  | "generating"
  | "failed"
  | "no_content"
  | "stale"
  | "miss";

export interface AiSummaryCacheKey {
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string;
  model_identifier: string;
  model_version: string;
}

export interface AiSummaryCacheRow extends AiSummaryCacheKey {
  id: string;
  status: AiSummaryCacheStoredStatus;
  summary_text: string | null;
  summary_metadata: Record<string, unknown>;
  error_message: string | null;
  expires_at: string | null;
  generated_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiSummaryCacheLookupResult {
  state: AiSummaryCacheState;
  cached_reopen: boolean;
  should_regenerate: boolean;
  summary_text: string | null;
  summary_metadata: Record<string, unknown>;
  error_message: string | null;
  cache_row: AiSummaryCacheRow | null;
}

export interface AiSummaryCacheWriteInput extends AiSummaryCacheKey {
  status: Exclude<AiSummaryCacheStoredStatus, "stale">;
  summary_text?: string | null;
  summary_metadata?: Record<string, unknown>;
  error_message?: string | null;
  expires_at?: Date | null;
  generated_at?: Date | null;
  last_accessed_at?: Date | null;
  now?: Date;
}

export interface AiSummaryCacheDependencies {
  getExactCacheRow: (key: AiSummaryCacheKey) => Promise<AiSummaryCacheRow | null>;
  getLatestCacheRow: (
    key: Pick<AiSummaryCacheKey, "scope_type" | "scope_id" | "model_identifier" | "model_version">,
  ) => Promise<AiSummaryCacheRow | null>;
  upsertCacheRow: (input: AiSummaryCacheWriteInput) => Promise<void>;
  markStaleRows: (
    key: Pick<AiSummaryCacheKey, "scope_type" | "scope_id" | "model_identifier" | "model_version"> & {
      content_hash: string;
    },
  ) => Promise<void>;
}

const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

const addWindow = (now: Date): Date => new Date(now.getTime() + AI_SUMMARY_CACHE_WINDOW_MS);

const isWithinCacheWindow = (row: AiSummaryCacheRow, now: Date): boolean => {
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > now.getTime();
};

export const classifyAiSummaryCacheRow = (
  row: AiSummaryCacheRow,
  now: Date = new Date(),
): AiSummaryCacheLookupResult => {
  const base = {
    cached_reopen: false,
    should_regenerate: false,
    summary_text: row.summary_text,
    summary_metadata: row.summary_metadata ?? {},
    error_message: row.error_message,
    cache_row: row,
  } satisfies Omit<AiSummaryCacheLookupResult, "state">;

  if (!isWithinCacheWindow(row, now) || row.status === "stale") {
    return {
      ...base,
      state: "stale",
      should_regenerate: true,
    };
  }

  if (row.status === "ready") {
    return {
      ...base,
      state: "cached",
      cached_reopen: true,
    };
  }

  if (row.status === "pending") {
    return {
      ...base,
      state: "generating",
    };
  }

  if (row.status === "error") {
    return {
      ...base,
      state: "failed",
      should_regenerate: true,
    };
  }

  return {
    ...base,
    state: "no_content",
  };
};

export const buildAiSummaryCacheRowPayload = (
  input: AiSummaryCacheWriteInput,
): Record<string, unknown> => {
  const now = input.now ?? new Date();
  const generatedAt = input.generated_at ?? (input.status === "pending" ? null : now);
  const expiresAt =
    input.expires_at ?? (input.status === "pending" ? null : addWindow(now));

  return {
    scope_type: input.scope_type,
    scope_id: input.scope_id,
    content_hash: input.content_hash,
    model_identifier: input.model_identifier,
    model_version: input.model_version,
    status: input.status,
    summary_text: input.summary_text ?? null,
    summary_metadata: input.summary_metadata ?? {},
    error_message: input.error_message ?? null,
    expires_at: toIso(expiresAt),
    generated_at: toIso(generatedAt),
    last_accessed_at: toIso(input.last_accessed_at ?? now),
    updated_at: now.toISOString(),
  };
};

export const lookupAiSummaryCacheWithDependencies = async (
  dependencies: AiSummaryCacheDependencies,
  key: AiSummaryCacheKey,
  now: Date,
): Promise<AiSummaryCacheLookupResult> => {
  const exactRow = await dependencies.getExactCacheRow(key);
  if (exactRow) {
    return classifyAiSummaryCacheRow(exactRow, now);
  }

  const latestRow = await dependencies.getLatestCacheRow(key);
  if (!latestRow) {
    return {
      state: "miss",
      cached_reopen: false,
      should_regenerate: true,
      summary_text: null,
      summary_metadata: {},
      error_message: null,
      cache_row: null,
    };
  }

  if (latestRow.content_hash !== key.content_hash) {
    return {
      state: "stale",
      cached_reopen: false,
      should_regenerate: true,
      summary_text: null,
      summary_metadata: latestRow.summary_metadata ?? {},
      error_message: latestRow.error_message,
      cache_row: latestRow,
    };
  }

  return classifyAiSummaryCacheRow(latestRow, now);
};

export const createAiSummaryCacheServiceWithRetry = (
  dependencies: AiSummaryCacheDependencies,
  retry: <T>(operation: () => Promise<T>) => Promise<T>,
) => ({
  async lookupCache(
    key: AiSummaryCacheKey,
    now: Date = new Date(),
  ): Promise<AiSummaryCacheLookupResult> {
    return retry(async () => lookupAiSummaryCacheWithDependencies(dependencies, key, now));
  },

  async writeCache(
    input: AiSummaryCacheWriteInput,
  ): Promise<AiSummaryCacheLookupResult> {
    return retry(async () => {
      await dependencies.markStaleRows(input);
      await dependencies.upsertCacheRow(input);
      return lookupAiSummaryCacheWithDependencies(
        dependencies,
        input,
        input.now ?? new Date(),
      );
    });
  },
});
