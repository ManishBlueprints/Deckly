/// <reference types="vitest/globals" />

import { dataRoomFolderService, buildFolderPosition, normalizeFolderName, normalizeTagName } from "./dataRoomFolderService";
import { userService } from "./userService";
import { DEFAULT_FOLDER_COLOR } from "../constants/folderColors";

const mocks = vi.hoisted(() => {
  type MockResponse = {
    data?: unknown;
    error?: unknown;
    count?: number;
  };

  type TableChain = {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
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
    const chain = {
      select: vi.fn(() => {
        mode = "select";
        return chain;
      }),
      insert: vi.fn(() => {
        mode = "insert";
        return chain;
      }),
      update: vi.fn(() => {
        mode = "update";
        return chain;
      }),
      delete: vi.fn(() => {
        mode = "delete";
        return chain;
      }),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(async () =>
        consumeResponse(`${table}.${mode}.maybeSingle`),
      ),
      single: vi.fn(async () => consumeResponse(`${table}.${mode}.single`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(
          resolve,
          reject,
        )) as TableChain["then"],
    } as TableChain;

    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createTableChain(table)),
    rpc: vi.fn((fn: string) => Promise.resolve(consumeResponse(`rpc.${fn}`))),
    auth: {
      getSession: vi.fn(),
    },
  };

  return {
    responseQueues,
    queueResponse,
    consumeResponse,
    mockSupabase,
  };
});

vi.mock("./supabase", () => ({
  supabase: mocks.mockSupabase,
}));

vi.mock("./userService", () => ({
  userService: {
    getProfile: vi.fn(),
  },
}));

const mockedGetProfile = vi.mocked(userService.getProfile);

