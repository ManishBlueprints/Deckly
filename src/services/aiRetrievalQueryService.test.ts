/// <reference types="vitest/globals" />

import {
  createAiRetrievalQueryService,
  rankAiRetrievalCandidates,
  selectBudgetedAiRetrievalSnippets,
} from "./aiRetrievalQueryService";
import type { AiRetrievalChunkRow } from "./aiRetrievalQueryService";

const MODEL = {
  embedding_model: "text-embedding-3-small",
  model_version: "2026-05-02",
} as const;

const createChunk = (overrides: Partial<AiRetrievalChunkRow> = {}): AiRetrievalChunkRow => ({
  id: "chunk-1",
  scope_type: "folder",
  scope_id: "folder-1",
  content_hash: "hash-folder-1",
  chunk_index: 0,
  source_label: "Financial Overview",
  chunk_text: "Revenue growth accelerated after the pricing update.",
  metadata: {
    source_id: "doc-1",
    deck_id: "deck-1",
    file_type: "pdf",
    folder_id: "folder-1",
    folder_name: "Finance",
    source_chunk_index: 0,
    source_chunk_count: 1,
    char_start: 0,
    char_end: 54,
    text_length: 54,
  },
  repository_score: null,
  ...overrides,
});

describe("aiRetrievalQueryService", () => {
  it("enforces strict folder scope isolation even when overlapping chunks are returned", async () => {
    const getLatestContentHash = vi.fn(async () => "hash-folder-1");
    const getScopeChunks = vi.fn(async () => [
      createChunk({
        id: "chunk-in-scope",
        chunk_text: "Revenue growth accelerated in the target finance folder.",
      }),
      createChunk({
        id: "chunk-other-folder",
        scope_id: "folder-2",
        metadata: {
          ...createChunk().metadata,
          folder_id: "folder-2",
          folder_name: "Other Folder",
        },
        chunk_text: "Revenue growth also appeared in a different folder.",
      }),
      createChunk({
        id: "chunk-other-room",
        scope_type: "data_room",
        scope_id: "room-1",
        content_hash: "hash-room-1",
        metadata: {
          ...createChunk().metadata,
          folder_id: null,
          folder_name: null,
        },
        chunk_text: "Revenue growth also appeared in the full room context.",
      }),
      createChunk({
        id: "chunk-stale-hash",
        content_hash: "old-hash",
        chunk_text: "Revenue growth from an old hash should never leak.",
      }),
    ]);

    const service = createAiRetrievalQueryService({
      getLatestContentHash,
      getScopeChunks,
    });

    const result = await service.retrieveSnippets({
      scope_type: "folder",
      scope_id: "folder-1",
      query: "revenue growth",
      ...MODEL,
    });

    expect(getLatestContentHash).toHaveBeenCalledWith({
      scope_type: "folder",
      scope_id: "folder-1",
      ...MODEL,
    });
    expect(getScopeChunks).toHaveBeenCalledWith(
      {
        scope_type: "folder",
        scope_id: "folder-1",
        content_hash: "hash-folder-1",
        ...MODEL,
      },
      expect.objectContaining({ query: "revenue growth" }),
    );
    expect(result.snippets).toHaveLength(1);
    expect(result.snippets[0]?.chunk_id).toBe("chunk-in-scope");
    expect(result.snippets[0]?.scope_id).toBe("folder-1");
    expect(result.metadata.filtered_out_count).toBe(3);
    expect(result.metadata.matched_chunk_ids).toEqual(["chunk-in-scope"]);
    expect(result.content_hash).toBe("hash-folder-1");
  });

  it("caps retrieval context by result count and keeps the highest-ranked snippets", () => {
    const ranked = rankAiRetrievalCandidates(
      [
        createChunk({
          id: "chunk-top",
          chunk_index: 1,
          chunk_text: "Revenue growth revenue growth improved across enterprise accounts.",
        }),
        createChunk({
          id: "chunk-second",
          chunk_index: 2,
          source_label: "Growth Commentary",
          chunk_text: "Growth remained strong while revenue expanded in Europe.",
        }),
        createChunk({
          id: "chunk-third",
          chunk_index: 3,
          chunk_text: "Revenue was stable but margin changes mattered more than growth.",
        }),
        createChunk({
          id: "chunk-fourth",
          chunk_index: 4,
          chunk_text: "A broad company overview with less relevant detail.",
        }),
      ],
      "revenue growth",
    );

    const budgeted = selectBudgetedAiRetrievalSnippets(ranked.ranked_chunks, {
      max_results: 2,
      max_characters: 120,
    });

    expect(ranked.fallback_used).toBe(false);
    expect(budgeted.snippets.map((snippet) => snippet.chunk_id)).toEqual([
      "chunk-top",
      "chunk-second",
    ]);
    expect(budgeted.snippets[0]?.ranking.combined_score).toBeGreaterThan(
      budgeted.snippets[1]?.ranking.combined_score ?? 0,
    );
    expect(budgeted.snippets).toHaveLength(2);
    expect(budgeted.used_characters).toBeLessThanOrEqual(120);
    expect(ranked.ranked_chunks.map((chunk) => chunk.id)).toEqual([
      "chunk-top",
      "chunk-second",
      "chunk-third",
    ]);
    expect(budgeted.dropped_chunk_ids).toContain("chunk-third");
  });

  it("uses a provided content hash and returns retrieval metadata for later orchestration", async () => {
    const getLatestContentHash = vi.fn(async () => "unexpected");
    const service = createAiRetrievalQueryService({
      getLatestContentHash,
      getScopeChunks: vi.fn(async () => [
        createChunk({
          id: "chunk-1",
          scope_type: "data_room",
          scope_id: "room-1",
          content_hash: "room-hash-1",
          metadata: {
            ...createChunk().metadata,
            folder_id: null,
            folder_name: null,
          },
        }),
      ]),
    });

    const result = await service.retrieveSnippets({
      scope_type: "data_room",
      scope_id: "room-1",
      content_hash: "room-hash-1",
      query: "pricing update",
      max_results: 3,
      max_characters: 300,
      ...MODEL,
    });

    expect(getLatestContentHash).not.toHaveBeenCalled();
    expect(result.metadata.content_hash_source).toBe("provided");
    expect(result.metadata.query_terms).toEqual(["pricing", "update"]);
    expect(result.metadata.returned_count).toBe(1);
    expect(result.metadata.candidate_count).toBe(1);
    expect(result.metadata.max_results).toBe(3);
    expect(result.metadata.max_characters).toBe(300);
    expect(result.snippets[0]).toMatchObject({
      chunk_id: "chunk-1",
      scope_type: "data_room",
      scope_id: "room-1",
      content_hash: "room-hash-1",
    });
  });
});
