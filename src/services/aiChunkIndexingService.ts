import { withRetry } from "../utils/resilience.ts";
import { AI_EMBEDDING_VECTOR_DIMENSIONS } from "./aiConfig.ts";
import { getSupabase } from "./supabase.ts";
import type {
  AiIncludedSource,
  AiNoContentReason,
  AiScopeResolution,
  AiScopeType,
} from "./aiScopeResolverService.ts";

export const AI_CHUNK_MAX_CHARACTERS = 1200;
export const AI_CHUNK_OVERLAP_CHARACTERS = 150;
export { AI_EMBEDDING_VECTOR_DIMENSIONS } from "./aiConfig.ts";

export interface AiChunkEmbeddingModelConfig {
  embedding_model: string;
  model_version: string;
}

export interface AiChunkingConfig {
  chunk_max_characters?: number;
  chunk_overlap_characters?: number;
}

export interface AiChunkIndexingInput
  extends AiChunkEmbeddingModelConfig,
    AiChunkingConfig {
  resolution: AiScopeResolution;
}

export interface AiChunkIndexRepositoryScope extends AiChunkEmbeddingModelConfig {
  scope_type: AiScopeType;
  scope_id: string;
}

export interface AiChunkIndexRepositoryKey extends AiChunkIndexRepositoryScope {
  content_hash: string;
}

export interface AiChunkMetadata {
  source_id: string;
  deck_id: string;
  file_type: string | null;
  folder_id: string | null;
  folder_name: string | null;
  source_chunk_index: number;
  source_chunk_count: number;
  char_start: number;
  char_end: number;
  text_length: number;
}

export interface AiChunkDraft {
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string;
  chunk_index: number;
  source_label: string | null;
  chunk_text: string;
  metadata: AiChunkMetadata;
}

export interface AiChunkEmbeddingRow extends AiChunkDraft, AiChunkEmbeddingModelConfig {
  embedding: string;
}

export interface AiChunkIndexingResult {
  status: "indexed" | "skipped";
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string | null;
  chunk_count: number;
  previous_content_hash: string | null;
  content_hash_changed: boolean;
  skipped_reason: AiNoContentReason | null;
}

interface AiChunkIndexingDependencies {
  getLatestContentHash: (scope: AiChunkIndexRepositoryScope) => Promise<string | null>;
  deleteChunksForScopeModel: (scope: AiChunkIndexRepositoryScope) => Promise<void>;
  replaceScopeChunksAtomically: (
    rows: AiChunkEmbeddingRow[],
    key: AiChunkIndexRepositoryKey,
  ) => Promise<void>;
  generateEmbeddings: (
    chunks: AiChunkDraft[],
    model: AiChunkEmbeddingModelConfig,
  ) => Promise<number[][]>;
}

const clampChunkSize = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value as number));
};

const clampOverlap = (value: number | undefined, chunkSize: number): number => {
  if (!Number.isFinite(value)) return Math.min(AI_CHUNK_OVERLAP_CHARACTERS, chunkSize - 1);
  return Math.max(0, Math.min(Math.floor(value as number), chunkSize - 1));
};

const getChunkBoundary = (text: string, start: number, chunkSize: number): number => {
  const idealEnd = Math.min(start + chunkSize, text.length);
  if (idealEnd >= text.length) return text.length;

  const minimumBoundary = Math.min(
    text.length,
    start + Math.max(1, Math.floor(chunkSize * 0.6)),
  );
  const window = text.slice(minimumBoundary, idealEnd + 1);
  const newlineOffset = window.lastIndexOf("\n");
  if (newlineOffset >= 0) {
    return minimumBoundary + newlineOffset;
  }

  const whitespaceOffset = window.lastIndexOf(" ");
  if (whitespaceOffset >= 0) {
    return minimumBoundary + whitespaceOffset;
  }

  return idealEnd;
};

