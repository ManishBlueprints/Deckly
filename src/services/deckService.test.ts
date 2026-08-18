/// <reference types="vitest/globals" />

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

type TableChain = {
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: PromiseLike<MockResponse>["then"];
};

type RpcChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: PromiseLike<MockResponse>["then"];
};

const mocks = vi.hoisted(() => {
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
    const chain = {
      delete: vi.fn(() => {
        mode = "delete";
        return chain;
      }),
      update: vi.fn(() => {
        mode = "update";
        return chain;
      }),
      select: vi.fn(() => {
        mode = "select";
        return chain;
      }),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => consumeResponse(`${table}.${mode}.maybeSingle`)),
      single: vi.fn(async () => consumeResponse(`${table}.${mode}.single`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(resolve, reject)) as TableChain["then"],
    } as TableChain;

    return chain;
  };

  const createRpcChain = (fn: string) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => consumeResponse(`rpc.${fn}.maybeSingle`)),
      single: vi.fn(async () => consumeResponse(`rpc.${fn}.single`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`rpc.${fn}`)).then(resolve, reject)) as RpcChain["then"],
    } as RpcChain;

    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createTableChain(table)),
    rpc: vi.fn((fn: string) => createRpcChain(fn)),
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrls: vi.fn(),
      })),
    },
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

vi.mock("./deckBrandingService", () => ({
  deckBrandingService: {
    getBrandingSettings: vi.fn(),
    updateBrandingSettings: vi.fn(),
    uploadLogo: vi.fn(),
  },
}));

vi.mock("./deckLibraryService", () => ({
  deckLibraryService: {
    saveToLibrary: vi.fn(),
    removeFromLibrary: vi.fn(),
    isDeckSaved: vi.fn(),
    getSavedDecks: vi.fn(),
    updateLibraryLastViewed: vi.fn(),
  },
}));

vi.mock("./deckStorageService", () => ({
  deckStorageService: {
    uploadDeckFile: vi.fn(),
    deleteDeckAssets: vi.fn(),
    deleteDeckWatermarkAssets: vi.fn(),
    deleteDeckRevisionAssets: vi.fn(),
    uploadSlideImages: vi.fn(),
    getStoragePath: vi.fn(),
  },
}));

vi.mock("./deckService.shared", () => ({
  getDeckSession: vi.fn(),
  getRequiredDeckUserId: vi.fn(),
  extractStoragePath: vi.fn(),
}));

vi.mock("./globalTagService", () => ({
  globalTagService: {
    fetchTagsByIds: vi.fn(),
  },
}));

