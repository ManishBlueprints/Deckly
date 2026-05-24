import { withRetry } from "../utils/resilience.ts";
import type { AiChunkMetadata } from "./aiChunkIndexingService.ts";
import type { AiScopeReference, AiScopeType } from "./aiScopeResolutionBuilder.ts";
import { getSupabase } from "./supabase.ts";

export const AI_RETRIEVAL_MAX_RESULTS = 6;
export const AI_RETRIEVAL_MAX_CHARACTERS = 3600;
export const AI_RETRIEVAL_MAX_CANDIDATES = 40;

export interface AiRetrievalModelConfig {
  embedding_model: string;
  model_version: string;
}

export interface AiRetrievalScope extends AiRetrievalModelConfig, AiScopeReference {
  content_hash?: string | null;
}

export interface AiRetrievalRequest extends AiRetrievalScope {
  query: string;
  max_results?: number;
  max_characters?: number;
  max_candidates?: number;
}

export interface AiRetrievalChunkRow {
  id: string;
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string;
  chunk_index: number;
  source_label: string | null;
  chunk_text: string;
  metadata: AiChunkMetadata;
  repository_score?: number | null;
}

export interface AiRetrievalRankingMetadata {
  combined_score: number;
  keyword_score: number;
  repository_score: number | null;
  exact_phrase_match: boolean;
  matched_terms: string[];
}

export interface AiRetrievedSnippet {
  chunk_id: string;
  chunk_index: number;
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string;
  source_label: string | null;
  snippet_text: string;
  truncated: boolean;
  metadata: AiChunkMetadata;
  ranking: AiRetrievalRankingMetadata;
}

export interface AiRetrievalResult {
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string | null;
  query: string;
  snippets: AiRetrievedSnippet[];
  metadata: {
    query_terms: string[];
    ranking_version: "lexical_scope_v1";
    content_hash_source: "provided" | "latest_scope_index" | "none";
    fallback_used: boolean;
    returned_count: number;
    used_characters: number;
    max_results: number;
    max_characters: number;
    max_candidates: number;
    candidate_count: number;
    filtered_out_count: number;
    dropped_chunk_ids: string[];
    matched_chunk_ids: string[];
  };
}

interface AiRetrievalDependencies {
  getLatestContentHash: (scope: AiRetrievalScope) => Promise<string | null>;
  getScopeChunks: (
    scope: Required<AiRetrievalScope>,
    options: { query: string; max_candidates: number },
  ) => Promise<AiRetrievalChunkRow[]>;
}

interface AiRankedChunk extends AiRetrievalChunkRow {
  ranking: AiRetrievalRankingMetadata;
}

const clampInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(value as number)));
};

const normalizeSearchText = (value: string): string =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\r\n?/g, "\n")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenizeQuery = (query: string): string[] => {
  const terms = normalizeSearchText(query)
    .split(" ")
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  return [...new Set(terms)];
};

const countOccurrences = (text: string, term: string): number => {
  if (!term) return 0;

  let count = 0;
  let cursor = 0;

  while (cursor < text.length) {
    const nextIndex = text.indexOf(term, cursor);
    if (nextIndex < 0) break;
    count += 1;
    cursor = nextIndex + term.length;
  }

  return count;
};

const scoreChunk = (
  chunk: AiRetrievalChunkRow,
  normalizedQuery: string,
  queryTerms: string[],
): AiRankedChunk => {
  const normalizedLabel = normalizeSearchText(chunk.source_label ?? "");
  const searchableText = `${normalizedLabel}\n${normalizeSearchText(chunk.chunk_text)}`.trim();
  const exactPhraseMatch = Boolean(normalizedQuery && searchableText.includes(normalizedQuery));
  const matchedTerms: string[] = [];
  let occurrenceScore = 0;
  let labelScore = 0;

  for (const term of queryTerms) {
    const occurrences = countOccurrences(searchableText, term);
    if (occurrences > 0) {
      matchedTerms.push(term);
      occurrenceScore += Math.min(occurrences, 3) * 2;
    }

    if (normalizedLabel.includes(term)) {
      labelScore += 4;
    }
  }

  const coverageScore =
    queryTerms.length > 0 ? (matchedTerms.length / queryTerms.length) * 40 : 0;
  const keywordScore =
    (exactPhraseMatch ? 60 : 0) + matchedTerms.length * 12 + occurrenceScore + labelScore + coverageScore;
  const repositoryScore =
    typeof chunk.repository_score === "number" && Number.isFinite(chunk.repository_score)
      ? chunk.repository_score
      : null;
  const combinedScore = keywordScore + (repositoryScore ?? 0) * 100;

  return {
    ...chunk,
    ranking: {
      combined_score: combinedScore,
      keyword_score: keywordScore,
      repository_score: repositoryScore,
      exact_phrase_match: exactPhraseMatch,
      matched_terms: matchedTerms,
    },
  };
};

