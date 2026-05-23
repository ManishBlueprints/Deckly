/// <reference types="vitest/globals" />

import {
  buildAiScopeResolution,
  createAiScopeResolverService,
} from "./aiScopeResolverService";

vi.mock("./supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

describe("aiScopeResolverService", () => {
  it("keeps the content hash stable across ordering noise and unsupported-only changes", async () => {
    const baseDescriptor = {
      scope_type: "data_room" as const,
      scope_id: "room-1",
      scope_label: "Room 1",
    };

    const first = await buildAiScopeResolution(baseDescriptor, [
      {
        id: "doc-b",
        deck_id: "deck-b",
        title: "Later",
        file_type: "pptx",
        extracted_text: "  Revenue\n\nGrowth  ",
      },
      {
        id: "doc-a",
        deck_id: "deck-a",
        title: "Earlier",
        file_type: "pdf",
        pages: [
          { page_number: 2, text: "Second page" },
          { page_number: 1, text: "First page" },
        ],
      },
      {
        id: "doc-unsupported-1",
        deck_id: "deck-unsupported",
        title: "Spreadsheet Image",
        file_type: "png",
        extracted_text: "This should be ignored",
      },
    ]);

    const second = await buildAiScopeResolution(baseDescriptor, [
      {
        id: "doc-unsupported-2",
        deck_id: "deck-unsupported",
        title: "Renamed Unsupported Binary",
        file_type: "zip",
      },
      {
        id: "doc-a",
        deck_id: "deck-a",
        title: "Earlier",
        file_type: "pdf",
        pages: [
          { page_number: 1, text: "First page" },
          { page_number: 2, text: "Second page" },
        ],
      },
      {
        id: "doc-b",
        deck_id: "deck-b",
        title: "Later",
        file_type: "pptx",
        extracted_text: "Revenue\nGrowth",
      },
    ]);

    expect(first.content_hash).toBe(second.content_hash);
    expect(first.normalized_content).toBe(second.normalized_content);
  });

  it("marks mixed scopes as partial data while keeping only extractable text", async () => {
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
          title: "Supported",
          file_type: "pdf",
          pages: [{ page_number: 1, text: "ARR is growing" }],
          folder_id: "folder-1",
          folder_name: "Finance",
        },
        {
          id: "doc-2",
          deck_id: "deck-2",
          title: "Unsupported",
          file_type: "png",
          folder_id: "folder-1",
          folder_name: "Finance",
        },
      ],
    );

    expect(resolution.normalized_content).toBe("ARR is growing");
    expect(resolution.metadata.partial_data).toBe(true);
    expect(resolution.metadata.no_content).toBe(false);
    expect(resolution.metadata.included_sources).toBe(1);
    expect(resolution.metadata.excluded_sources).toBe(1);
    expect(resolution.excluded_sources[0]?.reason).toBe("unsupported_file_type");
  });

  it("emits durable no-content metadata for unsupported-only and missing-text scopes", async () => {
    const unsupportedOnly = await buildAiScopeResolution(
      {
        scope_type: "data_room",
        scope_id: "room-2",
        scope_label: "Empty Room",
      },
      [
        {
          id: "doc-1",
          deck_id: "deck-1",
          title: "Image",
          file_type: "png",
        },
      ],
    );

    const missingTextOnly = await buildAiScopeResolution(
      {
        scope_type: "deck",
        scope_id: "deck-2",
        scope_label: "Missing Text",
      },
      [
        {
          id: "deck-2",
          deck_id: "deck-2",
          title: "Missing Text",
          file_type: "pdf",
          pages: [{ page_number: 1, links: [] }],
        },
      ],
    );

    expect(unsupportedOnly.content_hash).toBeNull();
    expect(unsupportedOnly.metadata.no_content).toBe(true);
    expect(unsupportedOnly.metadata.no_content_reason).toBe("unsupported_files_only");
    expect(missingTextOnly.content_hash).toBeNull();
    expect(missingTextOnly.metadata.no_content).toBe(true);
    expect(missingTextOnly.metadata.no_content_reason).toBe("missing_text_only");
  });

  it("resolves folder and data room scopes through the shared service flow", async () => {
    const service = createAiScopeResolverService({
      getOwnedDeck: vi.fn(),
      getOwnedFolder: vi.fn(async () => ({
        id: "folder-1",
        data_room_id: "room-1",
        name: "Finance",
      })),
      getOwnedDataRoom: vi.fn(async () => ({
        id: "room-1",
        name: "Fundraise",
      })),
      getRoomDocuments: vi.fn(async () => [
        {
          id: "doc-1",
          deck_id: "deck-1",
          title: "Deck One",
          file_type: "pdf",
          folder_id: "folder-1",
          pages: [{ page_number: 1, text: "Alpha" }],
        },
        {
          id: "doc-2",
          deck_id: "deck-2",
          title: "Deck Two",
          file_type: "pdf",
          folder_id: null,
          pages: [{ page_number: 1, text: "Beta" }],
        },
      ]),
    });

    const folderResolution = await service.resolveScope(
      { scope_type: "folder", scope_id: "folder-1" },
      "user-1",
    );
    const roomResolution = await service.resolveScope(
      { scope_type: "data_room", scope_id: "room-1" },
      "user-1",
    );

    expect(folderResolution.scope_label).toBe("Finance");
    expect(folderResolution.included_sources).toHaveLength(1);
    expect(folderResolution.included_sources[0]?.normalized_text).toBe("Alpha");
    expect(roomResolution.scope_label).toBe("Fundraise");
    expect(roomResolution.included_sources).toHaveLength(2);
    expect(roomResolution.metadata.partial_data).toBe(false);
  });
});
