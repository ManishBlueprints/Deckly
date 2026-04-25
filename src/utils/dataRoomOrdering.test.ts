import { describe, expect, it } from "vitest";
import { reorderDataRoomDocuments } from "./dataRoomOrdering";
import { DataRoomDocument } from "../types";

const makeDoc = (
  deck_id: string,
  display_order: number,
  folder_id: string | null,
): DataRoomDocument => ({
  id: `${deck_id}-doc`,
  data_room_id: "room-1",
  deck_id,
  folder_id,
  display_order,
  added_at: "2026-04-25T00:00:00.000Z",
});

describe("reorderDataRoomDocuments", () => {
  it("reorders only the visible subset without disturbing hidden documents", () => {
    const documents = [
      makeDoc("a", 0, null),
      makeDoc("b", 1, "folder-1"),
      makeDoc("c", 2, null),
      makeDoc("d", 3, "folder-1"),
    ];

    const reordered = reorderDataRoomDocuments(documents, ["d", "b"]);

    expect(reordered.map((doc) => doc.deck_id)).toEqual(["a", "d", "c", "b"]);
    expect(reordered.map((doc) => doc.display_order)).toEqual([0, 1, 2, 3]);
  });
});
