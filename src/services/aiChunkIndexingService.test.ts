/// <reference types="vitest/globals" />

import {
  AI_EMBEDDING_VECTOR_DIMENSIONS,
  buildAiChunkEmbeddingRows,
  buildAiScopeChunks,
  createAiChunkIndexingService,
} from "./aiChunkIndexingService";
import { buildAiScopeResolution } from "./aiScopeResolverService";

const createEmbedding = (seed: number): number[] =>
  Array.from({ length: AI_EMBEDDING_VECTOR_DIMENSIONS }, (_, index) => seed + index / 10000);

describe("aiChunkIndexingService", () => {
  it("builds stable chunk rows from normalized extractable sources", async () => {
    const resolution = await buildAiScopeResolution(
      {
        scope_type: "data_room",
        scope_id: "room-1",
        scope_label: "Fundraise",
      },
      [
        {
          id: "doc-b",
          deck_id: "deck-b",
          title: "Later Deck",
          file_type: "pdf",
          extracted_text: "Gamma summary\nDelta detail",
        },
        {
          id: "doc-a",
          deck_id: "deck-a",
          title: "Earlier Deck",
          file_type: "pdf",
          extracted_text: "Alpha summary\nBeta detail",
        },
      ],
    );

    const chunks = buildAiScopeChunks(resolution, {
      chunk_max_characters: 18,
      chunk_overlap_characters: 4,
    });
    const rows = buildAiChunkEmbeddingRows(
      chunks,
      chunks.map((_, index) => createEmbedding(index + 1)),
      {
        embedding_model: "text-embedding-3-small",
        model_version: "2026-05-02",
      },
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.chunk_index)).toEqual([0, 1, 2, 3]);
    expect(rows.map((row) => row.source_label)).toEqual([
      "Earlier Deck",
      "Earlier Deck",
      "Later Deck",
      "Later Deck",
    ]);
    expect(rows.map((row) => row.content_hash)).toEqual(
      Array.from({ length: 4 }, () => resolution.content_hash),
    );
    expect(rows[0]).toMatchObject({
      scope_type: "data_room",
      scope_id: "room-1",
      chunk_text: "Alpha summary",
      embedding_model: "text-embedding-3-small",
      model_version: "2026-05-02",
      metadata: {
        source_id: "doc-a",
        deck_id: "deck-a",
        source_chunk_index: 0,
        source_chunk_count: 2,
      },
    });
    expect(rows[0]?.embedding.startsWith("[1,")).toBe(true);
    expect(rows[3]).toMatchObject({
      metadata: {
        source_id: "doc-b",
        source_chunk_index: 1,
        source_chunk_count: 2,
      },
    });
    expect(rows[3]?.chunk_text).toContain("Delta detail");
  });

  it("re-indexes with a new content hash and replaces persisted chunks", async () => {
    const resolution = await buildAiScopeResolution(
      {
        scope_type: "folder",
        scope_id: "folder-1",
        scope_label: "Finance",
      },
      [
        {
          id: "doc-1",
          deck_id: "deck-1",
          title: "Metrics",
          file_type: "pdf",
          extracted_text: "Monthly recurring revenue improved meaningfully across the quarter.",
        },
      ],
    );

    const getLatestContentHash = vi.fn(async () => "old-hash");
    const deleteChunksForScopeModel = vi.fn(async () => undefined);
    const deleteStaleChunks = vi.fn(async () => undefined);
    const replaceExactChunks = vi.fn(async () => undefined);
    const generateEmbeddings = vi.fn(async (chunks: Array<{ chunk_text: string }>) =>
      chunks.map((_, index) => createEmbedding(index + 10)),
    );

    const service = createAiChunkIndexingService({
      getLatestContentHash,
      deleteChunksForScopeModel,
      deleteStaleChunks,
      replaceExactChunks,
      generateEmbeddings,
    });

    const result = await service.indexScope({
      resolution,
      embedding_model: "text-embedding-3-small",
      model_version: "2026-05-02",
      chunk_max_characters: 40,
      chunk_overlap_characters: 6,
    });

    expect(result).toMatchObject({
      status: "indexed",
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: resolution.content_hash,
      previous_content_hash: "old-hash",
      content_hash_changed: true,
      skipped_reason: null,
    });
    expect(deleteChunksForScopeModel).not.toHaveBeenCalled();
    expect(generateEmbeddings).toHaveBeenCalledTimes(1);
    expect(deleteStaleChunks).toHaveBeenCalledWith({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: resolution.content_hash,
      embedding_model: "text-embedding-3-small",
      model_version: "2026-05-02",
    });
    expect(replaceExactChunks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          scope_type: "folder",
          scope_id: "folder-1",
          content_hash: resolution.content_hash,
          embedding_model: "text-embedding-3-small",
          model_version: "2026-05-02",
        }),
      ]),
      expect.objectContaining({
        content_hash: resolution.content_hash,
      }),
    );
  });

  it("clears prior rows and skips indexing for no-content scopes", async () => {
    const resolution = await buildAiScopeResolution(
      {
        scope_type: "deck",
        scope_id: "deck-1",
        scope_label: "Unsupported",
      },
      [
        {
          id: "deck-1",
          deck_id: "deck-1",
          title: "Unsupported",
          file_type: "png",
        },
      ],
    );

    const getLatestContentHash = vi.fn(async () => "old-hash");
    const deleteChunksForScopeModel = vi.fn(async () => undefined);
    const deleteStaleChunks = vi.fn(async () => undefined);
    const replaceExactChunks = vi.fn(async () => undefined);
    const generateEmbeddings = vi.fn(async () => [createEmbedding(1)]);

    const service = createAiChunkIndexingService({
      getLatestContentHash,
      deleteChunksForScopeModel,
      deleteStaleChunks,
      replaceExactChunks,
      generateEmbeddings,
    });

    const result = await service.indexScope({
      resolution,
      embedding_model: "text-embedding-3-small",
      model_version: "2026-05-02",
    });

    expect(result).toEqual({
      status: "skipped",
      scope_type: "deck",
      scope_id: "deck-1",
      content_hash: null,
      chunk_count: 0,
      previous_content_hash: "old-hash",
      content_hash_changed: true,
      skipped_reason: "unsupported_files_only",
    });
    expect(deleteChunksForScopeModel).toHaveBeenCalledWith({
      scope_type: "deck",
      scope_id: "deck-1",
      embedding_model: "text-embedding-3-small",
      model_version: "2026-05-02",
    });
    expect(deleteStaleChunks).not.toHaveBeenCalled();
    expect(replaceExactChunks).not.toHaveBeenCalled();
    expect(generateEmbeddings).not.toHaveBeenCalled();
  });
});
