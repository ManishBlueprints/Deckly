/// <reference types="vitest/globals" />

import {
  createAiSummaryInitialOrchestrator,
  AI_SUMMARY_RECURSIVE_CHARACTER_THRESHOLD,
} from "./aiSummaryInitialOrchestrator";
import type { AiScopeResolution } from "./aiScopeResolutionBuilder";
import type { AiSummaryCacheLookupResult } from "./aiSummaryCacheService";

const createResolution = (
  overrides: Partial<AiScopeResolution> = {},
): AiScopeResolution => ({
  scope_type: "deck",
  scope_id: "deck-1",
  scope_label: "Deck One",
  content_hash: "hash-1",
  normalized_content: "Summary input",
  included_sources: [
    {
      source_id: "deck-1",
      deck_id: "deck-1",
      title: "Deck One",
      file_type: "pdf",
      folder_id: null,
      folder_name: null,
      normalized_text: "Summary input",
      text_length: "Summary input".length,
    },
  ],
  excluded_sources: [],
  metadata: {
    scope_type: "deck",
    scope_id: "deck-1",
    scope_label: "Deck One",
    partial_data: false,
    no_content: false,
    no_content_reason: null,
    total_sources: 1,
    included_sources: 1,
    excluded_sources: 0,
    unsupported_sources: 0,
    missing_text_sources: 0,
  },
  ...overrides,
});

const createCacheLookup = (
  overrides: Partial<AiSummaryCacheLookupResult> = {},
): AiSummaryCacheLookupResult => ({
  state: "miss",
  cached_reopen: false,
  should_regenerate: true,
  summary_text: null,
  summary_metadata: {},
  error_message: null,
  cache_row: null,
  ...overrides,
});