describe("dataRoomFolderService", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
    mockedGetProfile.mockResolvedValue({ tier: "PRO" } as never);
  });

  it("normalizes folder and tag labels consistently", () => {
    expect(normalizeFolderName("  Finance  ")).toBe("Finance");
    expect(normalizeTagName("  Q1  ")).toBe("Q1");
    expect(buildFolderPosition(3)).toBe("00000003");
    expect(DEFAULT_FOLDER_COLOR).toBe("slate");
  });

  it("lists folders with attached tags in position order", async () => {
    mocks.queueResponse("data_room_folders.select", {
      data: [
        {
          id: "folder-1",
          data_room_id: "room-1",
          name: "Finance",
          color: "blue",
          position: "00000001",
          created_by: "user-1",
          updated_by: null,
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
        },
        {
          id: "folder-2",
          data_room_id: "room-1",
          name: "Legal",
          color: "emerald",
          position: "00000002",
          created_by: "user-1",
          updated_by: null,
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.queueResponse("data_room_folder_tags.select", {
      data: [
        { folder_id: "folder-1", tag_id: "tag-1" },
        { folder_id: "folder-2", tag_id: "tag-2" },
      ],
      error: null,
    });
    mocks.queueResponse("global_tags.select", {
      data: [
        {
          id: "tag-1",
          name: "Q1",
          color: "blue",
          user_id: "user-1",
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
          deleted_at: null,
        },
        {
          id: "tag-2",
          name: "Legal",
          color: "emerald",
          user_id: "user-1",
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      error: null,
    });

    const folders = await dataRoomFolderService.listFolders("room-1");

    expect(folders).toHaveLength(2);
    expect(folders[0].id).toBe("folder-1");
    expect(folders[0].tags[0].name).toBe("Q1");
    expect(folders[1].tags[0].name).toBe("Legal");
  });

  it("creates a folder with normalized data", async () => {
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("rpc.create_data_room_folder", {
      data: {
        id: "folder-1",
        data_room_id: "room-1",
        name: "Finance",
        color: "blue",
        position: "00000001",
        created_by: "user-1",
        updated_by: null,
        created_at: "2026-04-25T00:00:00.000Z",
        updated_at: "2026-04-25T00:00:00.000Z",
        tags: [],
      },
      error: null,
    });

    const folder = await dataRoomFolderService.createFolder(
      "room-1",
      { name: "  Finance  ", color: "blue" },
      "user-1",
    );

    expect(folder.name).toBe("Finance");
    expect(folder.color).toBe("blue");
    expect(folder.tags).toEqual([]);
  });

  it("rejects duplicate folder names in the same room", async () => {
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("rpc.create_data_room_folder", {
      data: null,
      error: new Error("A folder with that name already exists in this room."),
    });

    await expect(
      dataRoomFolderService.createFolder(
        "room-1",
        { name: "finance", color: "blue" },
        "user-1",
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_FOLDER_NAME" });
  });

  it("enforces the free plan folder limit", async () => {
    mockedGetProfile.mockResolvedValue({ tier: "FREE" } as never);
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("rpc.create_data_room_folder", {
      data: null,
      error: new Error("Free plans allow up to 1 folder per room."),
    });

    await expect(
      dataRoomFolderService.createFolder(
        "room-1",
        { name: "Finance", color: "blue" },
        "user-1",
      ),
    ).rejects.toMatchObject({ code: "FREE_FOLDER_LIMIT_REACHED" });
  });

  it("reorders folders through the atomic rpc path", async () => {
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("data_room_folders.select", {
      data: [
        {
          id: "folder-1",
          data_room_id: "room-1",
          name: "Finance",
          color: "blue",
          position: "00000001",
          created_by: "user-1",
          updated_by: null,
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
        },
        {
          id: "folder-2",
          data_room_id: "room-1",
          name: "Legal",
          color: "emerald",
          position: "00000002",
          created_by: "user-1",
          updated_by: null,
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.queueResponse("rpc.reorder_data_room_folders", {
      data: null,
      error: null,
    });

    await dataRoomFolderService.reorderFolders(
      "room-1",
      ["folder-2", "folder-1"],
      "user-1",
    );

    expect(mocks.mockSupabase.rpc).toHaveBeenCalledWith(
      "reorder_data_room_folders",
      {
        p_room_id: "room-1",
        p_ordered_folder_ids: ["folder-2", "folder-1"],
      },
    );
  });

  it("rejects cross-room document moves", async () => {
    mocks.queueResponse("data_room_documents.select.maybeSingle", {
      data: { id: "doc-1", data_room_id: "room-a" },
      error: null,
    });
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-a", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("data_room_folders.select.maybeSingle", {
      data: {
        id: "folder-b",
        data_room_id: "room-b",
        name: "Ops",
        color: "emerald",
        position: "00000001",
        created_by: "user-1",
        updated_by: null,
        created_at: "2026-04-25T00:00:00.000Z",
        updated_at: "2026-04-25T00:00:00.000Z",
      },
      error: null,
    });

    await expect(
      dataRoomFolderService.moveDocumentToFolder(
        "doc-1",
        "folder-b",
        "user-1",
      ),
    ).rejects.toMatchObject({ code: "CROSS_ROOM_MOVE" });
  });

  it("enforces the maximum folder tag count before touching the database", async () => {
    mocks.queueResponse("data_room_folders.select.maybeSingle", {
      data: {
        id: "folder-1",
        data_room_id: "room-1",
        name: "Finance",
        color: "blue",
        position: "00000001",
        created_by: "user-1",
        updated_by: null,
        created_at: "2026-04-25T00:00:00.000Z",
        updated_at: "2026-04-25T00:00:00.000Z",
      },
      error: null,
    });
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });

    await expect(
      dataRoomFolderService.setFolderTags(
        "folder-1",
        ["tag-1", "tag-2", "tag-3", "tag-4", "tag-5"],
        "user-1",
      ),
    ).rejects.toMatchObject({ code: "MAX_TAGS_PER_FOLDER" });
  });

  it("reconciles room document tags against the linked deck", async () => {
    mocks.queueResponse("data_room_documents.select.maybeSingle", [
      {
        data: { id: "doc-1", data_room_id: "room-1", deck_id: "deck-1" },
        error: null,
      },
      {
        data: { id: "doc-1", data_room_id: "room-1", deck_id: "deck-1" },
        error: null,
      },
    ]);
    mocks.queueResponse("data_rooms.select.single", {
      data: { id: "room-1", user_id: "user-1" },
      error: null,
    });
    mocks.queueResponse("global_tags.select", {
      data: [
        {
          id: "tag-1",
          name: "Legal",
          color: "emerald",
          user_id: "user-1",
          created_at: "2026-04-25T00:00:00.000Z",
          updated_at: "2026-04-25T00:00:00.000Z",
          deleted_at: null,
        },
      ],
      error: null,
    });
    mocks.queueResponse("rpc.reconcile_deck_tags", {
      data: null,
      error: null,
    });

    const tags = await dataRoomFolderService.setDocumentTags(
      "doc-1",
      ["tag-1"],
      "user-1",
    );

    expect(tags).toHaveLength(1);
    expect(mocks.mockSupabase.rpc).toHaveBeenCalledWith(
      "reconcile_deck_tags",
      {
        p_deck_id: "deck-1",
        p_user_id: "user-1",
        p_tag_ids: ["tag-1"],
      },
    );
  });
});
