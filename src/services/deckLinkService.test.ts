/// <reference types="node" />
/// <reference types="vitest/globals" />

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

type TableChain = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
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
      select: vi.fn(() => chain),
      insert: vi.fn(() => {
        mode = "insert";
        return chain;
      }),
      update: vi.fn(() => {
        mode = "update";
        return chain;
      }),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      single: vi.fn(async () => consumeResponse(`${table}.${mode}.single`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(resolve, reject)) as TableChain["then"],
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

vi.mock("./deckService.shared", () => ({
  getRequiredDeckUserId: vi.fn(async (providedUserId?: string) => providedUserId || "user-1"),
}));

vi.mock("./userService", () => ({
  userService: {
    getProfile: vi.fn(async () => ({ handle: "founder" })),
  },
}));

vi.mock("../utils/resilience", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import { deckLinkService } from "./deckLinkService";

describe("deckLinkService", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
    vi.stubGlobal("window", undefined);
    process.env.BASE_URL = "http://localhost:5173";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists deck links with owner share URLs", async () => {
    mocks.queueResponse("decks.select.single", {
      data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("deck_links.select", {
      data: [
        {
          id: "link-1",
          deck_id: "deck-1",
          link_name: "Default Link",
          link_alias: "seed-round-link",
          public_token: "0123456789abcdef0123456789abcdef",
          is_enabled: true,
          is_primary: true,
          created_at: "2026-05-14T00:00:00.000Z",
          updated_at: "2026-05-14T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const links = await deckLinkService.listDeckLinks("deck-1", "user-1");

    expect(links).toHaveLength(1);
    expect(links[0].share_url).toBe(
      "http://localhost:5173/founder/seed-round-link",
    );
  });

  it("creates a new disabled link with saved name and alias metadata", async () => {
    mocks.queueResponse("decks.select.single", [
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
    ]);
    mocks.queueResponse("deck_links.select", {
      data: [],
      error: null,
    });
    mocks.queueResponse("deck_links.insert.single", {
        data: {
          id: "link-1",
          deck_id: "deck-1",
          link_name: "Investor Follow-up",
          link_alias: "investor-follow-up",
          public_token: "fedcba9876543210fedcba9876543210",
          is_enabled: false,
          is_primary: true,
        created_at: "2026-05-14T00:00:00.000Z",
        updated_at: "2026-05-14T00:00:00.000Z",
      },
      error: null,
    });

    const link = await deckLinkService.createDeckLink(
      "deck-1",
      { linkName: "Investor Follow-up", linkAlias: "Investor Follow Up" },
      "user-1",
    );

    const insertCall = vi.mocked(mocks.mockSupabase.from).mock.results[3]?.value.insert;
    expect(insertCall).toHaveBeenCalledWith({
      deck_id: "deck-1",
      link_name: "Investor Follow-up",
      link_alias: "investor-follow-up",
      is_enabled: false,
      is_primary: true,
    });
    expect(link.is_enabled).toBe(false);
    expect(link.is_primary).toBe(true);
    expect(link.link_name).toBe("Investor Follow-up");
    expect(link.link_alias).toBe("investor-follow-up");
  });

  it("rejects an explicit alias that normalizes to empty", async () => {
    mocks.queueResponse("decks.select.single", [
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
    ]);
    mocks.queueResponse("deck_links.select", {
      data: [],
      error: null,
    });

    await expect(
      deckLinkService.createDeckLink(
        "deck-1",
        { linkName: "Emoji Alias", linkAlias: "!!!🔥!!!" },
        "user-1",
      ),
    ).rejects.toThrow("Link alias must contain at least one letter or number.");

    const deckLinksChain = vi.mocked(mocks.mockSupabase.from).mock.results[2]?.value;
    expect(deckLinksChain?.insert).not.toHaveBeenCalled();
  });

  it("auto-generates a unique alias when creating a non-primary link without linkAlias", async () => {
    mocks.queueResponse("decks.select.single", [
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
    ]);

    // Existing primary link (alias omitted) means the next link must get a unique alias.
    mocks.queueResponse("deck_links.select", {
      data: [
        {
          id: "link-1",
          deck_id: "deck-1",
          link_name: "Default Link",
          link_alias: null,
          public_token: "0123456789abcdef0123456789abcdef",
          is_enabled: true,
          is_primary: true,
          created_at: "2026-05-14T00:00:00.000Z",
          updated_at: "2026-05-14T00:00:00.000Z",
        },
      ],
      error: null,
    });

    mocks.queueResponse("deck_links.insert.single", {
      data: {
        id: "link-2",
        deck_id: "deck-1",
        link_name: "Link 2",
        link_alias: "seed-round-link2",
        public_token: "fedcba9876543210fedcba9876543210",
        is_enabled: false,
        is_primary: false,
        created_at: "2026-05-14T00:00:03.000Z",
        updated_at: "2026-05-14T00:00:03.000Z",
      },
      error: null,
    });

    const link = await deckLinkService.createDeckLink("deck-1", {}, "user-1");

    const insertCall = vi.mocked(mocks.mockSupabase.from).mock.results[3]?.value.insert;
    expect(insertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        deck_id: "deck-1",
        is_primary: false,
        link_alias: "seed-round-link2",
      }),
    );
    expect(link.link_alias).toBe("seed-round-link2");
    expect(link.share_url).toBe("http://localhost:5173/founder/seed-round-link2");
  });

  it("recomputes alias and primary state after a unique-conflict race", async () => {
    mocks.queueResponse("decks.select.single", [
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
    ]);

    mocks.queueResponse("deck_links.select", [
      {
        data: [],
        error: null,
      },
      {
        data: [
          {
            id: "link-1",
            deck_id: "deck-1",
            link_name: "Default Link",
            link_alias: null,
            public_token: "0123456789abcdef0123456789abcdef",
            is_enabled: true,
            is_primary: true,
            created_at: "2026-05-14T00:00:00.000Z",
            updated_at: "2026-05-14T00:00:00.000Z",
          },
        ],
        error: null,
      },
    ]);

    mocks.queueResponse("deck_links.insert.single", [
      {
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
      {
        data: {
          id: "link-2",
          deck_id: "deck-1",
          link_name: "Link 2",
          link_alias: "seed-round-link2",
          public_token: "fedcba9876543210fedcba9876543210",
          is_enabled: false,
          is_primary: false,
          created_at: "2026-05-14T00:00:03.000Z",
          updated_at: "2026-05-14T00:00:03.000Z",
        },
        error: null,
      },
    ]);

    const link = await deckLinkService.createDeckLink("deck-1", {}, "user-1");

    const firstInsertCall = vi.mocked(mocks.mockSupabase.from).mock.results[3]?.value.insert;
    const secondInsertCall = vi.mocked(mocks.mockSupabase.from).mock.results[7]?.value.insert;

    expect(firstInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        deck_id: "deck-1",
        is_primary: true,
        link_alias: null,
      }),
    );
    expect(secondInsertCall).toHaveBeenCalledWith(
      expect.objectContaining({
        deck_id: "deck-1",
        is_primary: false,
        link_alias: "seed-round-link2",
      }),
    );
    expect(link.link_alias).toBe("seed-round-link2");
  });

  it("surfaces a user-friendly error when an explicit alias is taken concurrently", async () => {
    mocks.queueResponse("decks.select.single", [
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
      { data: { id: "deck-1", slug: "seed-round", user_id: "user-1" }, error: null },
    ]);

    mocks.queueResponse("deck_links.select", [
      {
        data: [],
        error: null,
      },
      {
        data: [
          {
            id: "link-1",
            deck_id: "deck-1",
            link_name: "Investor Follow-up",
            link_alias: "investor-follow-up",
            public_token: "fedcba9876543210fedcba9876543210",
            is_enabled: false,
            is_primary: false,
            created_at: "2026-05-14T00:00:03.000Z",
            updated_at: "2026-05-14T00:00:03.000Z",
          },
        ],
        error: null,
      },
    ]);

    mocks.queueResponse("deck_links.insert.single", {
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    await expect(
      deckLinkService.createDeckLink(
        "deck-1",
        { linkName: "Investor Follow-up", linkAlias: "Investor Follow Up" },
        "user-1",
      ),
    ).rejects.toThrow("Link alias is already in use.");
  });

  it("enables and disables deck links through the owner-scoped update path", async () => {
    mocks.queueResponse("decks.select.single", [
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
      {
        data: { id: "deck-1", slug: "seed-round", user_id: "user-1" },
        error: null,
      },
    ]);
    mocks.queueResponse("deck_links.update.single", [
      {
        data: {
          id: "link-1",
          deck_id: "deck-1",
          link_name: "Default Link",
          link_alias: "seed-round",
          public_token: "0123456789abcdef0123456789abcdef",
          is_enabled: true,
          is_primary: true,
          created_at: "2026-05-14T00:00:00.000Z",
          updated_at: "2026-05-14T00:00:01.000Z",
        },
        error: null,
      },
      {
        data: {
          id: "link-1",
          deck_id: "deck-1",
          link_name: "Default Link",
          link_alias: "seed-round",
          public_token: "0123456789abcdef0123456789abcdef",
          is_enabled: false,
          is_primary: true,
          created_at: "2026-05-14T00:00:00.000Z",
          updated_at: "2026-05-14T00:00:02.000Z",
        },
        error: null,
      },
    ]);

    const enabled = await deckLinkService.enableDeckLink("deck-1", "link-1", "user-1");
    const disabled = await deckLinkService.disableDeckLink("deck-1", "link-1", "user-1");

    const firstUpdateCall = vi.mocked(mocks.mockSupabase.from).mock.results[1]?.value.update;
    const secondUpdateCall = vi.mocked(mocks.mockSupabase.from).mock.results[3]?.value.update;

    expect(firstUpdateCall).toHaveBeenCalledWith(
      expect.objectContaining({ is_enabled: true }),
    );
    expect(secondUpdateCall).toHaveBeenCalledWith(
      expect.objectContaining({ is_enabled: false }),
    );
    expect(enabled.is_enabled).toBe(true);
    expect(disabled.is_enabled).toBe(false);
  });
});
