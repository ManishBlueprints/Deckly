import { describe, expect, it } from "vitest";
import type {
  DataRoomDocument,
  DeckWithAnalytics,
  MetadataSearchFilterState,
  SavedDataRoomOrganized,
  SavedDeckOrganized,
} from "../types";
import {
  filterDataRoomOverviewRooms,
  filterContentLibraryDecks,
  filterDataRoomDocuments,
  filterSavedDeckRows,
  filterSavedRoomRows,
} from "./metadataSearchAdapters";
import {
  createDefaultMetadataSearchFilter,
  getMetadataDateWindow,
  matchesMetadataDateFilter,
} from "./metadataSearch";

function makeContentDeck(overrides: Partial<DeckWithAnalytics>): DeckWithAnalytics {
  return {
    id: "deck-1",
    title: "Alpha Deck",
    slug: "alpha-deck",
    file_url: "https://example.com/alpha.pdf",
    status: "PROCESSED",
    user_id: "user-1",
    display_order: 0,
    pages: [],
    created_at: "2026-04-20T00:00:00.000Z",
    total_views: 0,
    save_count: 0,
    last_viewed_at: null,
    ...overrides,
  };
}

function makeRoomDocument(overrides: Partial<DataRoomDocument>): DataRoomDocument {
  return {
    id: "doc-1",
    data_room_id: "room-1",
    deck_id: "deck-1",
    folder_id: null,
    display_order: 0,
    added_at: "2026-04-24T00:00:00.000Z",
    deck: {
      id: "deck-1",
      title: "Alpha Deck",
      slug: "alpha-deck",
      file_url: "https://example.com/alpha.pdf",
      status: "PROCESSED",
      user_id: "user-1",
      display_order: 0,
      pages: [],
      created_at: "2026-04-20T00:00:00.000Z",
    },
    ...overrides,
  };
}