const splitTextIntoChunkSegments = (
  text: string,
  config: Required<AiChunkingConfig>,
): Array<{ chunk_text: string; char_start: number; char_end: number }> => {
  const segments: Array<{ chunk_text: string; char_start: number; char_end: number }> = [];
  let start = 0;

  while (start < text.length) {
    const end = getChunkBoundary(text, start, config.chunk_max_characters);
    const rawSegment = text.slice(start, end);
    const chunkText = rawSegment.trim();

    if (chunkText) {
      const leadingTrimOffset = rawSegment.search(/\S/);
      const trailingTrimOffset = rawSegment.length - rawSegment.trimEnd().length;

      segments.push({
        chunk_text: chunkText,
        char_start: start + Math.max(leadingTrimOffset, 0),
        char_end: end - trailingTrimOffset,
      });
    }

    if (end >= text.length) break;

    const nextStart = Math.max(end - config.chunk_overlap_characters, start + 1);
    start = nextStart;
  }

  return segments;
};

const getCanonicalIncludedSources = (
  includedSources: AiIncludedSource[],
): AiIncludedSource[] => {
  return [...includedSources].sort((left, right) => {
    if (left.deck_id !== right.deck_id) return left.deck_id.localeCompare(right.deck_id);
    return left.source_id.localeCompare(right.source_id);
  });
};

export const buildAiScopeChunks = (
  resolution: AiScopeResolution,
  config: AiChunkingConfig = {},
): AiChunkDraft[] => {
  if (!resolution.content_hash || resolution.metadata.no_content) {
    return [];
  }

  const chunk_max_characters = clampChunkSize(
    config.chunk_max_characters,
    AI_CHUNK_MAX_CHARACTERS,
  );
  const chunk_overlap_characters = clampOverlap(
    config.chunk_overlap_characters,
    chunk_max_characters,
  );
  const normalizedConfig = {
    chunk_max_characters,
    chunk_overlap_characters,
  } satisfies Required<AiChunkingConfig>;

  const chunks: AiChunkDraft[] = [];
  let chunkIndex = 0;

  for (const source of getCanonicalIncludedSources(resolution.included_sources)) {
    const segments = splitTextIntoChunkSegments(source.normalized_text, normalizedConfig);

    segments.forEach((segment, sourceChunkIndex) => {
      chunks.push({
        scope_type: resolution.scope_type,
        scope_id: resolution.scope_id,
        content_hash: resolution.content_hash as string,
        chunk_index: chunkIndex,
        source_label: source.title || null,
        chunk_text: segment.chunk_text,
        metadata: {
          source_id: source.source_id,
          deck_id: source.deck_id,
          file_type: source.file_type,
          folder_id: source.folder_id,
          folder_name: source.folder_name,
          source_chunk_index: sourceChunkIndex,
          source_chunk_count: segments.length,
          char_start: segment.char_start,
          char_end: segment.char_end,
          text_length: source.text_length,
        },
      });
      chunkIndex += 1;
    });
  }

  return chunks;
};

const serializeEmbedding = (embedding: number[]): string => {
  return `[${embedding.join(",")}]`;
};

