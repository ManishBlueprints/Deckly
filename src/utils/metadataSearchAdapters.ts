import type {
  DataRoomDocument,
  DataRoomDocumentSearchSummary,
  DataRoom,
  DeckWithAnalytics,
  MetadataSearchFilterState,
  SavedDataRoomOrganized,
  SavedDeckOrganized,
} from "../types";
import {
  matchesMetadataDateFilter,
  matchesMetadataNameQuery,
} from "./metadataSearch";

type SearchTagLike = {
  id: string;
  name: string;
  color: string;
};

export interface SavedDeckSearchResult {
  deck: SavedDeckOrganized;
  matchedTagNames: string[];
}

export interface SavedRoomSearchResult {
  room: SavedDataRoomOrganized;
  matchedTagNames: string[];
}

export interface DataRoomDocumentSearchResult {
  document: DataRoomDocument;
  matchedTagNames: string[];
}

export function filterContentLibraryDecks(
  decks: DeckWithAnalytics[],
  filter: MetadataSearchFilterState,
  selectedTagId: string | null = null,
) {
  return decks.filter((deck) => {
    const matchesTag =
      selectedTagId === null || (deck.tags ?? []).some((tag) => tag.id === selectedTagId);
    const matchesName =
      filter.mode !== "name" ||
      matchesMetadataNameQuery(deck.title, filter.query) ||
      (deck.tags ?? []).some((tag) => matchesMetadataNameQuery(tag.name, filter.query));
    const matchesDate =
      filter.mode !== "date" || matchesMetadataDateFilter(deck.created_at, filter.date);

    return matchesTag && matchesName && matchesDate;
  });
}

export function collectMatchingTagNames(
  tags: SearchTagLike[] | undefined,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return Array.from(
    new Set(
      (tags ?? [])
        .filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
        .map((tag) => tag.name),
    ),
  );
}

export function filterDataRoomDocuments(
  documents: DataRoomDocument[],
  filter: MetadataSearchFilterState,
  activeFolderId: string | null,
  selectedTagId: string | null = null,
) : DataRoomDocumentSearchResult[] {
  return documents.reduce<DataRoomDocumentSearchResult[]>((results, doc) => {
    const matchedTagNames =
      filter.mode === "name" ? collectMatchingTagNames(doc.tags, filter.query) : [];
    const matchesTag =
      selectedTagId === null || (doc.tags ?? []).some((tag) => tag.id === selectedTagId);
    const matchesName =
      filter.mode !== "name" ||
      matchesMetadataNameQuery(doc.deck?.title, filter.query) ||
      matchedTagNames.length > 0;
    const matchesDate =
      filter.mode !== "date" || matchesMetadataDateFilter(doc.added_at, filter.date);
    const matchesFolder = activeFolderId
      ? doc.folder_id === activeFolderId
      : !doc.folder_id;

    if (matchesTag && matchesName && matchesDate && matchesFolder) {
      results.push({ document: doc, matchedTagNames });
    }

    return results;
  }, []);
}

export function filterSavedDeckRows(
  decks: SavedDeckOrganized[],
  filter: MetadataSearchFilterState,
  selectedFolderId: string | "uncategorized",
  selectedTagId: string | null,
) : SavedDeckSearchResult[] {
  return decks.reduce<SavedDeckSearchResult[]>((results, deck) => {
    const matchesFolder =
      selectedFolderId === "uncategorized"
        ? deck.folder_id === null
        : deck.folder_id === selectedFolderId;
    const matchesTag =
      selectedTagId === null || deck.tags.some((tag) => tag.id === selectedTagId);
    const matchedTagNames =
      filter.mode === "name" ? collectMatchingTagNames(deck.tags, filter.query) : [];
    const matchesName =
      filter.mode !== "name" ||
      matchesMetadataNameQuery(deck.title, filter.query) ||
      matchedTagNames.length > 0;
    const matchesDate =
      filter.mode !== "date" || matchesMetadataDateFilter(deck.saved_at, filter.date);

    if (matchesFolder && matchesTag && matchesName && matchesDate) {
      results.push({ deck, matchedTagNames });
    }

    return results;
  }, []);
}

