import { supabase } from "./supabase";
import { getRequiredSessionUserId } from "./authSession";
import { withRetry } from "../utils/resilience";
import {
  DataRoomFolder,
  DataRoomFolderWithTags,
  DataRoomTag,
} from "../types";
import { globalTagService } from "./globalTagService";
import {
  DEFAULT_FOLDER_COLOR,
  FolderColorKey,
  isFolderColorKey,
} from "../constants/folderColors";
import {
  MAX_FOLDER_NAME_LENGTH,
  MAX_TAG_NAME_LENGTH,
  MAX_TAGS_PER_FOLDER,
} from "../constants/folderValidation";

export type DataRoomFolderErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_ACCESS_DENIED"
  | "FOLDER_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "TAG_NOT_FOUND"
  | "INVALID_FOLDER_NAME"
  | "INVALID_TAG_NAME"
  | "INVALID_FOLDER_COLOR"
  | "DUPLICATE_FOLDER_NAME"
  | "DUPLICATE_TAG_NAME"
  | "FREE_FOLDER_LIMIT_REACHED"
  | "MAX_TAGS_PER_FOLDER"
  | "CROSS_ROOM_MOVE"
  | "INVALID_FOLDER_ORDER"
  | "FOLDER_DELETE_FAILED"
  | "INVALID_FOLDER_TAGS";

export class DataRoomFolderServiceError extends Error {
  code: DataRoomFolderErrorCode;

  constructor(code: DataRoomFolderErrorCode, message: string) {
    super(message);
    this.name = "DataRoomFolderServiceError";
    this.code = code;
  }
}

interface DataRoomRecord {
  id: string;
  user_id: string;
}

interface FolderTagLink {
  folder_id: string;
  tag_id: string;
}

const POSITION_WIDTH = 8;

export const normalizeFolderName = (name: string): string => name.trim();

export const normalizeTagName = (name: string): string => name.trim();

export const buildFolderPosition = (index: number): string =>
  String(index).padStart(POSITION_WIDTH, "0");

export const resolveFolderColor = (
  color?: string | null,
): FolderColorKey => {
  if (!color) return DEFAULT_FOLDER_COLOR;
  if (!isFolderColorKey(color)) {
    throw new DataRoomFolderServiceError(
      "INVALID_FOLDER_COLOR",
      "Please choose a valid folder color.",
    );
  }
  return color;
};

const normalizeTagIds = (tagIds?: string[]): string[] => {
  const deduped = Array.from(
    new Set((tagIds || []).map((tagId) => tagId.trim()).filter(Boolean)),
  );

  if (deduped.length > MAX_TAGS_PER_FOLDER) {
    throw new DataRoomFolderServiceError(
      "MAX_TAGS_PER_FOLDER",
      `A folder can have at most ${MAX_TAGS_PER_FOLDER} tags.`,
    );
  }

  return deduped;
};

const normalizeDocumentTagIds = (tagIds?: string[]): string[] =>
  Array.from(
    new Set((tagIds || []).map((tagId) => tagId.trim()).filter(Boolean)),
  );

const assertFolderName = (name: string): string => {
  const trimmed = normalizeFolderName(name);
  if (!trimmed) {
    throw new DataRoomFolderServiceError(
      "INVALID_FOLDER_NAME",
      "Folder name cannot be empty.",
    );
  }
  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) {
    throw new DataRoomFolderServiceError(
      "INVALID_FOLDER_NAME",
      `Folder name must be ${MAX_FOLDER_NAME_LENGTH} characters or less.`,
    );
  }
  return trimmed;
};

const assertTagName = (name: string): string => {
  const trimmed = normalizeTagName(name);
  if (!trimmed) {
    throw new DataRoomFolderServiceError(
      "INVALID_TAG_NAME",
      "Tag name cannot be empty.",
    );
  }
  if (trimmed.length > MAX_TAG_NAME_LENGTH) {
    throw new DataRoomFolderServiceError(
      "INVALID_TAG_NAME",
      `Tag name must be ${MAX_TAG_NAME_LENGTH} characters or less.`,
    );
  }
  return trimmed;
};

const asDataRoomFolder = (folder: Record<string, unknown>): DataRoomFolder => ({
  id: String(folder.id),
  data_room_id: String(folder.data_room_id),
  name: String(folder.name),
  color: String(folder.color),
  position: String(folder.position),
  created_by: String(folder.created_by),
  updated_by: folder.updated_by ? String(folder.updated_by) : null,
  created_at: String(folder.created_at),
  updated_at: String(folder.updated_at),
});

