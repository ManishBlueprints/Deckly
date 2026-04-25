import { DataRoomDocument } from "../types";

export function reorderDataRoomDocuments(
  documents: DataRoomDocument[],
  orderedVisibleDeckIds: string[],
): DataRoomDocument[] {
  const orderedDocuments = [...documents].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const reorderedVisibleDocuments = orderedVisibleDeckIds
    .map((deckId) =>
      orderedDocuments.find((doc) => doc.deck_id === deckId),
    )
    .filter((doc): doc is DataRoomDocument => doc !== undefined);
  const visibleIds = new Set(orderedVisibleDeckIds);

  let visibleIndex = 0;
  return orderedDocuments.map((doc, index) => {
    if (!visibleIds.has(doc.deck_id)) {
      return { ...doc, display_order: index };
    }

    const nextVisibleDoc = reorderedVisibleDocuments[visibleIndex++] ?? doc;

    return {
      ...nextVisibleDoc,
      display_order: index,
    };
  });
}
