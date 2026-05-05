import type { Tier } from "../constants/tiers";
import {
  evaluateGuestAiSummaryQuota,
  evaluateSignedInAiSummaryQuota,
  type AiSummaryQuotaDecision,
} from "./aiSummaryQuotaPolicy";
import type {
  AiNoContentReason,
  AiScopeReference,
  AiScopeResolution,
  AiScopeType,
} from "./aiScopeResolutionBuilder";
import type {
  AiSummaryCacheKey,
  AiSummaryCacheLookupResult,
  AiSummaryCacheState,
  AiSummaryCacheWriteInput,
} from "./aiSummaryCacheCore";

export const AI_SUMMARY_MODEL_IDENTIFIER = "gpt-4o-mini";
export const AI_SUMMARY_MODEL_VERSION = "initial-summary-v1";
export const AI_SUMMARY_RECURSIVE_SOURCE_THRESHOLD = 4;
export const AI_SUMMARY_RECURSIVE_CHARACTER_THRESHOLD = 18000;

export type AiSummaryStrategy = "one_shot" | "recursive";

export type AiSummaryActor =
  | {
      type: "signed_in";
      user_id: string;
      tier: Tier;
    }
  | {
      type: "guest";
      ip_address: string;
    };

export interface AiSummaryProviderUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
}

export interface AiSummaryProviderResult {
  summary_text: string;
  usage?: AiSummaryProviderUsage;
  raw_response?: Record<string, unknown>;
}

export interface AiSummaryGenerateInput {
  mode: "one_shot" | "source" | "aggregate";
  scope: Pick<AiScopeResolution, "scope_type" | "scope_id" | "scope_label">;
  content: string;
  source_title?: string;
  source_index?: number;
  total_sources?: number;
}

export interface AiSummaryInitialRequest extends AiScopeReference {
  actor: AiSummaryActor;
  now?: Date;
  model_identifier?: string;
  model_version?: string;
}

export interface AiSummaryUsageMetadata {
  quota: AiSummaryQuotaDecision | null;
  usage_count: number | null;
}

export interface AiSummaryInitialResult {
  status: "completed" | "cached" | "no_content" | "quota_limited" | "generating";
  summary_text: string | null;
  strategy: AiSummaryStrategy | null;
  scope: {
    scope_type: AiScopeType;
    scope_id: string;
    scope_label: string | null;
    content_hash: string;
  };
  freshness: {
    state: "fresh" | "cached";
    generated_at: string | null;
    expires_at: string | null;
  };
  partial_data: boolean;
  no_content: boolean;
  no_content_reason: AiNoContentReason | null;
  metadata: {
    total_sources: number;
    included_sources: number;
    excluded_sources: number;
    unsupported_sources: number;
    missing_text_sources: number;
    summary_metadata: Record<string, unknown>;
  };
  cache: {
    state: AiSummaryCacheState;
    hit: boolean;
    cached_reopen: boolean;
    should_regenerate: boolean;
  };
  usage: AiSummaryUsageMetadata;
}

export interface AiSummaryInitialOrchestratorDependencies {
  resolveScope: (
    reference: AiScopeReference,
    actor: AiSummaryActor,
  ) => Promise<AiScopeResolution>;
  lookupCache: (
    key: AiSummaryCacheKey,
    now: Date,
  ) => Promise<AiSummaryCacheLookupResult>;
  writeCache: (
    input: AiSummaryCacheWriteInput,
  ) => Promise<AiSummaryCacheLookupResult>;
  getUsageCount: (actor: AiSummaryActor, now: Date) => Promise<number>;
  recordUsage?: (
    actor: AiSummaryActor,
    cacheKey: AiSummaryCacheKey,
    consumedAt: Date,
  ) => Promise<void>;
  generateSummary: (
    input: AiSummaryGenerateInput,
  ) => Promise<AiSummaryProviderResult>;
}

const normalizeSummaryText = (value: string): string => value.trim();

