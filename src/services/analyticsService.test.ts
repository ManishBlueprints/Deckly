/// <reference types="vitest/globals" />

import { vi } from "vitest";

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

const mocks = vi.hoisted(() => {
  const responseQueues = new Map<string, MockResponse[]>();

  const queueResponse = (key: string, response: MockResponse | MockResponse[]) => {
    responseQueues.set(key, Array.isArray(response) ? [...response] : [response]);
  };

  const consumeResponse = (key: string): MockResponse => {
    const queue = responseQueues.get(key) || [];
    const response = queue.shift() || { data: null, error: null };
    responseQueues.set(key, queue);
    return response;
  };

  const createChain = (table: string) => {
    let mode = "select";
    const chain = {
      select: vi.fn(() => {
        mode = "select";
        return chain;
      }),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => consumeResponse(`${table}.${mode}.maybeSingle`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(resolve, reject)) as PromiseLike<MockResponse>["then"],
    };

    return chain;
  };

  const rpc = vi.fn(async (): Promise<MockResponse> => ({ data: null, error: null }));

  const mockSupabase = {
    from: vi.fn((table: string) => createChain(table)),
    rpc,
  };

  return {
    responseQueues,
    queueResponse,
    mockSupabase,
  };
});

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("./supabase.ts", () => ({
  supabase: mocks.mockSupabase,
}));

vi.mock("../utils/resilience", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import { analyticsService } from "./analyticsService";

describe("analyticsService ownership gates", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("refuses unique-visitor RPC access when the caller does not own the deck", async () => {
    mocks.queueResponse("decks.select.maybeSingle", {
      data: null,
      error: null,
    });

    await expect(
      analyticsService.getUniqueVisitorCount("deck-1", "user-1"),
    ).rejects.toThrow("Unauthorized");

    expect(vi.mocked(mocks.mockSupabase.rpc)).not.toHaveBeenCalled();
  });

  it("allows unique-visitor RPC access after ownership is confirmed", async () => {
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { id: "deck-1" },
      error: null,
    });
    vi.mocked(mocks.mockSupabase.rpc).mockImplementationOnce(async () => ({
      data: 7,
      error: null,
    }));

    await expect(
      analyticsService.getUniqueVisitorCount("deck-1", "user-1"),
    ).resolves.toBe(7);

    expect(vi.mocked(mocks.mockSupabase.from)).toHaveBeenCalledWith("decks");
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith(
      "count_unique_visitors",
      { p_deck_id: "deck-1" },
    );
  });

  it("refuses deck-link-stats RPC access when the caller does not own the deck", async () => {
    mocks.queueResponse("decks.select.maybeSingle", {
      data: null,
      error: null,
    });

    await expect(
      analyticsService.getDeckLinkStats("deck-1", "user-1"),
    ).rejects.toThrow("Unauthorized");

    expect(vi.mocked(mocks.mockSupabase.rpc)).not.toHaveBeenCalled();
  });

  it("allows deck-link-stats RPC access after ownership is confirmed", async () => {
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { id: "deck-1" },
      error: null,
    });
    vi.mocked(mocks.mockSupabase.rpc).mockImplementationOnce(async () => ({
      data: [{ link_id: "link-1", link_name: "Link 1", total_views: 12 }],
      error: null,
    }));

    await expect(
      analyticsService.getDeckLinkStats("deck-1", "user-1"),
    ).resolves.toEqual([{ link_id: "link-1", link_name: "Link 1", total_views: 12 }]);

    expect(vi.mocked(mocks.mockSupabase.from)).toHaveBeenCalledWith("decks");
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith(
      "get_deck_link_stats",
      { p_deck_id: "deck-1" },
    );
  });

  it("normalizes partial deck-download analytics RPC responses", async () => {
    mocks.queueResponse("decks.select.maybeSingle", {
      data: { id: "deck-1" },
      error: null,
    });
    vi.mocked(mocks.mockSupabase.rpc).mockImplementationOnce(async () => ({
      data: {
        total_downloads: 3,
        unique_downloaders: 2,
        direct_link_downloads: 1,
        data_room_downloads: 2,
        downloaders_truncated: false,
        links: null,
        data_rooms: undefined,
        downloaders: null,
      },
      error: null,
    }));

    await expect(
      analyticsService.getDeckDownloadAnalytics("deck-1", "user-1"),
    ).resolves.toEqual({
      total_downloads: 3,
      unique_downloaders: 2,
      direct_link_downloads: 1,
      data_room_downloads: 2,
      downloaders_truncated: false,
      links: [],
      data_rooms: [],
      downloaders: [],
    });
  });

  it("normalizes partial data-room download analytics RPC responses", async () => {
    vi.mocked(mocks.mockSupabase.rpc).mockImplementationOnce(async () => ({
      data: {
        total_downloads: 4,
        unique_downloaders: 3,
        downloaders_truncated: true,
        documents: null,
        downloaders: undefined,
      },
      error: null,
    }));

    await expect(
      analyticsService.getDataRoomDownloadAnalytics("room-1"),
    ).resolves.toEqual({
      total_downloads: 4,
      unique_downloaders: 3,
      downloaders_truncated: true,
      documents: [],
      downloaders: [],
    });
  });
});