const asDataRoomTag = (tag: Record<string, unknown>): DataRoomTag => ({
  id: String(tag.id),
  name: String(tag.name),
  color: String(tag.color),
  deleted_at: tag.deleted_at ? String(tag.deleted_at) : null,
  created_at: tag.created_at ? String(tag.created_at) : "",
  updated_at: tag.updated_at ? String(tag.updated_at) : "",
});

const asDataRoomFolderWithTags = (
  folder: Record<string, unknown>,
): DataRoomFolderWithTags => ({
  ...asDataRoomFolder(folder),
  tags: Array.isArray(folder.tags)
    ? folder.tags.map((tag) => asDataRoomTag(tag as Record<string, unknown>))
    : [],
});

const toServiceError = (
  error: unknown,
  fallbackCode: DataRoomFolderErrorCode,
  fallbackMessage: string,
): DataRoomFolderServiceError => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  const errorCode =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";

  const isForeignKeyViolation =
    errorCode === "23503" ||
    message.includes("violates foreign key constraint") ||
    message.includes("still referenced") ||
    message.includes("depends on") ||
    message.includes("restrict");

  if (isForeignKeyViolation) {
    return new DataRoomFolderServiceError(
      "FOLDER_DELETE_FAILED",
      "Remove documents from this folder first.",
    );
  }

  if (message.includes("Free plans allow up to 1 folder per room.")) {
    return new DataRoomFolderServiceError(
      "FREE_FOLDER_LIMIT_REACHED",
      message,
    );
  }

  if (message.includes("The folder order does not match the current room folders.")) {
    return new DataRoomFolderServiceError(
      "INVALID_FOLDER_ORDER",
      message,
    );
  }

  if (message.includes("One or more tags were not found")) {
    return new DataRoomFolderServiceError("TAG_NOT_FOUND", message);
  }

  if (message.includes("A tag with that name already exists")) {
    return new DataRoomFolderServiceError("DUPLICATE_TAG_NAME", message);
  }

  if (message.includes("Tag not found.")) {
    return new DataRoomFolderServiceError("TAG_NOT_FOUND", message);
  }

  if (message.includes("folder with that name already exists")) {
    return new DataRoomFolderServiceError(
      "DUPLICATE_FOLDER_NAME",
      message,
    );
  }

  if (message.includes("Unauthorized")) {
    return new DataRoomFolderServiceError("ROOM_ACCESS_DENIED", message);
  }

  return new DataRoomFolderServiceError(fallbackCode, message);
};

const assertRoomOwnedByUser = async (
  roomId: string,
  userId: string,
): Promise<DataRoomRecord> => {
  const { data, error } = await supabase
    .from("data_rooms")
    .select("id, user_id")
    .eq("id", roomId)
    .single();

  if (error || !data) {
    throw new DataRoomFolderServiceError(
      "ROOM_NOT_FOUND",
      "Data room not found.",
    );
  }

  const room = data as DataRoomRecord;
  if (room.user_id !== userId) {
    throw new DataRoomFolderServiceError(
      "ROOM_ACCESS_DENIED",
      "You do not have permission to manage this data room.",
    );
  }

  return room;
};

const getFolderById = async (folderId: string): Promise<DataRoomFolder | null> => {
  const { data, error } = await supabase
    .from("data_room_folders")
    .select("*")
    .eq("id", folderId)
    .maybeSingle();

  if (error) throw error;
  return data ? asDataRoomFolder(data as Record<string, unknown>) : null;
};

const getFolderTagsByFolderIds = async (
  folderIds: string[],
): Promise<Map<string, DataRoomTag[]>> => {
  if (folderIds.length === 0) return new Map();

  const { data: linksData, error: linksError } = await supabase
    .from("data_room_folder_tags")
    .select("folder_id, tag_id")
    .in("folder_id", folderIds);

  if (linksError) throw linksError;

  const links = (linksData || []) as FolderTagLink[];
  const tagIds = [...new Set(links.map((link) => link.tag_id))];
  const tagsById = new Map<string, DataRoomTag>();

  if (tagIds.length > 0) {
    const tagsData = await globalTagService.fetchTagsByIds(tagIds);

    tagsData.forEach((tag) => {
      tagsById.set(tag.id, {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        deleted_at: tag.deleted_at,
        created_at: tag.created_at || "",
        updated_at: tag.updated_at || "",
      });
    });
  }

  const map = new Map<string, DataRoomTag[]>();
  links.forEach((link) => {
    const tag = tagsById.get(link.tag_id);
    if (!tag) return;
    const current = map.get(link.folder_id) || [];
    current.push(tag);
    map.set(link.folder_id, current);
  });

  return map;
};

