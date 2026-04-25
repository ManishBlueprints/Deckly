import type {
  DataRoomDocument,
  DeckWithAnalytics,
  MetadataSearchFilterState,
  SavedDataRoomOrganized,
  SavedDeckOrganized,
} from "../types";
import {
  matchesMetadataDateFilter,
  matchesMetadataNameQuery,
} from "./metadataSearch";

export function filterContentLibraryDecks(
  decks: DeckWithAnalytics[],
  filter: MetadataSearchFilterState,
) {
  return decks.filter((deck) => {
    const matchesName = matchesMetadataNameQuery(deck.title, filter.query);
    const matchesDate = matchesMetadataDateFilter(deck.created_at, filter.date);
    return matchesName && matchesDate;
  });
}

export function filterDataRoomDocuments(
  documents: DataRoomDocument[],
  filter: MetadataSearchFilterState,
  activeFolderId: string | null,
) {
  return documents.filter((doc) => {
    const matchesName = matchesMetadataNameQuery(doc.deck?.title, filter.query);
    const matchesDate = matchesMetadataDateFilter(doc.added_at, filter.date);
    const matchesFolder = activeFolderId
      ? doc.folder_id === activeFolderId
      : !doc.folder_id;

    return matchesName && matchesDate && matchesFolder;
  });
}

export function filterSavedDeckRows(
  decks: SavedDeckOrganized[],
  filter: MetadataSearchFilterState,
  selectedFolderId: string | "uncategorized",
  selectedTagId: string | null,
) {
  return decks.filter((deck) => {
    const matchesFolder =
      selectedFolderId === "uncategorized"
        ? deck.folder_id === null
        : deck.folder_id === selectedFolderId;
    const matchesTag =
      selectedTagId === null || deck.tags.some((tag) => tag.id === selectedTagId);
    const matchesName = matchesMetadataNameQuery(deck.title, filter.query);
    const matchesDate = matchesMetadataDateFilter(deck.saved_at, filter.date);

    return matchesFolder && matchesTag && matchesName && matchesDate;
  });
}

export function filterSavedRoomRows(
  rooms: SavedDataRoomOrganized[],
  filter: MetadataSearchFilterState,
  selectedFolderId: string | "uncategorized",
) {
  if (selectedFolderId === "uncategorized") {
    return [];
  }

  return rooms.filter((room) => {
    const matchesFolder = room.folder_id === selectedFolderId;
    const matchesName = matchesMetadataNameQuery(room.title, filter.query);
    const matchesDate = matchesMetadataDateFilter(room.saved_at, filter.date);
    return matchesFolder && matchesName && matchesDate;
  });
}