describe("aiSummaryInitialOrchestrator", () => {
  it("reuses an exact cache hit without generating a new summary", async () => {
    const resolveScope = vi.fn(async () => createResolution());
    const lookupCache = vi.fn(async () =>
      createCacheLookup({
        state: "cached",
        cached_reopen: true,
        should_regenerate: false,
        summary_text: "Cached summary",
        summary_metadata: { strategy: "one_shot" },
        cache_row: {
          id: "cache-1",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "ready",
          summary_text: "Cached summary",
          summary_metadata: { strategy: "one_shot" },
          error_message: null,
          expires_at: "2026-05-03T12:00:00.000Z",
          generated_at: "2026-05-02T12:00:00.000Z",
          last_accessed_at: null,
          created_at: "2026-05-02T12:00:00.000Z",
          updated_at: "2026-05-02T12:00:00.000Z",
        },
      }),
    );
    const getUsageCount = vi.fn(async () => 2);
    const generateSummary = vi.fn();

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope,
      lookupCache,
      claimCache: vi.fn(),
      writeCache: vi.fn(),
      getUsageCount,
      generateSummary,
    });

    const result = await orchestrator.summarize({
      scope_type: "deck",
      scope_id: "deck-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "FREE",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("cached");
    expect(result.summary_text).toBe("Cached summary");
    expect(result.cache.cached_reopen).toBe(true);
    expect(result.usage.quota).toMatchObject({
      reason: "cached_reopen",
      chargeable: false,
    });
    expect(generateSummary).not.toHaveBeenCalled();
  });

  it("keeps cached no-content reopen free", async () => {
    const getUsageCount = vi.fn(async () => 2);
    const writeCache = vi.fn();
    const generateSummary = vi.fn();

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () =>
        createResolution({
          content_hash: null,
          normalized_content: "",
          included_sources: [],
          metadata: {
            scope_type: "deck",
            scope_id: "deck-1",
            scope_label: "Deck One",
            partial_data: false,
            no_content: true,
            no_content_reason: "unsupported_files_only",
            total_sources: 1,
            included_sources: 0,
            excluded_sources: 1,
            unsupported_sources: 1,
            missing_text_sources: 0,
          },
        }),
      ),
      lookupCache: vi.fn(async () =>
        createCacheLookup({
          state: "no_content",
          cached_reopen: true,
          should_regenerate: false,
          summary_text: null,
          summary_metadata: { generation_mode: "no_content" },
          cache_row: {
            id: "cache-empty",
            scope_type: "deck",
            scope_id: "deck-1",
            content_hash: "no-content-hash",
            model_identifier: "gpt-4o-mini",
            model_version: "v1",
            status: "no_content",
            summary_text: null,
            summary_metadata: { generation_mode: "no_content" },
            error_message: null,
            expires_at: "2026-05-03T12:00:00.000Z",
            generated_at: "2026-05-02T12:00:00.000Z",
            last_accessed_at: null,
            created_at: "2026-05-02T12:00:00.000Z",
            updated_at: "2026-05-02T12:00:00.000Z",
          },
        }),
      ),
      claimCache: vi.fn(),
      writeCache,
      getUsageCount,
      generateSummary,
    });

    const result = await orchestrator.summarize({
      scope_type: "deck",
      scope_id: "deck-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "FREE",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("no_content");
    expect(result.cache.cached_reopen).toBe(true);
    expect(result.freshness.state).toBe("cached");
    expect(result.usage.quota).toMatchObject({
      reason: "cached_reopen",
      chargeable: false,
    });
    expect(writeCache).not.toHaveBeenCalled();
    expect(generateSummary).not.toHaveBeenCalled();
  });

  it("records usage for fresh chargeable no-content summaries", async () => {
    const writeCache = vi.fn().mockResolvedValue(
      createCacheLookup({
        state: "no_content",
        cached_reopen: false,
        should_regenerate: false,
        summary_text: null,
        summary_metadata: { generation_mode: "no_content" },
        cache_row: {
          id: "cache-empty",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "no-content-hash",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "no_content",
          summary_text: null,
          summary_metadata: { generation_mode: "no_content" },
          error_message: null,
          expires_at: "2026-05-03T12:00:00.000Z",
          generated_at: "2026-05-02T12:00:00.000Z",
          last_accessed_at: null,
          created_at: "2026-05-02T12:00:00.000Z",
          updated_at: "2026-05-02T12:00:00.000Z",
        },
      }),
    );
    const recordUsage = vi.fn().mockResolvedValue(undefined);

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () =>
        createResolution({
          content_hash: null,
          normalized_content: "",
          included_sources: [],
          metadata: {
            scope_type: "deck",
            scope_id: "deck-1",
            scope_label: "Deck One",
            partial_data: false,
            no_content: true,
            no_content_reason: "unsupported_files_only",
            total_sources: 1,
            included_sources: 0,
            excluded_sources: 1,
            unsupported_sources: 1,
            missing_text_sources: 0,
          },
        }),
      ),
      lookupCache: vi.fn(async () => createCacheLookup({ state: "miss" })),
      claimCache: vi.fn(),
      writeCache,
      getUsageCount: vi.fn(async () => 0),
      generateSummary: vi.fn(),
      recordUsage,
    });

    const result = await orchestrator.summarize({
      scope_type: "deck",
      scope_id: "deck-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "FREE",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("no_content");
    expect(recordUsage).toHaveBeenCalledTimes(1);
    expect(result.usage.quota).toMatchObject({
      allowed: true,
      chargeable: true,
      reason: "allowed",
    });
    expect(result.usage.usage_count).toBe(1);
  });

  it("blocks fresh no-content results when quota is exhausted", async () => {
    const writeCache = vi.fn();
    const generateSummary = vi.fn();

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () =>
        createResolution({
          content_hash: null,
          normalized_content: "",
          included_sources: [],
          metadata: {
            scope_type: "deck",
            scope_id: "deck-1",
            scope_label: "Deck One",
            partial_data: false,
            no_content: true,
            no_content_reason: "unsupported_files_only",
            total_sources: 1,
            included_sources: 0,
            excluded_sources: 1,
            unsupported_sources: 1,
            missing_text_sources: 0,
          },
        }),
      ),
      lookupCache: vi.fn(async () => createCacheLookup({ state: "miss" })),
      claimCache: vi.fn(),
      writeCache,
      getUsageCount: vi.fn(async () => 2),
      generateSummary,
    });

    const result = await orchestrator.summarize({
      scope_type: "deck",
      scope_id: "deck-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "FREE",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("quota_limited");
    expect(result.no_content).toBe(true);
    expect(result.usage.quota).toMatchObject({
      allowed: false,
      reason: "signed_in_limit_reached",
      chargeable: false,
    });
    expect(writeCache).not.toHaveBeenCalled();
    expect(generateSummary).not.toHaveBeenCalled();
  });

  it("switches large multi-file containers into the recursive summarization path", async () => {
    const longText = "A".repeat(Math.ceil(AI_SUMMARY_RECURSIVE_CHARACTER_THRESHOLD / 2) + 50);
    const resolution = createResolution({
      scope_type: "data_room",
      scope_id: "room-1",
      scope_label: "Fundraise Room",
      content_hash: "room-hash",
      included_sources: [
        {
          source_id: "doc-1",
          deck_id: "deck-1",
          title: "Deck One",
          file_type: "pdf",
          folder_id: null,
          folder_name: null,
          normalized_text: longText,
          text_length: longText.length,
        },
        {
          source_id: "doc-2",
          deck_id: "deck-2",
          title: "Deck Two",
          file_type: "pdf",
          folder_id: null,
          folder_name: null,
          normalized_text: longText,
          text_length: longText.length,
        },
      ],
      metadata: {
        scope_type: "data_room",
        scope_id: "room-1",
        scope_label: "Fundraise Room",
        partial_data: false,
        no_content: false,
        no_content_reason: null,
        total_sources: 2,
        included_sources: 2,
        excluded_sources: 0,
        unsupported_sources: 0,
        missing_text_sources: 0,
      },
    });

    const generateSummary = vi
      .fn()
      .mockResolvedValueOnce({ summary_text: "Source summary one" })
      .mockResolvedValueOnce({ summary_text: "Source summary two" })
      .mockResolvedValueOnce({ summary_text: "Combined room summary" });
    const writeCache = vi
      .fn()
      .mockResolvedValueOnce(createCacheLookup({ state: "miss" }))
      .mockResolvedValueOnce(
        createCacheLookup({
          state: "cached",
          cached_reopen: true,
          summary_text: "Combined room summary",
          summary_metadata: { strategy: "recursive" },
          cache_row: {
            id: "cache-ready",
            scope_type: "data_room",
            scope_id: "room-1",
            content_hash: "room-hash",
            model_identifier: "gpt-4o-mini",
            model_version: "v1",
            status: "ready",
            summary_text: "Combined room summary",
            summary_metadata: { strategy: "recursive" },
            error_message: null,
            expires_at: "2026-05-03T12:00:00.000Z",
            generated_at: "2026-05-02T12:00:00.000Z",
            last_accessed_at: null,
            created_at: "2026-05-02T12:00:00.000Z",
            updated_at: "2026-05-02T12:00:00.000Z",
          },
        }),
      );

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () => resolution),
      lookupCache: vi.fn(async () => createCacheLookup({ state: "miss" })),
      claimCache: vi.fn(async () => true),
      writeCache,
      getUsageCount: vi.fn(async () => 0),
      generateSummary,
      recordUsage: vi.fn(),
    });

    const result = await orchestrator.summarize({
      scope_type: "data_room",
      scope_id: "room-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "PRO",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("completed");
    expect(result.strategy).toBe("recursive");
    expect(generateSummary).toHaveBeenCalledTimes(3);
    expect(generateSummary).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ mode: "source", source_title: "Deck One" }),
    );
    expect(generateSummary).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ mode: "source", source_title: "Deck Two" }),
    );
    expect(generateSummary).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ mode: "aggregate" }),
    );
  });

  it("keeps completed summaries ready when usage recording fails", async () => {
    const writeCache = vi.fn().mockResolvedValue(
      createCacheLookup({
        state: "cached",
        cached_reopen: false,
        summary_text: "Fresh summary",
        summary_metadata: { strategy: "one_shot" },
        cache_row: {
          id: "cache-ready",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "ready",
          summary_text: "Fresh summary",
          summary_metadata: { strategy: "one_shot" },
          error_message: null,
          expires_at: "2026-05-03T12:00:00.000Z",
          generated_at: "2026-05-02T12:00:00.000Z",
          last_accessed_at: null,
          created_at: "2026-05-02T12:00:00.000Z",
          updated_at: "2026-05-02T12:00:00.000Z",
        },
      }),
    );
    const recordUsage = vi.fn().mockRejectedValue(new Error("quota write failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () => createResolution()),
      lookupCache: vi.fn(async () => createCacheLookup({ state: "miss" })),
      claimCache: vi.fn(async () => true),
      writeCache,
      getUsageCount: vi.fn(async () => 0),
      generateSummary: vi.fn(async () => ({ summary_text: "Fresh summary" })),
      recordUsage,
    });

    try {
      await expect(
        orchestrator.summarize({
          scope_type: "deck",
          scope_id: "deck-1",
          actor: {
            type: "signed_in",
            user_id: "user-1",
            tier: "FREE",
          },
          now: new Date("2026-05-02T12:00:00.000Z"),
        }),
      ).resolves.toMatchObject({
        status: "completed",
        summary_text: "Fresh summary",
      });

      expect(recordUsage).toHaveBeenCalledTimes(1);
      expect(writeCache).toHaveBeenCalledTimes(1);
      expect(writeCache).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ready",
          summary_text: "Fresh summary",
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        "Failed to record AI summary usage.",
        expect.objectContaining({
          actorType: "signed_in",
          scopeType: "deck",
          scopeId: "deck-1",
        }),
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("preserves the original generation error when error-cache write fails", async () => {
    const writeCache = vi
      .fn()
      .mockRejectedValueOnce(new Error("error cache write failed"));

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () => createResolution()),
      lookupCache: vi.fn(async () => createCacheLookup({ state: "miss" })),
      claimCache: vi.fn(async () => true),
      writeCache,
      getUsageCount: vi.fn(async () => 0),
      generateSummary: vi.fn(async () => {
        throw new Error("generation failed");
      }),
    });

    await expect(
      orchestrator.summarize({
        scope_type: "deck",
        scope_id: "deck-1",
        actor: {
          type: "signed_in",
          user_id: "user-1",
          tier: "FREE",
        },
        now: new Date("2026-05-02T12:00:00.000Z"),
      }),
    ).rejects.toThrow("generation failed");

    expect(writeCache).toHaveBeenCalledTimes(1);
  });

  it("returns generating when another worker already claimed the cache row", async () => {
    const lookupCache = vi
      .fn()
      .mockResolvedValueOnce(createCacheLookup({ state: "miss" }))
      .mockResolvedValueOnce(
        createCacheLookup({
          state: "generating",
          should_regenerate: false,
        }),
      );
    const claimCache = vi.fn(async () => false);
    const writeCache = vi.fn();
    const generateSummary = vi.fn();

    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: vi.fn(async () => createResolution()),
      lookupCache,
      claimCache,
      writeCache,
      getUsageCount: vi.fn(async () => 0),
      generateSummary,
    });

    const result = await orchestrator.summarize({
      scope_type: "deck",
      scope_id: "deck-1",
      actor: {
        type: "signed_in",
        user_id: "user-1",
        tier: "PRO",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(result.status).toBe("generating");
    expect(lookupCache).toHaveBeenCalledTimes(2);
    expect(claimCache).toHaveBeenCalledTimes(1);
    expect(writeCache).not.toHaveBeenCalled();
    expect(generateSummary).not.toHaveBeenCalled();
  });
});