export function filterSavedRoomRows(
  rooms: SavedDataRoomOrganized[],
  filter: MetadataSearchFilterState,
  selectedFolderId: string | "uncategorized",
  selectedTagId: string | null = null,
) : SavedRoomSearchResult[] {
  return rooms.reduce<SavedRoomSearchResult[]>((results, room) => {
    const matchesFolder =
      selectedFolderId === "uncategorized"
        ? room.folder_id === null
        : room.folder_id === selectedFolderId;
    const matchesTag = selectedTagId === null;
    const matchedTagNames: string[] = [];
    const matchesName =
      filter.mode !== "name" ||
      matchesMetadataNameQuery(room.title, filter.query);
    const matchesDate =
      filter.mode !== "date" || matchesMetadataDateFilter(room.saved_at, filter.date);

    if (matchesFolder && matchesTag && matchesName && matchesDate) {
      results.push({ room, matchedTagNames });
    }

    return results;
  }, []);
}

export interface DataRoomOverviewRoom extends DataRoom {
  docCount?: number;
  visitors?: number;
}

export interface DataRoomOverviewSearchResult {
  room: DataRoomOverviewRoom;
  matchedDocumentTitles: string[];
  matchedTagNames: string[];
}

export function filterDataRoomOverviewRooms(
  rooms: DataRoomOverviewRoom[],
  documentsByRoomId: Record<string, DataRoomDocumentSearchSummary[]>,
  filter: MetadataSearchFilterState,
  selectedTagId: string | null = null,
) {
  return rooms.reduce<DataRoomOverviewSearchResult[]>((results, room) => {
    const roomDocuments = documentsByRoomId[room.id] || [];
    const matchedBySelectedTag = selectedTagId
      ? roomDocuments.filter((document) =>
          (document.tags ?? []).some((tag) => tag.id === selectedTagId),
        )
      : [];
    const matchedDocumentTitles =
      filter.mode === "name" && filter.query.trim()
        ? roomDocuments
            .filter((document) => {
              const matchedTagNames = collectMatchingTagNames(
                document.tags,
                filter.query,
              );
              return (
                matchesMetadataNameQuery(document.deck?.title, filter.query) ||
                matchedTagNames.length > 0
              );
            })
            .map((document) => document.deck?.title)
            .filter((title): title is string => Boolean(title))
        : selectedTagId
          ? matchedBySelectedTag
              .map((document) => document.deck?.title)
              .filter((title): title is string => Boolean(title))
        : [];
    const matchedTagNames =
      filter.mode === "name" && filter.query.trim()
        ? Array.from(
            new Set(
              roomDocuments.flatMap((document) =>
                collectMatchingTagNames(document.tags, filter.query),
              ),
            ),
          )
        : selectedTagId
          ? Array.from(
              new Set(
                matchedBySelectedTag.flatMap((document) =>
                  (document.tags ?? [])
                    .filter((tag) => tag.id === selectedTagId)
                    .map((tag) => tag.name),
                ),
              ),
            )
        : [];

    const matchesSearch =
      filter.mode !== "name" ||
      matchesMetadataNameQuery(room.name, filter.query) ||
      matchedDocumentTitles.length > 0 ||
      matchedTagNames.length > 0;
    const matchesTag =
      selectedTagId === null || matchedBySelectedTag.length > 0;
    const matchesDate =
      filter.mode === "date"
        ? matchesMetadataDateFilter(room.created_at, filter.date)
        : true;

    if (matchesSearch && matchesTag && matchesDate) {
      results.push({ room, matchedDocumentTitles, matchedTagNames });
    }

    return results;
  }, []);
}