const loadFolderWithTags = async (
  folderId: string,
): Promise<DataRoomFolderWithTags | null> => {
  const folder = await getFolderById(folderId);
  if (!folder) return null;

  const tagsMap = await getFolderTagsByFolderIds([folderId]);
  return {
    ...folder,
    tags: tagsMap.get(folderId) || [],
  };
};

const fetchRoomFolders = async (
  roomId: string,
): Promise<DataRoomFolder[]> => {
  const { data, error } = await supabase
    .from("data_room_folders")
    .select("*")
    .eq("data_room_id", roomId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data || []).map((folder) =>
    asDataRoomFolder(folder as Record<string, unknown>),
  );
};

const assertUniqueFolderName = (
  folders: DataRoomFolder[],
  nextName: string,
  folderIdToIgnore?: string,
): void => {
  const canonical = nextName.toLowerCase();
  const conflict = folders.find(
    (folder) =>
      folder.id !== folderIdToIgnore &&
      folder.name.trim().toLowerCase() === canonical,
  );

  if (conflict) {
    throw new DataRoomFolderServiceError(
      "DUPLICATE_FOLDER_NAME",
      "A folder with that name already exists in this room.",
    );
  }
};

const replaceFolderTags = async (
  folderId: string,
  tagIds: string[],
  options: { userId: string; roomId: string },
): Promise<DataRoomTag[]> => {
  const folder = await getFolderById(folderId);
  if (!folder || folder.data_room_id !== options.roomId) {
    throw new DataRoomFolderServiceError(
      "FOLDER_NOT_FOUND",
      "Folder not found.",
    );
  }

  const dedupedTagIds = normalizeDocumentTagIds(tagIds);
  if (dedupedTagIds.length === 0) {
    const { error } = await supabase
      .from("data_room_folder_tags")
      .delete()
      .eq("folder_id", folderId);
    if (error) throw error;
    return [];
  }

    const tagRows = await globalTagService.fetchTagsByIds(dedupedTagIds, options.userId, false);
  if (tagRows.length !== dedupedTagIds.length) {
    throw new DataRoomFolderServiceError(
      "TAG_NOT_FOUND",
      "One or more tags were not found.",
    );
  }

  const previousLinks = await supabase
    .from("data_room_folder_tags")
    .select("tag_id")
    .eq("folder_id", folderId);

  if (previousLinks.error) throw previousLinks.error;

  const { error: deleteError } = await supabase
    .from("data_room_folder_tags")
    .delete()
    .eq("folder_id", folderId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("data_room_folder_tags")
    .insert(
      dedupedTagIds.map((tagId) => ({
        folder_id: folderId,
        tag_id: tagId,
      })),
    );

  if (insertError) {
    if (previousLinks.data && previousLinks.data.length > 0) {
      await supabase.from("data_room_folder_tags").insert(
        (previousLinks.data as { tag_id: string }[]).map((link) => ({
          folder_id: folderId,
          tag_id: link.tag_id,
        })),
      );
    }
    throw insertError;
  }

  return tagRows;
};

const replaceDocumentTags = async (
  documentId: string,
  tagIds: string[],
  options: { userId: string; roomId: string },
): Promise<DataRoomTag[]> => {
  const { data: document, error: documentError } = await supabase
    .from("data_room_documents")
    .select("id, data_room_id")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) throw documentError;
  if (!document || document.data_room_id !== options.roomId) {
    throw new DataRoomFolderServiceError(
      "DOCUMENT_NOT_FOUND",
      "Document not found.",
    );
  }

  const dedupedTagIds = normalizeTagIds(tagIds);
  if (dedupedTagIds.length === 0) {
    const { error } = await supabase
      .from("data_room_document_tags")
      .delete()
      .eq("document_id", documentId);
    if (error) throw error;
    return [];
  }

  const tagRows = await globalTagService.fetchTagsByIds(dedupedTagIds, options.userId, false);
  if (tagRows.length !== dedupedTagIds.length) {
    throw new DataRoomFolderServiceError(
      "TAG_NOT_FOUND",
      "One or more tags were not found.",
    );
  }

  const previousLinks = await supabase
    .from("data_room_document_tags")
    .select("tag_id")
    .eq("document_id", documentId);

  if (previousLinks.error) throw previousLinks.error;

  const { error: deleteError } = await supabase
    .from("data_room_document_tags")
    .delete()
    .eq("document_id", documentId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("data_room_document_tags")
    .insert(
      dedupedTagIds.map((tagId) => ({
        document_id: documentId,
        tag_id: tagId,
      })),
    );

  if (insertError) {
    if (previousLinks.data && previousLinks.data.length > 0) {
      await supabase.from("data_room_document_tags").insert(
        (previousLinks.data as { tag_id: string }[]).map((link) => ({
          document_id: documentId,
          tag_id: link.tag_id,
        })),
      );
    }
    throw insertError;
  }

  return tagRows;
};

const loadRoomFolderWithTags = async (
  folderId: string,
): Promise<DataRoomFolderWithTags> => {
  const folder = await loadFolderWithTags(folderId);
  if (!folder) {
    throw new DataRoomFolderServiceError(
      "FOLDER_NOT_FOUND",
      "Folder not found.",
    );
  }
  return folder;
};

export const dataRoomFolderService = {
  async listFolders(roomId: string): Promise<DataRoomFolderWithTags[]> {
    return withRetry(async () => {
      const folders = await fetchRoomFolders(roomId);
      if (folders.length === 0) return [];

      const tagsMap = await getFolderTagsByFolderIds(folders.map((f) => f.id));
      return folders.map((folder) => ({
        ...folder,
        tags: tagsMap.get(folder.id) || [],
      }));
    });
  },

  async createFolder(
    roomId: string,
    input: { name: string; color?: string; tagIds?: string[] },
    providedUserId?: string,
  ): Promise<DataRoomFolderWithTags> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const name = assertFolderName(input.name);
    const color = resolveFolderColor(input.color);
    const tagIds = normalizeTagIds(input.tagIds);

    await assertRoomOwnedByUser(roomId, userId);

    const { data, error } = await supabase.rpc("create_data_room_folder", {
      p_room_id: roomId,
      p_name: name,
      p_color: color,
      p_tag_ids: tagIds,
    });

    if (error || !data) {
      throw toServiceError(
        error,
        "INVALID_FOLDER_NAME",
        "Failed to create folder",
      );
    }

    return asDataRoomFolderWithTags(data as Record<string, unknown>);
  },

  async updateFolder(
    folderId: string,
    input: { name: string; color?: string; tagIds?: string[] },
    providedUserId?: string,
  ): Promise<DataRoomFolderWithTags> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const folder = await getFolderById(folderId);
    if (!folder) {
      throw new DataRoomFolderServiceError(
        "FOLDER_NOT_FOUND",
        "Folder not found.",
      );
    }

    await assertRoomOwnedByUser(folder.data_room_id, userId);

    const name = assertFolderName(input.name);
    const color = input.color ? resolveFolderColor(input.color) : folder.color as FolderColorKey;
    const folders = await fetchRoomFolders(folder.data_room_id);
    assertUniqueFolderName(folders, name, folderId);

    const { error } = await supabase
      .from("data_room_folders")
      .update({
        name,
        color,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folderId);

    if (error) throw error;

    if (input.tagIds !== undefined) {
      const previousTags = await loadRoomFolderWithTags(folderId);
      try {
        await replaceFolderTags(folderId, input.tagIds, {
          roomId: folder.data_room_id,
          userId,
        });
      } catch (tagError) {
        await supabase
          .from("data_room_folders")
          .update({
            name: folder.name,
            color: folder.color,
            updated_by: folder.updated_by,
            updated_at: folder.updated_at,
          })
          .eq("id", folderId);

        if (previousTags.tags.length > 0) {
          await supabase.from("data_room_folder_tags").delete().eq("folder_id", folderId);
          await supabase.from("data_room_folder_tags").insert(
            previousTags.tags.map((tag) => ({
              folder_id: folderId,
              tag_id: tag.id,
            })),
          );
        }

        throw tagError;
      }
    }

    return loadRoomFolderWithTags(folderId);
  },

  async deleteFolder(
    folderId: string,
    providedUserId?: string,
  ): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const folder = await getFolderById(folderId);
    if (!folder) {
      throw new DataRoomFolderServiceError(
        "FOLDER_NOT_FOUND",
        "Folder not found.",
      );
    }

    await assertRoomOwnedByUser(folder.data_room_id, userId);

    const { error } = await supabase
      .from("data_room_folders")
      .delete()
      .eq("id", folderId);

    if (error) {
      throw toServiceError(
        error,
        "FOLDER_DELETE_FAILED",
        "Failed to delete folder.",
      );
    }
  },

  async reorderFolders(
    roomId: string,
    orderedFolderIds: string[],
    providedUserId?: string,
  ): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);
    await assertRoomOwnedByUser(roomId, userId);

    const folders = await fetchRoomFolders(roomId);
    const currentIds = folders.map((folder) => folder.id);
    const requestedIds = Array.from(new Set(orderedFolderIds.map((id) => id.trim()).filter(Boolean)));

    if (
      currentIds.length !== requestedIds.length ||
      currentIds.some((folderId) => !requestedIds.includes(folderId)) ||
      requestedIds.some((folderId) => !currentIds.includes(folderId))
    ) {
      throw new DataRoomFolderServiceError(
        "INVALID_FOLDER_ORDER",
        "The folder order does not match the current room folders.",
      );
    }

    const { error } = await supabase.rpc("reorder_data_room_folders", {
      p_room_id: roomId,
      p_ordered_folder_ids: requestedIds,
    });

    if (error) throw error;
  },

  async listTags(roomId: string): Promise<DataRoomTag[]> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();
      await assertRoomOwnedByUser(roomId, userId);

      const { data, error } = await supabase
        .from("global_tags")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []).map((tag) => asDataRoomTag(tag as Record<string, unknown>));
    });
  },

  async createTag(
    roomId: string,
    input: { name: string; color?: string },
    providedUserId?: string,
  ): Promise<DataRoomTag> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const name = assertTagName(input.name);
    const color = resolveFolderColor(input.color);

    await assertRoomOwnedByUser(roomId, userId);
    try {
      const tag = await globalTagService.createOrRestoreTag(userId, name, color);
      return asDataRoomTag(tag as unknown as Record<string, unknown>);
    } catch (error) {
      throw toServiceError(error, "INVALID_TAG_NAME", "Failed to create tag.");
    }
  },

  async updateTag(
    tagId: string,
    input: { name: string; color?: string },
    providedUserId?: string,
  ): Promise<DataRoomTag> {
    const userId = await getRequiredSessionUserId(providedUserId);

    const existing = await globalTagService.getTagById(tagId);

    if (!existing) {
      throw new DataRoomFolderServiceError(
        "TAG_NOT_FOUND",
        "Tag not found.",
      );
    }

    if (existing.user_id !== userId) {
      throw new DataRoomFolderServiceError(
        "ROOM_ACCESS_DENIED",
        "You do not have permission to manage this data room.",
      );
    }

    const name = assertTagName(input.name);
    const color = input.color ? resolveFolderColor(input.color) : (existing.color as FolderColorKey);
    try {
      const tag = await globalTagService.updateTag(tagId, userId, name, color);
      return asDataRoomTag(tag as unknown as Record<string, unknown>);
    } catch (error) {
      throw toServiceError(error, "INVALID_TAG_NAME", "Failed to update tag.");
    }
  },

  async deleteTag(tagId: string, providedUserId?: string): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);

    const existing = await globalTagService.getTagById(tagId);

    if (!existing) {
      throw new DataRoomFolderServiceError(
        "TAG_NOT_FOUND",
        "Tag not found.",
      );
    }

    if (existing.user_id !== userId) {
      throw new DataRoomFolderServiceError(
        "ROOM_ACCESS_DENIED",
        "You do not have permission to manage this data room.",
      );
    }

    try {
      await globalTagService.deleteTag(tagId, userId);
    } catch (error) {
      throw toServiceError(error, "TAG_NOT_FOUND", "Failed to delete tag.");
    }
  },

  async setFolderTags(
    folderId: string,
    tagIds: string[],
    providedUserId?: string,
  ): Promise<DataRoomTag[]> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const dedupedTagIds = normalizeTagIds(tagIds);
    const folder = await getFolderById(folderId);
    if (!folder) {
      throw new DataRoomFolderServiceError(
        "FOLDER_NOT_FOUND",
        "Folder not found.",
      );
    }

    await assertRoomOwnedByUser(folder.data_room_id, userId);
    return replaceFolderTags(folderId, dedupedTagIds, {
      userId,
      roomId: folder.data_room_id,
    });
  },

  async removeFolderTag(
    folderId: string,
    tagId: string,
    providedUserId?: string,
  ): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const folder = await getFolderById(folderId);
    if (!folder) {
      throw new DataRoomFolderServiceError(
        "FOLDER_NOT_FOUND",
        "Folder not found.",
      );
    }

    await assertRoomOwnedByUser(folder.data_room_id, userId);

    const { error } = await supabase
      .from("data_room_folder_tags")
      .delete()
      .eq("folder_id", folderId)
      .eq("tag_id", tagId);

    if (error) throw error;
  },

  async moveDocumentToFolder(
    documentId: string,
    folderId: string | null,
    providedUserId?: string,
  ): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);

    const { data: document, error: documentError } = await supabase
      .from("data_room_documents")
      .select("id, data_room_id")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!document) {
      throw new DataRoomFolderServiceError(
        "DOCUMENT_NOT_FOUND",
        "Document not found.",
      );
    }

    const doc = document as { id: string; data_room_id: string };
    await assertRoomOwnedByUser(doc.data_room_id, userId);

    if (folderId) {
      const folder = await getFolderById(folderId);
      if (!folder) {
        throw new DataRoomFolderServiceError(
          "FOLDER_NOT_FOUND",
          "Folder not found.",
        );
      }

      if (folder.data_room_id !== doc.data_room_id) {
        throw new DataRoomFolderServiceError(
          "CROSS_ROOM_MOVE",
          "Documents can only be moved within the same data room.",
        );
      }
    }

    const { error } = await supabase
      .from("data_room_documents")
      .update({ folder_id: folderId })
      .eq("id", documentId);

    if (error) throw error;
  },

  async bulkMoveDocumentsToFolder(
    documentIds: string[],
    folderId: string | null,
    providedUserId?: string,
  ): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const uniqueDocumentIds = Array.from(
      new Set(documentIds.map((documentId) => documentId.trim()).filter(Boolean)),
    );

    if (uniqueDocumentIds.length === 0) return;

    const { data: documents, error: documentError } = await supabase
      .from("data_room_documents")
      .select("id, data_room_id")
      .in("id", uniqueDocumentIds);

    if (documentError) throw documentError;

    if (!documents || documents.length !== uniqueDocumentIds.length) {
      throw new DataRoomFolderServiceError(
        "FOLDER_NOT_FOUND",
        "One or more documents were not found.",
      );
    }

    const roomIds = Array.from(
      new Set(
        (documents as { id: string; data_room_id: string }[]).map(
          (doc) => doc.data_room_id,
        ),
      ),
    );

    if (roomIds.length !== 1) {
      throw new DataRoomFolderServiceError(
        "CROSS_ROOM_MOVE",
        "Bulk moves must stay within one data room.",
      );
    }

    const roomId = roomIds[0];
    await assertRoomOwnedByUser(roomId, userId);

    if (folderId) {
      const folder = await getFolderById(folderId);
      if (!folder) {
        throw new DataRoomFolderServiceError(
          "FOLDER_NOT_FOUND",
          "Folder not found.",
        );
      }

      if (folder.data_room_id !== roomId) {
        throw new DataRoomFolderServiceError(
          "CROSS_ROOM_MOVE",
          "Documents can only be moved within the same data room.",
        );
      }
    }

    const { error } = await supabase
      .from("data_room_documents")
      .update({ folder_id: folderId })
      .in("id", uniqueDocumentIds);

    if (error) throw error;
  },

  async setDocumentTags(
    documentId: string,
    tagIds: string[],
    providedUserId?: string,
  ): Promise<DataRoomTag[]> {
    const userId = await getRequiredSessionUserId(providedUserId);
    const { data: document, error: documentError } = await supabase
      .from("data_room_documents")
      .select("id, data_room_id")
      .eq("id", documentId)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!document) {
      throw new DataRoomFolderServiceError(
        "DOCUMENT_NOT_FOUND",
        "Document not found.",
      );
    }

    const doc = document as { id: string; data_room_id: string };
    await assertRoomOwnedByUser(doc.data_room_id, userId);
    return replaceDocumentTags(documentId, tagIds, {
      userId,
      roomId: doc.data_room_id,
    });
  },
};
