/// <reference types="node" />
/// <reference types="vitest/globals" />

type MockResponse = {
  data?: unknown;
  error?: unknown;
};

type TableChain = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
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
    const mode = "select";
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      neq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(resolve, reject)) as TableChain["then"],
    } as TableChain;

    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createTableChain(table)),
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      if (fn === "check_data_room_password") {
        return { data: true, error: null, args };
      }
      if (fn === "get_data_room_payload") {
        return { data: [], error: null, args };
      }
      return { data: null, error: null, args };
    }),
    functions: {
      invoke: vi.fn(async () => ({ data: { signed_pages: [] }, error: null })),
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

vi.mock("./authSession", () => ({
  getRequiredSessionUserId: vi.fn(async (providedUserId?: string) => providedUserId || "user-1"),
  getSessionUserId: vi.fn(async (providedUserId?: string) => providedUserId || "user-1"),
}));

vi.mock("../utils/resilience", () => ({
  withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

import { dataRoomService } from "./dataRoomService";

describe("dataRoomService room slug scoping", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
  });

  it("scopes room slug availability to the current owner", async () => {
    mocks.queueResponse("data_rooms.select", {
      data: [{ id: "room-1" }],
      error: null,
    });

    const available = await dataRoomService.checkSlugAvailable("main-room", "room-2");

    expect(available).toBe(false);

    const selectCall = vi.mocked(mocks.mockSupabase.from).mock.results[0]?.value;
    expect(selectCall?.eq).toHaveBeenCalledWith("slug", "main-room");
    expect(selectCall?.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(selectCall?.neq).toHaveBeenCalledWith("id", "room-2");
  });

  it("calls the password RPC with handle plus slug", async () => {
    const result = await dataRoomService.checkDataRoomPassword(
      "sugar",
      "main-room",
      "secret",
    );

    expect(result).toBe(true);
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith(
      "check_data_room_password",
      {
        p_handle: "sugar",
        p_slug: "main-room",
        p_password: "secret",
      },
    );
  });

  it("calls the payload RPC with handle plus slug", async () => {
    const payload = await dataRoomService.getDataRoomPayload(
      "sugar",
      "main-room",
      "secret",
    );

    expect(payload).toEqual([]);
    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith(
      "get_data_room_payload",
      {
        p_handle: "sugar",
        p_slug: "main-room",
        p_password: "secret",
      },
    );
  });

  it("passes handle plus room slug when revalidating signed room assets", async () => {
    vi.mocked(mocks.mockSupabase.rpc).mockImplementationOnce(async () => ({
      data: [
        {
          id: "deck-1",
          title: "Main deck",
          slug: "seed",
          file_url: "https://example.com/storage/v1/object/public/decks/user-1/deck.pdf",
          pages: [
            {
              image_url: "https://example.com/storage/v1/object/public/decks/user-1/page-1.png",
            },
          ],
        },
      ],
      error: null,
    }));

    await dataRoomService.getDataRoomPayload("sugar", "main-room", "secret");

    expect(vi.mocked(mocks.mockSupabase.functions.invoke)).toHaveBeenCalledWith(
      "sign-deck-url",
      {
        body: {
          handle: "sugar",
          room_slug: "main-room",
          password: "secret",
          image_paths: ["user-1/deck.pdf", "user-1/page-1.png"],
        },
      },
    );
  });

  it("reorders room documents with one transactional RPC", async () => {
    await dataRoomService.reorderDocuments("room-1", ["deck-2", "deck-1"]);

    expect(vi.mocked(mocks.mockSupabase.rpc)).toHaveBeenCalledWith(
      "reorder_data_room_documents",
      {
        p_room_id: "room-1",
        p_ordered_deck_ids: ["deck-2", "deck-1"],
      },
    );
    expect(vi.mocked(mocks.mockSupabase.from)).not.toHaveBeenCalled();
  });
});
