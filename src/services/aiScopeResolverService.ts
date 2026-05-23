import { getRequiredSessionUserId } from "./authSession.ts";
import { supabase } from "./supabase.ts";
import { withRetry } from "../utils/resilience.ts";
import {
  buildAiScopeResolution,
  type AiScopeDocumentRecord,
  type AiScopeReference,
  type AiScopeResolution,
} from "./aiScopeResolutionBuilder.ts";

export type {
  AiExcludedSource,
  AiIncludedSource,
  AiNoContentReason,
  AiScopeDescriptor,
  AiScopeDocumentRecord,
  AiScopeReference,
  AiScopeResolution,
  AiScopeResolutionMetadata,
  AiScopeType,
  AiSourceExclusionReason,
} from "./aiScopeResolutionBuilder.ts";
export { buildAiScopeResolution, createAiContentHash } from "./aiScopeResolutionBuilder.ts";

interface AiScopeResolverDependencies {
  getOwnedDeck: (deckId: string, userId: string) => Promise<AiScopeDocumentRecord | null>;
  getOwnedFolder: (
    folderId: string,
    userId: string,
  ) => Promise<{ id: string; data_room_id: string; name: string } | null>;
  getOwnedDataRoom: (
    roomId: string,
    userId: string,
  ) => Promise<{ id: string; name: string } | null>;
  getRoomDocuments: (roomId: string) => Promise<AiScopeDocumentRecord[]>;
}

export class AiScopeResolverServiceError extends Error {
  code: "SCOPE_NOT_FOUND" | "UNSUPPORTED_SCOPE_TYPE";

  constructor(
    code: "SCOPE_NOT_FOUND" | "UNSUPPORTED_SCOPE_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "AiScopeResolverServiceError";
    this.code = code;
  }
}


const defaultDependencies: AiScopeResolverDependencies = {
  async getOwnedDeck(deckId, userId) {
    const { data, error } = await supabase
      .from("decks")
      .select("*")
      .eq("id", deckId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return (data as AiScopeDocumentRecord | null) ?? null;
  },

  async getOwnedFolder(folderId, userId) {
    const { data, error } = await supabase
      .from("data_room_folders")
      .select("id, data_room_id, name, data_rooms!inner(id, user_id)")
      .eq("id", folderId)
      .eq("data_rooms.user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      data_room_id: String(data.data_room_id),
      name: String(data.name),
    };
  },

  async getOwnedDataRoom(roomId, userId) {
    const { data, error } = await supabase
      .from("data_rooms")
      .select("id, name")
      .eq("id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: String(data.id),
      name: String(data.name),
    };
  },

  async getRoomDocuments(roomId) {
    const { data, error } = await supabase
      .from("data_room_documents")
      .select(`
        id,
        deck_id,
        folder_id,
        display_order,
        deck:decks (
          id,
          title,
          file_type,
          file_url,
          pages,
          extracted_text,
          text_content,
          plain_text,
          markdown_content,
          transcript,
          ocr_text
        )
      `)
      .eq("data_room_id", roomId)
      .order("display_order", { ascending: true });

    if (error) throw error;

    return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
      const rawDeck = row.deck;
      const deck =
        rawDeck && typeof rawDeck === "object" && !Array.isArray(rawDeck)
          ? (rawDeck as Record<string, unknown>)
          : null;

      if (!deck) return [];

      return [
        {
          ...(deck as AiScopeDocumentRecord),
          id: String(row.id),
          deck_id: String(row.deck_id ?? deck.id ?? row.id),
          title: String(deck.title ?? "Untitled"),
          folder_id:
            row.folder_id === null || row.folder_id === undefined
              ? null
              : String(row.folder_id),
          display_order:
            typeof row.display_order === "number" ? row.display_order : null,
        },
      ];
    });
  },
};

export const createAiScopeResolverService = (
  dependencies: AiScopeResolverDependencies = defaultDependencies,
) => ({
  async resolveScope(
    reference: AiScopeReference,
    providedUserId?: string,
  ): Promise<AiScopeResolution> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId(providedUserId);

      if (reference.scope_type === "deck") {
        const deck = await dependencies.getOwnedDeck(reference.scope_id, userId);
        if (!deck) {
          throw new AiScopeResolverServiceError(
            "SCOPE_NOT_FOUND",
            "Deck scope not found.",
          );
        }

        return buildAiScopeResolution(
          {
            scope_type: "deck",
            scope_id: reference.scope_id,
            scope_label: deck.title,
          },
          [
            {
              ...deck,
              deck_id: deck.deck_id ?? deck.id,
              title: deck.title,
            },
          ],
        );
      }

      if (reference.scope_type === "folder") {
        const folder = await dependencies.getOwnedFolder(reference.scope_id, userId);
        if (!folder) {
          throw new AiScopeResolverServiceError(
            "SCOPE_NOT_FOUND",
            "Folder scope not found.",
          );
        }

        const roomDocuments = await dependencies.getRoomDocuments(folder.data_room_id);
        const folderDocuments = roomDocuments
          .filter((document) => document.folder_id === folder.id)
          .map((document) => ({
            ...document,
            folder_name: folder.name,
          }));

        return buildAiScopeResolution(
          {
            scope_type: "folder",
            scope_id: reference.scope_id,
            scope_label: folder.name,
          },
          folderDocuments,
        );
      }

      if (reference.scope_type === "data_room") {
        const room = await dependencies.getOwnedDataRoom(reference.scope_id, userId);
        if (!room) {
          throw new AiScopeResolverServiceError(
            "SCOPE_NOT_FOUND",
            "Data room scope not found.",
          );
        }

        const roomDocuments = await dependencies.getRoomDocuments(room.id);

        return buildAiScopeResolution(
          {
            scope_type: "data_room",
            scope_id: reference.scope_id,
            scope_label: room.name,
          },
          roomDocuments,
        );
      }

      throw new AiScopeResolverServiceError(
        "UNSUPPORTED_SCOPE_TYPE",
        `Unsupported AI scope type: ${reference.scope_type}`,
      );
    });
  },
});

export const aiScopeResolverService = createAiScopeResolverService();