const compareRankedChunks = (left: AiRankedChunk, right: AiRankedChunk): number => {
  if (right.ranking.combined_score !== left.ranking.combined_score) {
    return right.ranking.combined_score - left.ranking.combined_score;
  }

  if (left.chunk_index !== right.chunk_index) {
    return left.chunk_index - right.chunk_index;
  }

  return left.id.localeCompare(right.id);
};

const isChunkInScope = (
  chunk: AiRetrievalChunkRow,
  scope: Required<AiRetrievalScope>,
): boolean =>
  chunk.scope_type === scope.scope_type &&
  chunk.scope_id === scope.scope_id &&
  chunk.content_hash === scope.content_hash;

const buildSnippetText = (text: string, remainingCharacters: number) => {
  if (text.length <= remainingCharacters) {
    return {
      snippet_text: text,
      truncated: false,
    };
  }

  const sliced = text.slice(0, remainingCharacters).trimEnd();
  return {
    snippet_text: sliced,
    truncated: sliced.length < text.length,
  };
};

export const rankAiRetrievalCandidates = (
  chunks: AiRetrievalChunkRow[],
  query: string,
): {
  query_terms: string[];
  fallback_used: boolean;
  ranked_chunks: AiRankedChunk[];
} => {
  const normalizedQuery = normalizeSearchText(query);
  const queryTerms = tokenizeQuery(query);
  const ranked = chunks.map((chunk) => scoreChunk(chunk, normalizedQuery, queryTerms));
  const relevant = ranked.filter((chunk) => chunk.ranking.combined_score > 0);
  const fallbackUsed = relevant.length === 0;
  const rankedChunks = (fallbackUsed ? ranked : relevant).sort(compareRankedChunks);

  return {
    query_terms: queryTerms,
    fallback_used: fallbackUsed,
    ranked_chunks: rankedChunks,
  };
};

export const selectBudgetedAiRetrievalSnippets = (
  rankedChunks: AiRankedChunk[],
  budget: { max_results: number; max_characters: number },
): {
  snippets: AiRetrievedSnippet[];
  used_characters: number;
  dropped_chunk_ids: string[];
} => {
  const snippets: AiRetrievedSnippet[] = [];
  const droppedChunkIds: string[] = [];
  let usedCharacters = 0;

  for (const chunk of rankedChunks) {
    if (snippets.length >= budget.max_results) {
      droppedChunkIds.push(chunk.id);
      continue;
    }

    const remainingCharacters = budget.max_characters - usedCharacters;
    if (remainingCharacters <= 0) {
      droppedChunkIds.push(chunk.id);
      continue;
    }

    const { snippet_text, truncated } = buildSnippetText(chunk.chunk_text, remainingCharacters);
    if (!snippet_text) {
      droppedChunkIds.push(chunk.id);
      continue;
    }

    snippets.push({
      chunk_id: chunk.id,
      chunk_index: chunk.chunk_index,
      scope_type: chunk.scope_type,
      scope_id: chunk.scope_id,
      content_hash: chunk.content_hash,
      source_label: chunk.source_label,
      snippet_text,
      truncated,
      metadata: chunk.metadata,
      ranking: chunk.ranking,
    });
    usedCharacters += snippet_text.length;
  }

  return {
    snippets,
    used_characters: usedCharacters,
    dropped_chunk_ids: droppedChunkIds,
  };
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : asString(value);

const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;

const asChunkMetadata = (value: unknown): AiChunkMetadata => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    source_id: asString(raw.source_id) ?? "",
    deck_id: asString(raw.deck_id) ?? "",
    file_type: asNullableString(raw.file_type),
    folder_id: asNullableString(raw.folder_id),
    folder_name: asNullableString(raw.folder_name),
    source_chunk_index: asInteger(raw.source_chunk_index) ?? 0,
    source_chunk_count: asInteger(raw.source_chunk_count) ?? 0,
    char_start: asInteger(raw.char_start) ?? 0,
    char_end: asInteger(raw.char_end) ?? 0,
    text_length: asInteger(raw.text_length) ?? 0,
  };
};

const asChunkRow = (value: unknown): AiRetrievalChunkRow | null => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!raw) return null;

  const id = asString(raw.id);
  const scopeType = raw.scope_type;
  const scopeId = asString(raw.scope_id);
  const contentHash = asString(raw.content_hash);
  const chunkIndex = asInteger(raw.chunk_index);
  const chunkText = asString(raw.chunk_text);

  if (
    !id ||
    !scopeId ||
    !contentHash ||
    chunkIndex === null ||
    !chunkText ||
    (scopeType !== "deck" && scopeType !== "folder" && scopeType !== "data_room")
  ) {
    return null;
  }

  return {
    id,
    scope_type: scopeType,
    scope_id: scopeId,
    content_hash: contentHash,
    chunk_index: chunkIndex,
    source_label: asNullableString(raw.source_label),
    chunk_text: chunkText,
    metadata: asChunkMetadata(raw.metadata),
    repository_score:
      typeof raw.repository_score === "number" && Number.isFinite(raw.repository_score)
        ? raw.repository_score
        : null,
  };
};

