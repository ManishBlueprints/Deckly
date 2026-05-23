/// <reference types="vitest/globals" />

import {
  AI_SUMMARY_CACHE_WINDOW_HOURS,
  aiSummaryCacheService,
  createAiSummaryCacheService,
  buildAiSummaryCacheRowPayload,
  classifyAiSummaryCacheRow,
} from "./aiSummaryCacheService";

const mocks = vi.hoisted(() => {
  type MockResponse = {
    data?: unknown;
    error?: unknown;
  };

  type TableChain = {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: PromiseLike<MockResponse>["then"];
  };

  const responseQueues = new Map<string, MockResponse[]>();

  const queueResponse = (
    key: string,
    response: MockResponse | MockResponse[],
  ) => {
    responseQueues.set(key, Array.isArray(response) ? [...response] : [response]);
  };

  const consumeResponse = (key: string): MockResponse => {
    const queue = responseQueues.get(key) || [];
    const response = queue.shift() || { data: null, error: null };
    responseQueues.set(key, queue);
    return response;
  };

  const createTableChain = (table: string) => {
    let mode = "select";
    let ordered = false;

    const chain = {
      select: vi.fn(() => {
        mode = "select";
        ordered = false;
        return chain;
      }),
      update: vi.fn(() => {
        mode = "update";
        ordered = false;
        return chain;
      }),
      upsert: vi.fn(() => {
        mode = "upsert";
        ordered = false;
        return chain;
      }),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      order: vi.fn(() => {
        ordered = true;
        return chain;
      }),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(async () =>
        consumeResponse(`${table}.${mode}${ordered ? ".order" : ""}.maybeSingle`),
      ),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}${ordered ? ".order" : ""}`)).then(
          resolve,
          reject,
        )) as TableChain["then"],
    } as TableChain;

    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createTableChain(table)),
  };

  return {
    responseQueues,
    queueResponse,
    mockSupabase,
  };
});

vi.mock("./supabase", () => ({
  supabase: mocks.mockSupabase,
}));

describe("aiSummaryCacheService", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("returns a cached no-charge hit for a ready row", async () => {
    const now = new Date("2026-05-02T12:00:00.000Z");

    mocks.queueResponse("ai_summary_cache.select.maybeSingle", {
      data: {
        id: "cache-1",
        scope_type: "deck",
        scope_id: "deck-1",
        content_hash: "hash-1",
        model_identifier: "gpt-4o-mini",
        model_version: "v1",
        status: "ready",
        summary_text: "Ready summary",
        summary_metadata: { source_count: 3 },
        error_message: null,
        expires_at: "2026-05-03T12:00:00.000Z",
        generated_at: "2026-05-02T11:30:00.000Z",
        last_accessed_at: "2026-05-02T11:45:00.000Z",
        created_at: "2026-05-02T11:30:00.000Z",
        updated_at: "2026-05-02T11:45:00.000Z",
      },
      error: null,
    });

    const result = await aiSummaryCacheService.lookupCache(
      {
        scope_type: "deck",
        scope_id: "deck-1",
        content_hash: "hash-1",
        model_identifier: "gpt-4o-mini",
        model_version: "v1",
      },
      now,
    );

    expect(result).toMatchObject({
      state: "cached",
      cached_reopen: true,
      should_regenerate: false,
      summary_text: "Ready summary",
    });

    const chain = mocks.mockSupabase.from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };

    expect(chain.eq).toHaveBeenNthCalledWith(1, "scope_type", "deck");
    expect(chain.eq).toHaveBeenNthCalledWith(2, "scope_id", "deck-1");
    expect(chain.eq).toHaveBeenNthCalledWith(3, "content_hash", "hash-1");
    expect(chain.eq).toHaveBeenNthCalledWith(4, "model_identifier", "gpt-4o-mini");
    expect(chain.eq).toHaveBeenNthCalledWith(5, "model_version", "v1");
  });

  it("bypasses stale hash rows and signals regeneration", async () => {
    mocks.queueResponse("ai_summary_cache.select.maybeSingle", {
      data: null,
      error: null,
    });
    mocks.queueResponse("ai_summary_cache.select.order.maybeSingle", {
      data: {
        id: "cache-previous",
        scope_type: "folder",
        scope_id: "folder-1",
        content_hash: "old-hash",
        model_identifier: "gpt-4o-mini",
        model_version: "v1",
        status: "ready",
        summary_text: "Old summary",
        summary_metadata: {},
        error_message: null,
        expires_at: "2026-05-03T12:00:00.000Z",
        generated_at: "2026-05-02T11:00:00.000Z",
        last_accessed_at: null,
        created_at: "2026-05-02T11:00:00.000Z",
        updated_at: "2026-05-02T11:00:00.000Z",
      },
      error: null,
    });

    const result = await aiSummaryCacheService.lookupCache({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "new-hash",
      model_identifier: "gpt-4o-mini",
      model_version: "v1",
    });

    expect(result).toMatchObject({
      state: "stale",
      cached_reopen: false,
      should_regenerate: true,
    });
    expect(result.cache_row?.content_hash).toBe("old-hash");

    const exactChain = mocks.mockSupabase.from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
    };
    const latestChain = mocks.mockSupabase.from.mock.results[1]?.value as {
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };

    expect(exactChain.eq).toHaveBeenNthCalledWith(3, "content_hash", "new-hash");
    expect(latestChain.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(latestChain.eq).toHaveBeenNthCalledWith(1, "scope_type", "folder");
    expect(latestChain.eq).toHaveBeenNthCalledWith(2, "scope_id", "folder-1");
    expect(latestChain.eq).toHaveBeenNthCalledWith(3, "model_identifier", "gpt-4o-mini");
    expect(latestChain.eq).toHaveBeenNthCalledWith(4, "model_version", "v1");
  });

  it("maps persisted cache states for later orchestration", () => {
    const now = new Date("2026-05-02T12:00:00.000Z");

    expect(
      classifyAiSummaryCacheRow(
        {
          id: "cache-ready",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "ready",
          summary_text: "Summary",
          summary_metadata: {},
          error_message: null,
          expires_at: "2026-05-03T12:00:00.000Z",
          generated_at: null,
          last_accessed_at: null,
          created_at: "2026-05-02T11:00:00.000Z",
          updated_at: "2026-05-02T11:00:00.000Z",
        },
        now,
      ).state,
    ).toBe("cached");

    expect(
      classifyAiSummaryCacheRow(
        {
          id: "cache-pending",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "pending",
          summary_text: null,
          summary_metadata: {},
          error_message: null,
          expires_at: null,
          generated_at: null,
          last_accessed_at: null,
          created_at: "2026-05-02T11:00:00.000Z",
          updated_at: "2026-05-02T11:00:00.000Z",
        },
        now,
      ).state,
    ).toBe("generating");

    expect(
      classifyAiSummaryCacheRow(
        {
          id: "cache-error",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "error",
          summary_text: null,
          summary_metadata: {},
          error_message: "provider timeout",
          expires_at: null,
          generated_at: null,
          last_accessed_at: null,
          created_at: "2026-05-02T11:00:00.000Z",
          updated_at: "2026-05-02T11:00:00.000Z",
        },
        now,
      ).state,
    ).toBe("failed");

    expect(
      classifyAiSummaryCacheRow(
        {
          id: "cache-empty",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "no_content",
          summary_text: null,
          summary_metadata: {},
          error_message: null,
          expires_at: null,
          generated_at: null,
          last_accessed_at: null,
          created_at: "2026-05-02T11:00:00.000Z",
          updated_at: "2026-05-02T11:00:00.000Z",
        },
        now,
      ).state,
    ).toBe("no_content");

    expect(
      classifyAiSummaryCacheRow(
        {
          id: "cache-expired",
          scope_type: "deck",
          scope_id: "deck-1",
          content_hash: "hash-1",
          model_identifier: "gpt-4o-mini",
          model_version: "v1",
          status: "ready",
          summary_text: "Expired summary",
          summary_metadata: {},
          error_message: null,
          expires_at: "2026-05-02T11:59:59.000Z",
          generated_at: null,
          last_accessed_at: null,
          created_at: "2026-05-02T11:00:00.000Z",
          updated_at: "2026-05-02T11:00:00.000Z",
        },
        now,
      ).state,
    ).toBe("stale");
  });

  it("writes no_content rows with a bounded cache window", async () => {
    const now = new Date("2026-05-02T12:00:00.000Z");
    const upsertCacheRow = vi.fn(async () => undefined);

    const service = createAiSummaryCacheService({
      getExactCacheRow: vi.fn(async () => null),
      getLatestCacheRow: vi.fn(async () => null),
      claimPendingCacheRow: vi.fn(async () => true),
      markStaleRows: vi.fn(async () => undefined),
      upsertCacheRow,
    });

    await service.writeCache({
      scope_type: "data_room",
      scope_id: "room-1",
      content_hash: "hash-1",
      model_identifier: "gpt-4o-mini",
      model_version: "v1",
      status: "no_content",
      summary_metadata: { reason: "empty_scope" },
      now,
    });

    expect(upsertCacheRow).toHaveBeenCalledWith(
      expect.objectContaining({ status: "no_content", now }),
    );
    expect(
      buildAiSummaryCacheRowPayload({
        scope_type: "data_room",
        scope_id: "room-1",
        content_hash: "hash-1",
        model_identifier: "gpt-4o-mini",
        model_version: "v1",
        status: "no_content",
        summary_metadata: { reason: "empty_scope" },
        now,
      }).expires_at,
    ).toBe(
      new Date(now.getTime() + AI_SUMMARY_CACHE_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
    );
  });
});
