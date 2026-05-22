import { supabase } from "./supabase.ts";
import { withRetry } from "../utils/resilience.ts";
import {
  buildAiSummaryCacheRowPayload,
  createAiSummaryCacheServiceWithRetry,
  type AiSummaryCacheDependencies,
  type AiSummaryCacheRow,
} from "./aiSummaryCacheCore.ts";

export {
  AI_SUMMARY_CACHE_WINDOW_HOURS,
  buildAiSummaryCacheRowPayload,
  classifyAiSummaryCacheRow,
  createAiSummaryCacheServiceWithRetry,
  lookupAiSummaryCacheWithDependencies,
} from "./aiSummaryCacheCore.ts";
export type {
  AiSummaryCacheDependencies,
  AiSummaryCacheKey,
  AiSummaryCacheLookupResult,
  AiSummaryCacheRow,
  AiSummaryCacheState,
  AiSummaryCacheStoredStatus,
  AiSummaryCacheWriteInput,
} from "./aiSummaryCacheCore.ts";

const defaultDependencies: AiSummaryCacheDependencies = {
  async getExactCacheRow(key) {
    const { data, error } = await supabase
      .from("ai_summary_cache")
      .select("*")
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("content_hash", key.content_hash)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .maybeSingle();

    if (error) throw error;
    return (data as AiSummaryCacheRow | null) ?? null;
  },

  async getLatestCacheRow(key) {
    const { data, error } = await supabase
      .from("ai_summary_cache")
      .select("*")
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .order("updated_at", { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return (data as AiSummaryCacheRow | null) ?? null;
  },

  async upsertCacheRow(input) {
    const { error } = await supabase
      .from("ai_summary_cache")
      .upsert(buildAiSummaryCacheRowPayload(input), {
        onConflict:
          "scope_type,scope_id,content_hash,model_identifier,model_version",
      });

    if (error) throw error;
  },

  async markStaleRows(key) {
    const { error } = await supabase
      .from("ai_summary_cache")
      .update({
        status: "stale",
        updated_at: new Date().toISOString(),
      })
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .neq("content_hash", key.content_hash);

    if (error) throw error;
  },
};

export const createAiSummaryCacheService = (
  dependencies: AiSummaryCacheDependencies = defaultDependencies,
) => createAiSummaryCacheServiceWithRetry(dependencies, withRetry);

export const aiSummaryCacheService = createAiSummaryCacheService();