const computeSyntheticNoContentHash = async (
  resolution: AiScopeResolution,
): Promise<string> => {
  const payload = {
    scope_type: resolution.scope_type,
    scope_id: resolution.scope_id,
    no_content_reason: resolution.metadata.no_content_reason,
    total_sources: resolution.metadata.total_sources,
    excluded_sources: resolution.excluded_sources
      .map((source) => ({
        source_id: source.source_id,
        deck_id: source.deck_id,
        reason: source.reason,
      }))
      .sort((left, right) => {
        if (left.deck_id !== right.deck_id) return left.deck_id.localeCompare(right.deck_id);
        return left.source_id.localeCompare(right.source_id);
      }),
  };

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

const getEffectiveContentHash = async (
  resolution: AiScopeResolution,
): Promise<string> => resolution.content_hash ?? computeSyntheticNoContentHash(resolution);

export const selectAiSummaryStrategy = (
  resolution: AiScopeResolution,
): AiSummaryStrategy => {
  const totalCharacters = resolution.included_sources.reduce(
    (sum, source) => sum + source.text_length,
    0,
  );

  const shouldUseRecursive =
    resolution.scope_type !== "deck" &&
    resolution.included_sources.length > 1 &&
    (resolution.included_sources.length >= AI_SUMMARY_RECURSIVE_SOURCE_THRESHOLD ||
      totalCharacters >= AI_SUMMARY_RECURSIVE_CHARACTER_THRESHOLD);

  return shouldUseRecursive ? "recursive" : "one_shot";
};

const buildQuotaDecision = (
  actor: AiSummaryActor,
  usageCount: number,
  now: Date,
  cachedReopen = false,
): AiSummaryQuotaDecision =>
  actor.type === "guest"
    ? evaluateGuestAiSummaryQuota(usageCount, { cachedReopen, now })
    : evaluateSignedInAiSummaryQuota(actor.tier, usageCount, { cachedReopen, now });

const buildSummaryMetadata = (args: {
  resolution: AiScopeResolution;
  strategy: AiSummaryStrategy | null;
  provider_usage?: Record<string, unknown>;
  recursive_source_summaries?: string[];
  generation_mode: "generated" | "cached" | "no_content";
}): Record<string, unknown> => ({
  generation_mode: args.generation_mode,
  strategy: args.strategy,
  partial_data: args.resolution.metadata.partial_data,
  no_content: args.resolution.metadata.no_content,
  no_content_reason: args.resolution.metadata.no_content_reason,
  total_sources: args.resolution.metadata.total_sources,
  included_sources: args.resolution.metadata.included_sources,
  excluded_sources: args.resolution.metadata.excluded_sources,
  unsupported_sources: args.resolution.metadata.unsupported_sources,
  missing_text_sources: args.resolution.metadata.missing_text_sources,
  provider_usage: args.provider_usage ?? null,
  recursive_source_summaries: args.recursive_source_summaries ?? null,
});

const buildResult = (args: {
  status: AiSummaryInitialResult["status"];
  resolution: AiScopeResolution;
  contentHash: string;
  cacheState: AiSummaryCacheLookupResult;
  summaryText: string | null;
  strategy: AiSummaryStrategy | null;
  summaryMetadata: Record<string, unknown>;
  usage: AiSummaryUsageMetadata;
  freshness: AiSummaryInitialResult["freshness"];
}): AiSummaryInitialResult => ({
  status: args.status,
  summary_text: args.summaryText,
  strategy: args.strategy,
  scope: {
    scope_type: args.resolution.scope_type,
    scope_id: args.resolution.scope_id,
    scope_label: args.resolution.scope_label,
    content_hash: args.contentHash,
  },
  freshness: args.freshness,
  partial_data: args.resolution.metadata.partial_data,
  no_content: args.resolution.metadata.no_content,
  no_content_reason: args.resolution.metadata.no_content_reason,
  metadata: {
    total_sources: args.resolution.metadata.total_sources,
    included_sources: args.resolution.metadata.included_sources,
    excluded_sources: args.resolution.metadata.excluded_sources,
    unsupported_sources: args.resolution.metadata.unsupported_sources,
    missing_text_sources: args.resolution.metadata.missing_text_sources,
    summary_metadata: args.summaryMetadata,
  },
  cache: {
    state: args.cacheState.state,
    hit: args.cacheState.state !== "miss" && args.cacheState.state !== "stale",
    cached_reopen: args.cacheState.cached_reopen,
    should_regenerate: args.cacheState.should_regenerate,
  },
  usage: args.usage,
});

export const createAiSummaryInitialOrchestrator = (
  dependencies: AiSummaryInitialOrchestratorDependencies,
) => ({
  async summarize(
    request: AiSummaryInitialRequest,
  ): Promise<AiSummaryInitialResult> {
    const now = request.now ?? new Date();
    const modelIdentifier = request.model_identifier ?? AI_SUMMARY_MODEL_IDENTIFIER;
    const modelVersion = request.model_version ?? AI_SUMMARY_MODEL_VERSION;

    const resolution = await dependencies.resolveScope(
      {
        scope_type: request.scope_type,
        scope_id: request.scope_id,
      },
      request.actor,
    );

    const contentHash = await getEffectiveContentHash(resolution);
    const cacheKey: AiSummaryCacheKey = {
      scope_type: request.scope_type,
      scope_id: request.scope_id,
      content_hash: contentHash,
      model_identifier: modelIdentifier,
      model_version: modelVersion,
    };

    const cacheLookup = await dependencies.lookupCache(cacheKey, now);

    if (cacheLookup.state === "cached" || cacheLookup.state === "no_content") {
      const usageCount = await dependencies.getUsageCount(request.actor, now);
      const quotaDecision = buildQuotaDecision(
        request.actor,
        usageCount,
        now,
        true,
      );

      return buildResult({
        status: cacheLookup.state === "cached" ? "cached" : "no_content",
        resolution,
        contentHash,
        cacheState: cacheLookup,
        summaryText: cacheLookup.summary_text,
        strategy:
          (cacheLookup.summary_metadata.strategy as AiSummaryStrategy | null | undefined) ?? null,
        summaryMetadata: cacheLookup.summary_metadata,
        usage: {
          quota: quotaDecision,
          usage_count: usageCount,
        },
        freshness: {
          state: "cached",
          generated_at: cacheLookup.cache_row?.generated_at ?? null,
          expires_at: cacheLookup.cache_row?.expires_at ?? null,
        },
      });
    }

    if (cacheLookup.state === "generating") {
      return buildResult({
        status: "generating",
        resolution,
        contentHash,
        cacheState: cacheLookup,
        summaryText: null,
        strategy: null,
        summaryMetadata: cacheLookup.summary_metadata,
        usage: {
          quota: null,
          usage_count: null,
        },
        freshness: {
          state: "cached",
          generated_at: cacheLookup.cache_row?.generated_at ?? null,
          expires_at: cacheLookup.cache_row?.expires_at ?? null,
        },
      });
    }

    const usageCount = await dependencies.getUsageCount(request.actor, now);
    const quotaDecision = buildQuotaDecision(request.actor, usageCount, now);

    if (!quotaDecision.allowed) {
      return buildResult({
        status: "quota_limited",
        resolution,
        contentHash,
        cacheState: cacheLookup,
        summaryText: null,
        strategy: null,
        summaryMetadata: cacheLookup.summary_metadata,
        usage: {
          quota: quotaDecision,
          usage_count: usageCount,
        },
        freshness: {
          state: "fresh",
          generated_at: null,
          expires_at: null,
        },
      });
    }

    if (resolution.metadata.no_content) {
      const summaryMetadata = buildSummaryMetadata({
        resolution,
        strategy: null,
        generation_mode: "no_content",
      });

      const noContentCache = await dependencies.writeCache({
        ...cacheKey,
        status: "no_content",
        summary_text: null,
        summary_metadata: summaryMetadata,
        now,
      });

      return buildResult({
        status: "no_content",
        resolution,
        contentHash,
        cacheState: noContentCache,
        summaryText: null,
        strategy: null,
        summaryMetadata,
        usage: {
          quota: quotaDecision,
          usage_count: usageCount,
        },
        freshness: {
          state: "fresh",
          generated_at: noContentCache.cache_row?.generated_at ?? null,
          expires_at: noContentCache.cache_row?.expires_at ?? null,
        },
      });
    }

    const strategy = selectAiSummaryStrategy(resolution);

    await dependencies.writeCache({
      ...cacheKey,
      status: "pending",
      summary_text: null,
      summary_metadata: buildSummaryMetadata({
        resolution,
        strategy,
        generation_mode: "generated",
      }),
      now,
    });

    try {
      let providerResult: AiSummaryProviderResult;
      let recursiveSourceSummaries: string[] | undefined;

      if (strategy === "one_shot") {
        providerResult = await dependencies.generateSummary({
          mode: "one_shot",
          scope: resolution,
          content: resolution.normalized_content,
          total_sources: resolution.included_sources.length,
        });
      } else {
        recursiveSourceSummaries = [];

        for (const [index, source] of resolution.included_sources.entries()) {
          const sourceResult = await dependencies.generateSummary({
            mode: "source",
            scope: resolution,
            content: source.normalized_text,
            source_title: source.title,
            source_index: index + 1,
            total_sources: resolution.included_sources.length,
          });

          recursiveSourceSummaries.push(
            `Source ${index + 1}: ${source.title}\n${normalizeSummaryText(sourceResult.summary_text)}`,
          );
        }

        providerResult = await dependencies.generateSummary({
          mode: "aggregate",
          scope: resolution,
          content: recursiveSourceSummaries.join("\n\n"),
          total_sources: resolution.included_sources.length,
        });
      }

      const summaryText = normalizeSummaryText(providerResult.summary_text);
      if (!summaryText) {
        throw new Error("AI summary generation returned empty content.");
      }

      const summaryMetadata = buildSummaryMetadata({
        resolution,
        strategy,
        generation_mode: "generated",
        provider_usage: providerResult.usage,
        recursive_source_summaries: recursiveSourceSummaries,
      });

      const readyCache = await dependencies.writeCache({
        ...cacheKey,
        status: "ready",
        summary_text: summaryText,
        summary_metadata: summaryMetadata,
        now,
      });

      if (quotaDecision.chargeable) {
        await dependencies.recordUsage?.(request.actor, cacheKey, now);
      }

      return buildResult({
        status: "completed",
        resolution,
        contentHash,
        cacheState: readyCache,
        summaryText,
        strategy,
        summaryMetadata,
        usage: {
          quota: quotaDecision,
          usage_count: usageCount,
        },
        freshness: {
          state: "fresh",
          generated_at: readyCache.cache_row?.generated_at ?? null,
          expires_at: readyCache.cache_row?.expires_at ?? null,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await dependencies.writeCache({
        ...cacheKey,
        status: "error",
        summary_text: null,
        error_message: errorMessage,
        summary_metadata: buildSummaryMetadata({
          resolution,
          strategy,
          generation_mode: "generated",
        }),
        now,
      });
      throw error;
    }
  },
});