vi.mock("../utils/resilience", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import { deckService } from "./deckService";
import { extractStoragePath, getDeckSession, getRequiredDeckUserId } from "./deckService.shared";
import { deckStorageService } from "./deckStorageService";

describe("deckService.deleteDeck", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("keeps the deck hidden when primary asset cleanup fails", async () => {
    vi.mocked(getRequiredDeckUserId).mockResolvedValue("user-1");
    vi.mocked(deckStorageService.deleteDeckWatermarkAssets).mockResolvedValue(undefined);
    vi.mocked(deckStorageService.deleteDeckAssets).mockRejectedValue(new Error("slide storage unavailable"));
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { user_id: "user-1", status: "PROCESSED" },
      error: null,
    });
    mocks.queueResponse("decks.update", { data: null, error: null });

    await expect(deckService.deleteDeck("deck-1", "https://cdn.example/decks/user-1/decks/deck.pdf", "deck", "user-1"))
      .rejects.toThrow("slide storage unavailable");

    expect(deckStorageService.deleteDeckAssets).toHaveBeenCalledWith(
      "https://cdn.example/decks/user-1/decks/deck.pdf",
      "deck",
      "user-1",
    );
    const markDeletingChain = mocks.mockSupabase.from.mock.results[1]?.value as TableChain;
    expect(markDeletingChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DELETED" }),
    );
    expect(mocks.mockSupabase.from).toHaveBeenCalledTimes(2);
  });

  it("rejects a non-owned deck before attempting storage cleanup", async () => {
    vi.mocked(getRequiredDeckUserId).mockResolvedValue("user-1");
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { user_id: "user-2", status: "PROCESSED" },
      error: null,
    });

    await expect(
      deckService.deleteDeck("deck-1", "https://cdn.example/decks/user-1/decks/deck.pdf", "deck", "user-1"),
    ).rejects.toThrow("Deck not found.");

    expect(deckStorageService.deleteDeckWatermarkAssets).not.toHaveBeenCalled();
    expect(deckStorageService.deleteDeckAssets).not.toHaveBeenCalled();
  });

  it("removes storage before deleting the deck row", async () => {
    vi.mocked(getRequiredDeckUserId).mockResolvedValue("user-1");
    vi.mocked(deckStorageService.deleteDeckAssets).mockResolvedValue(undefined);
    vi.mocked(deckStorageService.deleteDeckWatermarkAssets).mockResolvedValue(undefined);
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { user_id: "user-1", status: "PROCESSED" },
      error: null,
    });
    mocks.queueResponse("decks.update", { data: null, error: null });
    mocks.queueResponse("decks.delete", { data: null, error: null });

    await expect(deckService.deleteDeck("deck-1", "https://cdn.example/decks/user-1/decks/deck.pdf", "deck", "user-1"))
      .resolves.toEqual({ dbDeleted: true, assetsDeleted: true });

    const markDeletingCall = mocks.mockSupabase.from.mock.invocationCallOrder[1];
    const watermarkCleanupCall = vi.mocked(deckStorageService.deleteDeckWatermarkAssets).mock.invocationCallOrder[0];
    const assetCleanupCall = vi.mocked(deckStorageService.deleteDeckAssets).mock.invocationCallOrder[0];
    const deleteCall = mocks.mockSupabase.from.mock.invocationCallOrder[2];
    expect(markDeletingCall).toBeLessThan(watermarkCleanupCall);
    expect(watermarkCleanupCall).toBeLessThan(assetCleanupCall);
    expect(assetCleanupCall).toBeLessThan(deleteCall);
  });

  it("keeps the deck hidden when database deletion fails after storage cleanup", async () => {
    const databaseError = new Error("database unavailable");
    vi.mocked(getRequiredDeckUserId).mockResolvedValue("user-1");
    vi.mocked(deckStorageService.deleteDeckAssets).mockResolvedValue(undefined);
    vi.mocked(deckStorageService.deleteDeckWatermarkAssets).mockResolvedValue(undefined);
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { user_id: "user-1", status: "PROCESSED" },
      error: null,
    });
    mocks.queueResponse("decks.update", { data: null, error: null });
    mocks.queueResponse("decks.delete", { data: null, error: databaseError });

    await expect(
      deckService.deleteDeck("deck-1", "https://cdn.example/decks/user-1/decks/deck.pdf", "deck", "user-1"),
    ).resolves.toEqual({
      dbDeleted: false,
      assetsDeleted: true,
      deletionPending: true,
      cleanupError: databaseError,
    });

    expect(deckStorageService.deleteDeckWatermarkAssets).toHaveBeenCalledWith("deck-1", "user-1");
    expect(deckStorageService.deleteDeckAssets).toHaveBeenCalledWith(
      "https://cdn.example/decks/user-1/decks/deck.pdf",
      "deck",
      "user-1",
    );
    const updateChain = mocks.mockSupabase.from.mock.results[1]?.value as TableChain;
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DELETED" }),
    );
  });
});