const defaultDependencies: AiRetrievalDependencies = {
  async getLatestContentHash(scope) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_chunk_embeddings")
      .select("content_hash, updated_at")
      .eq("scope_type", scope.scope_type)
      .eq("scope_id", scope.scope_id)
      .eq("embedding_model", scope.embedding_model)
      .eq("model_version", scope.model_version)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const contentHash =
      data && typeof data === "object" ? (data as { content_hash?: unknown }).content_hash : null;
    return asString(contentHash);
  },

  async getScopeChunks(scope, options) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("ai_chunk_embeddings")
      .select("id, scope_type, scope_id, content_hash, chunk_index, source_label, chunk_text, metadata, repository_score")
      .eq("scope_type", scope.scope_type)
      .eq("scope_id", scope.scope_id)
      .eq("content_hash", scope.content_hash)
      .eq("embedding_model", scope.embedding_model)
      .eq("model_version", scope.model_version)
      .order("chunk_index", { ascending: true })
      .limit(options.max_candidates);

    if (error) throw error;

    return ((data ?? []) as unknown[])
      .map((row) => asChunkRow(row))
      .filter((row): row is AiRetrievalChunkRow => Boolean(row));
  },
};

export const createAiRetrievalQueryService = (
  dependencies: Partial<AiRetrievalDependencies> = {},
) => {
  const resolvedDependencies: AiRetrievalDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };

  return {
    async retrieveSnippets(
      request: AiRetrievalRequest,
    ): Promise<AiRetrievalResult> {
      return withRetry(async () => {
        const query = request.query.trim();
        if (!query) {
          throw new Error("AI retrieval query cannot be empty.");
        }

        const maxResults = clampInteger(
          request.max_results,
          AI_RETRIEVAL_MAX_RESULTS,
          1,
          AI_RETRIEVAL_MAX_RESULTS,
        );
        const maxCharacters = clampInteger(
          request.max_characters,
          AI_RETRIEVAL_MAX_CHARACTERS,
          1,
          AI_RETRIEVAL_MAX_CHARACTERS,
        );
        const maxCandidates = clampInteger(
          request.max_candidates,
          AI_RETRIEVAL_MAX_CANDIDATES,
          maxResults,
          AI_RETRIEVAL_MAX_CANDIDATES,
        );

        const providedContentHash = request.content_hash?.trim() || null;
        const resolvedContentHash =
          providedContentHash ??
          (await resolvedDependencies.getLatestContentHash({
            scope_type: request.scope_type,
            scope_id: request.scope_id,
            embedding_model: request.embedding_model,
            model_version: request.model_version,
          }));

        const contentHashSource = providedContentHash
          ? "provided"
          : resolvedContentHash
            ? "latest_scope_index"
            : "none";

        if (!resolvedContentHash) {
          return {
            scope_type: request.scope_type,
            scope_id: request.scope_id,
            content_hash: null,
            query,
            snippets: [],
            metadata: {
              query_terms: tokenizeQuery(query),
              ranking_version: "lexical_scope_v1",
              content_hash_source: contentHashSource,
              fallback_used: false,
              returned_count: 0,
              used_characters: 0,
              max_results: maxResults,
              max_characters: maxCharacters,
              max_candidates: maxCandidates,
              candidate_count: 0,
              filtered_out_count: 0,
              dropped_chunk_ids: [],
              matched_chunk_ids: [],
            },
          };
        }

        const scope = {
          scope_type: request.scope_type,
          scope_id: request.scope_id,
          content_hash: resolvedContentHash,
          embedding_model: request.embedding_model,
          model_version: request.model_version,
        } satisfies Required<AiRetrievalScope>;

        const candidates = await resolvedDependencies.getScopeChunks(scope, {
          query,
          max_candidates: maxCandidates,
        });
        const scopedCandidates = candidates.filter((chunk) => isChunkInScope(chunk, scope));
        const filteredOutCount = candidates.length - scopedCandidates.length;
        const { query_terms, fallback_used, ranked_chunks } = rankAiRetrievalCandidates(
          scopedCandidates,
          query,
        );
        const { snippets, used_characters, dropped_chunk_ids } =
          selectBudgetedAiRetrievalSnippets(ranked_chunks, {
            max_results: maxResults,
            max_characters: maxCharacters,
          });

        return {
          scope_type: request.scope_type,
          scope_id: request.scope_id,
          content_hash: resolvedContentHash,
          query,
          snippets,
          metadata: {
            query_terms,
            ranking_version: "lexical_scope_v1",
            content_hash_source: contentHashSource,
            fallback_used,
            returned_count: snippets.length,
            used_characters,
            max_results: maxResults,
            max_characters: maxCharacters,
            max_candidates: maxCandidates,
            candidate_count: scopedCandidates.length,
            filtered_out_count: filteredOutCount,
            dropped_chunk_ids,
            matched_chunk_ids: snippets.map((snippet) => snippet.chunk_id),
          },
        };
      });
    },
  };
};

export const aiRetrievalQueryService = createAiRetrievalQueryService();