function makeSavedDeck(overrides: Partial<SavedDeckOrganized>): SavedDeckOrganized {
  return {
    library_id: "library-1",
    deck_id: "deck-1",
    folder_id: null,
    tags: [],
    saved_at: "2026-04-25T00:00:00.000Z",
    last_viewed_at: null,
    title: "Alpha Saved Deck",
    slug: "alpha-saved-deck",
    status: "PROCESSED",
    user_handle: "founder",
    description: null,
    investor_note: null,
    is_available: true,
    updated_at: "2026-04-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeSavedRoom(overrides: Partial<SavedDataRoomOrganized>): SavedDataRoomOrganized {
  return {
    library_id: "room-library-1",
    data_room_id: "room-1",
    folder_id: "folder-1",
    tags: [],
    saved_at: "2026-04-25T00:00:00.000Z",
    last_viewed_at: null,
    title: "Alpha Room",
    slug: "alpha-room",
    room_handle: "founder",
    room_owner_handle: "founder",
    room_owner_id: "user-1",
    description: null,
    investor_note: null,
    is_available: true,
    is_deleted: false,
    expires_at: null,
    require_email: false,
    require_password: false,
    updated_at: "2026-04-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeOverviewRoom(overrides: Partial<Parameters<typeof filterDataRoomOverviewRooms>[0][number]>) {
  return {
    id: "room-1",
    user_id: "user-1",
    name: "Alpha Room",
    slug: "alpha-room",
    created_at: "2026-04-25T00:00:00.000Z",
    updated_at: "2026-04-25T00:00:00.000Z",
    docCount: 2,
    visitors: 1,
    ...overrides,
  };
}

describe("metadataSearch", () => {
  it("builds the expected rolling date windows", () => {
    const now = new Date("2026-04-26T12:00:00.000Z");

    const today = getMetadataDateWindow(
      { preset: "today", startDate: "", endDate: "" },
      now,
    );
    const last7 = getMetadataDateWindow(
      { preset: "last_7_days", startDate: "", endDate: "" },
      now,
    );

    expect(today?.start.getFullYear()).toBe(2026);
    expect(today?.start.getMonth()).toBe(3);
    expect(today?.start.getDate()).toBe(26);
    expect(last7?.start.getFullYear()).toBe(2026);
    expect(last7?.start.getMonth()).toBe(3);
    expect(last7?.start.getDate()).toBe(20);
    expect(last7?.end.getFullYear()).toBe(2026);
    expect(last7?.end.getMonth()).toBe(3);
    expect(last7?.end.getDate()).toBe(26);
  });

  it("treats incomplete custom ranges as inactive", () => {
    expect(
      matchesMetadataDateFilter("2026-04-25T00:00:00.000Z", {
        preset: "custom",
        startDate: "2026-04-20",
        endDate: "",
      }),
    ).toBe(true);
  });

  it("filters content library decks by title and created_at", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("content_library"),
      query: "alpha",
      date: { preset: "last_7_days", startDate: "", endDate: "" },
    };

    const results = filterContentLibraryDecks(
      [
        makeContentDeck({ id: "1", title: "Alpha Deck", created_at: "2026-04-24T00:00:00.000Z" }),
        makeContentDeck({ id: "2", title: "Beta Deck", created_at: "2026-04-10T00:00:00.000Z" }),
      ],
      filter,
    );

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Alpha Deck");
  });

  it("filters data room documents by folder, title, and added_at", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("data_room"),
      query: "alpha",
      date: { preset: "last_7_days", startDate: "", endDate: "" },
    };

    const results = filterDataRoomDocuments(
      [
        makeRoomDocument({ id: "1", folder_id: "folder-1", added_at: "2026-04-24T00:00:00.000Z" }),
        makeRoomDocument({ id: "2", folder_id: null, deck: { ...makeRoomDocument({}).deck!, title: "Beta Deck" } }),
      ],
      filter,
      "folder-1",
    );

    expect(results).toHaveLength(1);
    expect(results[0].document.id).toBe("1");
  });

  it("filters saved decks with folder/tag constraints preserved", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("saved_decks"),
      query: "alpha",
    };

    const results = filterSavedDeckRows(
      [
        makeSavedDeck({ library_id: "1", title: "Alpha Saved Deck", folder_id: null }),
        makeSavedDeck({ library_id: "2", title: "Beta Saved Deck", folder_id: null }),
      ],
      filter,
      "uncategorized",
      null,
    );

    expect(results).toHaveLength(1);
    expect(results[0].deck.library_id).toBe("1");
  });

  it("filters saved rooms by selected folder and saved_at", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("saved_decks"),
      query: "alpha",
      date: { preset: "last_30_days", startDate: "", endDate: "" },
    };

    const results = filterSavedRoomRows(
      [
        makeSavedRoom({ library_id: "1", title: "Alpha Room", folder_id: "folder-1" }),
        makeSavedRoom({ library_id: "2", title: "Beta Room", folder_id: "folder-2" }),
      ],
      filter,
      "folder-1",
    );

    expect(results).toHaveLength(1);
    expect(results[0].room.library_id).toBe("1");
  });

  it("matches data rooms by room name on the overview page", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("data_room"),
      query: "alpha",
    };

    const results = filterDataRoomOverviewRooms(
      [makeOverviewRoom({ id: "1", name: "Alpha Room" }), makeOverviewRoom({ id: "2", name: "Beta Room" })],
      {},
      filter,
    );

    expect(results).toHaveLength(1);
    expect(results[0].room.id).toBe("1");
    expect(results[0].matchedDocumentTitles).toEqual([]);
    expect(results[0].matchedTagNames).toEqual([]);
  });

  it("matches data rooms by document title and returns matched file names", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("data_room"),
      query: "budget",
    };

    const results = filterDataRoomOverviewRooms(
      [makeOverviewRoom({ id: "room-1", name: "Finance Room" })],
      {
        "room-1": [
          makeRoomDocument({ id: "doc-1", deck: { ...makeRoomDocument({}).deck!, title: "Budget FY26" } }),
          makeRoomDocument({ id: "doc-2", deck: { ...makeRoomDocument({}).deck!, title: "Roadmap" } }),
        ],
      },
      filter,
    );

    expect(results).toHaveLength(1);
    expect(results[0].room.name).toBe("Finance Room");
    expect(results[0].matchedDocumentTitles).toEqual(["Budget FY26"]);
    expect(results[0].matchedTagNames).toEqual([]);
  });

  it("matches saved decks by tag names as well as title", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("saved_decks"),
      query: "saas",
    };

    const results = filterSavedDeckRows(
      [
        makeSavedDeck({
          library_id: "1",
          title: "Alpha Saved Deck",
          tags: [{ id: "tag-1", name: "SaaS", color: "#54e98a" }],
        }),
        makeSavedDeck({ library_id: "2", title: "Beta Saved Deck" }),
      ],
      filter,
      "uncategorized",
      null,
    );

    expect(results).toHaveLength(1);
    expect(results[0].deck.library_id).toBe("1");
    expect(results[0].matchedTagNames).toEqual(["SaaS"]);
  });

  it("matches data room documents by tag names and surfaces the match", () => {
    const filter: MetadataSearchFilterState = {
      ...createDefaultMetadataSearchFilter("data_room"),
      query: "legal",
    };

    const results = filterDataRoomDocuments(
      [
        makeRoomDocument({
          id: "1",
          tags: [
            {
              id: "tag-1",
              data_room_id: "room-1",
              name: "Legal",
              color: "#54e98a",
              created_at: "2026-04-24T00:00:00.000Z",
              updated_at: "2026-04-24T00:00:00.000Z",
            },
          ],
        }),
      ],
      filter,
      null,
    );

    expect(results).toHaveLength(1);
    expect(results[0].document.id).toBe("1");
    expect(results[0].matchedTagNames).toEqual(["Legal"]);
  });
});