export const buildAiChunkEmbeddingRows = (
  chunks: AiChunkDraft[],
  embeddings: number[][],
  model: AiChunkEmbeddingModelConfig,
): AiChunkEmbeddingRow[] => {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Embedding count mismatch: expected ${chunks.length}, received ${embeddings.length}.`,
    );
  }

  return chunks.map((chunk, index) => {
    const embedding = embeddings[index];

    if (!embedding || embedding.length !== AI_EMBEDDING_VECTOR_DIMENSIONS) {
      throw new Error(
        `Embedding dimension mismatch for chunk ${chunk.chunk_index}: expected ${AI_EMBEDDING_VECTOR_DIMENSIONS}, received ${embedding?.length ?? 0}.`,
      );
    }

    return {
      ...chunk,
      embedding_model: model.embedding_model,
      model_version: model.model_version,
      embedding: serializeEmbedding(embedding),
    };
  });
};

const defaultDependencies: AiChunkIndexingDependencies = {
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

    const contentHash = data && typeof data === "object" ? (data as { content_hash?: unknown }).content_hash : null;
    return typeof contentHash === "string" ? contentHash : null;
  },

  async deleteChunksForScopeModel(scope) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("ai_chunk_embeddings")
      .delete()
      .eq("scope_type", scope.scope_type)
      .eq("scope_id", scope.scope_id)
      .eq("embedding_model", scope.embedding_model)
      .eq("model_version", scope.model_version);

    if (error) throw error;
  },

  async replaceScopeChunksAtomically(rows, key) {
    const supabase = getSupabase();
    const payload = rows.map((row) => ({
      chunk_index: row.chunk_index,
      source_label: row.source_label,
      chunk_text: row.chunk_text,
      embedding: row.embedding,
      metadata: row.metadata,
    }));

    const { error } = await supabase.rpc("replace_ai_chunk_embeddings_atomic", {
      p_scope_type: key.scope_type,
      p_scope_id: key.scope_id,
      p_content_hash: key.content_hash,
      p_embedding_model: key.embedding_model,
      p_model_version: key.model_version,
      p_rows: payload,
    });

    if (error) throw error;
  },

  async generateEmbeddings() {
    throw new Error(
      "AI chunk embedding generation is not configured. Inject generateEmbeddings when creating the indexing service.",
    );
  },
};

export const createAiChunkIndexingService = (
  dependencies: Partial<AiChunkIndexingDependencies> = {},
) => {
  const resolvedDependencies: AiChunkIndexingDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };

  return {
    async indexScope(
      input: AiChunkIndexingInput,
    ): Promise<AiChunkIndexingResult> {
      return withRetry(async () => {
        const scope = {
          scope_type: input.resolution.scope_type,
          scope_id: input.resolution.scope_id,
          embedding_model: input.embedding_model,
          model_version: input.model_version,
        } satisfies AiChunkIndexRepositoryScope;

        const previousContentHash = await resolvedDependencies.getLatestContentHash(scope);

        if (input.resolution.metadata.no_content || !input.resolution.content_hash) {
          await resolvedDependencies.deleteChunksForScopeModel(scope);

          return {
            status: "skipped",
            scope_type: input.resolution.scope_type,
            scope_id: input.resolution.scope_id,
            content_hash: null,
            chunk_count: 0,
            previous_content_hash: previousContentHash,
            content_hash_changed: previousContentHash !== null,
            skipped_reason: input.resolution.metadata.no_content_reason,
          };
        }

        const chunks = buildAiScopeChunks(input.resolution, {
          chunk_max_characters: input.chunk_max_characters,
          chunk_overlap_characters: input.chunk_overlap_characters,
        });

        if (chunks.length === 0) {
          throw new Error("Chunk indexing produced no chunks for extractable content.");
        }

        if (previousContentHash === input.resolution.content_hash) {
          return {
            status: "skipped",
            scope_type: input.resolution.scope_type,
            scope_id: input.resolution.scope_id,
            content_hash: input.resolution.content_hash,
            chunk_count: chunks.length,
            previous_content_hash: previousContentHash,
            content_hash_changed: false,
            skipped_reason: null,
          };
        }

        const embeddings = await resolvedDependencies.generateEmbeddings(chunks, {
          embedding_model: input.embedding_model,
          model_version: input.model_version,
        });

        const rows = buildAiChunkEmbeddingRows(chunks, embeddings, {
          embedding_model: input.embedding_model,
          model_version: input.model_version,
        });
        const key = {
          ...scope,
          content_hash: input.resolution.content_hash,
        } satisfies AiChunkIndexRepositoryKey;

        await resolvedDependencies.replaceScopeChunksAtomically(rows, key);

        return {
          status: "indexed",
          scope_type: input.resolution.scope_type,
          scope_id: input.resolution.scope_id,
          content_hash: input.resolution.content_hash,
          chunk_count: rows.length,
          previous_content_hash: previousContentHash,
          content_hash_changed:
            previousContentHash !== null && previousContentHash !== input.resolution.content_hash,
          skipped_reason: null,
        };
      });
    },
  };
};

export const aiChunkIndexingService = createAiChunkIndexingService();