describe("deckService.getAllDecks", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("hydrates only the first page of each deck for picker thumbnails", async () => {
    vi.mocked(getDeckSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(extractStoragePath).mockReturnValue("user-1/decks/seed-page-1.png");
    vi.mocked(mocks.mockSupabase.functions.invoke).mockResolvedValue({
      data: {
        data: [
          {
            path: "user-1/decks/seed-page-1.png",
            signedUrl: "https://signed.example.com/seed-page-1.png",
          },
        ],
      },
      error: null,
    });
    mocks.queueResponse("decks.select", {
      data: [
        {
          id: "deck-1",
          title: "Seed",
          slug: "seed-round",
          file_url: "user-1/decks/seed.pdf",
          status: "PROCESSED",
          user_id: "user-1",
          display_order: 0,
          pages: [
            { page_number: 1, image_url: "user-1/decks/seed-page-1.png" },
            { page_number: 2, image_url: "user-1/decks/seed-page-2.png" },
          ],
          created_at: "2026-05-14T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const decks = await deckService.getAllDecks();

    expect(decks[0].pages[0].image_url).toBe("https://signed.example.com/seed-page-1.png");
    expect(decks[0].pages[1].image_url).toBe("user-1/decks/seed-page-2.png");
    expect(vi.mocked(mocks.mockSupabase.functions.invoke)).toHaveBeenCalledWith(
      "r2-storage",
      {
        body: {
          action: "create-signed-urls",
          bucket: "decks",
          paths: ["user-1/decks/seed-page-1.png"],
          expiresInSeconds: 3600,
        },
      },
    );
  });
});

describe("deckService watermark processing actions", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("accepts the durable retry job response and the cleanup response", async () => {
    vi.mocked(mocks.mockSupabase.functions.invoke)
      .mockResolvedValueOnce({ data: { id: "job-1", status: "queued" }, error: null })
      .mockResolvedValueOnce({ data: { cleaned: true }, error: null });

    await expect(deckService.generateWatermarkedDeck("deck-1")).resolves.toBeUndefined();
    await expect(deckService.cleanupWatermarkedDeck("deck-1")).resolves.toBeUndefined();

    expect(vi.mocked(mocks.mockSupabase.functions.invoke)).toHaveBeenNthCalledWith(1, "document-processing", {
      body: { action: "retry-watermark", deckId: "deck-1" },
    });
    expect(vi.mocked(mocks.mockSupabase.functions.invoke)).toHaveBeenNthCalledWith(2, "document-processing", {
      body: { action: "cleanup-watermark", deckId: "deck-1" },
    });
  });
});

describe("deckService.getDecksWithAnalytics", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("hydrates deck link counts without overwriting analytics fields", async () => {
    mocks.queueResponse("decks.select", [
      {
        data: [
          {
            id: "deck-1",
            title: "Seed",
            slug: "seed-round",
            file_url: "https://files.example.com/deck.pdf",
            status: "PROCESSED",
            user_id: "user-1",
            display_order: 0,
            pages: [],
            created_at: "2026-05-14T00:00:00.000Z",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: "deck-1",
            deck_tags: [{ global_tags: { id: "tag-1", name: "Investor", color: "blue", deleted_at: null } }],
          },
        ],
        error: null,
      },
    ]);
    mocks.queueResponse("deck_stats.select", {
      data: [
        { deck_id: "deck-1", updated_at: "2026-05-15T00:00:00.000Z" },
      ],
      error: null,
    });
    mocks.queueResponse("deck_page_views.select", {
      data: [
        { deck_id: "deck-1", visitor_id: "visitor-1" },
        { deck_id: "deck-1", visitor_id: "visitor-1" },
        { deck_id: "deck-1", visitor_id: "visitor-2" },
      ],
      error: null,
    });
    mocks.queueResponse("investor_library.select", {
      data: [
        { deck_id: "deck-1" },
        { deck_id: "deck-1" },
      ],
      error: null,
    });
    mocks.queueResponse("deck_links.select", {
      data: [
        { deck_id: "deck-1", is_enabled: true },
        { deck_id: "deck-1", is_enabled: false },
        { deck_id: "deck-1", is_enabled: true },
      ],
      error: null,
    });

    const decks = await deckService.getDecksWithAnalytics("user-1");

    expect(decks).toHaveLength(1);
    expect(decks[0]).toMatchObject({
      total_views: 2,
      save_count: 2,
      last_viewed_at: "2026-05-15T00:00:00.000Z",
      active_link_count: 2,
      total_link_count: 3,
    });
    expect(decks[0].tags).toEqual([
      { id: "tag-1", name: "Investor", color: "blue", deleted_at: null },
    ]);
  });
});

describe("deckService public alias-only contracts", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
    vi.mocked(mocks.mockSupabase.functions.invoke).mockReset();
  });

  it("forwards handle plus slug-or-alias for public deck lookup and slug fallback lookups", async () => {
    mocks.queueResponse("rpc.get_decks_public.single", {
      data: { id: "deck-1", slug: "seed-round", user_handle: "founder" },
      error: null,
    });
    mocks.queueResponse("rpc.get_decks_public.maybeSingle", {
      data: { user_handle: "founder", slug: "seed-round" },
      error: null,
    });

    await deckService.getDeckByHandleAndSlug(
      "founder",
      "seed-round",
    );
    await deckService.getDeckBySlugOnly("seed-round");

    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenNthCalledWith(1, "get_decks_public", {
      p_handle: "founder",
      p_slug_or_alias: "seed-round",
    });
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenNthCalledWith(2, "get_decks_public", {
      p_handle: null,
      p_slug_or_alias: "seed-round",
    });
  });

  it("forwards handle plus slug-or-alias for password checks", async () => {
    mocks.queueResponse("rpc.check_deck_password", {
      data: true,
      error: null,
    });

    const result = await deckService.checkDeckPassword(
      "founder",
      "seed-round",
      "letmein",
    );

    expect(result).toBe(true);
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith("check_deck_password", {
      p_handle: "founder",
      p_slug_or_alias: "seed-round",
      p_password: "letmein",
    });
  });

  it("reuses handle plus slug-or-alias for payload fetches and sign-deck-url revalidation", async () => {
    mocks.queueResponse("rpc.get_deck_payload", {
      data: {
        file_url: "https://example.com/storage/v1/object/public/decks/user-1/decks/seed.pdf",
        storage_path: "user-1/decks/seed.pdf",
        pages: [],
      },
      error: null,
    });

    vi.mocked(mocks.mockSupabase.functions.invoke).mockResolvedValue({
      data: {
        signed_url: "https://signed.example.com/seed.pdf",
        signed_pages: [],
        expires_in: 21600,
      },
      error: null,
    });

    const payload = await deckService.getDeckPayload(
      "seed-round",
      "letmein",
      "founder",
    );

    expect(payload.signed_url).toBe("https://signed.example.com/seed.pdf");
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith("get_deck_payload", {
      p_handle: "founder",
      p_slug_or_alias: "seed-round",
      p_password: "letmein",
    });
    expect(vi.mocked(mocks.mockSupabase.functions.invoke)).toHaveBeenCalledWith("sign-deck-url", {
      body: {
        handle: "founder",
        slug: "seed-round",
        password: "letmein",
        storage_path: "user-1/decks/seed.pdf",
        image_paths: [],
      },
    });
  });
});
