import { supabase } from "./supabase";
import { getRequiredSessionUserId } from "./authSession";
import { withRetry } from "../utils/resilience";
import {
  DataRoomFolder,
  DataRoomFolderWithTags,
  DataRoomTag,
} from "../types";
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
  data_room_id: String(tag.data_room_id),
  name: String(tag.name),
  color: String(tag.color),
  created_at: String(tag.created_at),
  updated_at: String(tag.updated_at),
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

  if (message.includes("Free plans allow up to 1 folder per room.")) {
    return new DataRoomFolderServiceError(
      "FREE_FOLDER_LIMIT_REACHED",
      message,
    );
  }

  if (message.includes("already exists in this room")) {
    return new DataRoomFolderServiceError(
      "DUPLICATE_FOLDER_NAME",
      message,
    );
  }

  if (message.includes("The folder order does not match the current room folders.")) {
    return new DataRoomFolderServiceError(
      "INVALID_FOLDER_ORDER",
      message,
    );
  }

  if (message.includes("One or more tags were not found in this room.")) {
    return new DataRoomFolderServiceError("TAG_NOT_FOUND", message);
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
    const { data: tagsData, error: tagsError } = await supabase
      .from("data_room_tags")
      .select("*")
      .in("id", tagIds);

    if (tagsError) throw tagsError;

    (tagsData || []).forEach((tag) => {
      const parsedTag = asDataRoomTag(tag as Record<string, unknown>);
      tagsById.set(parsedTag.id, parsedTag);
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

const assertUniqueTagName = async (
  roomId: string,
  nextName: string,
  tagIdToIgnore?: string,
): Promise<void> => {
  const { data, error } = await supabase
    .from("data_room_tags")
    .select("id, name")
    .eq("data_room_id", roomId);

  if (error) throw error;

  const conflict = (data || []).find((tag) => {
    const row = tag as { id: string; name: string };
    return (
      row.id !== tagIdToIgnore &&
      row.name.trim().toLowerCase() === nextName.toLowerCase()
    );
  });

  if (conflict) {
    throw new DataRoomFolderServiceError(
      "DUPLICATE_TAG_NAME",
      "A tag with that name already exists in this room.",
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

  const { data: tagsData, error: tagsError } = await supabase
    .from("data_room_tags")
    .select("*")
    .eq("data_room_id", options.roomId)
    .in("id", dedupedTagIds);

  if (tagsError) throw tagsError;

  const tagRows = (tagsData || []).map((tag) =>
    asDataRoomTag(tag as Record<string, unknown>),
  );
  if (tagRows.length !== dedupedTagIds.length) {
    throw new DataRoomFolderServiceError(
      "TAG_NOT_FOUND",
      "One or more tags were not found in this room.",
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

  const { data: tagsData, error: tagsError } = await supabase
    .from("data_room_tags")
    .select("*")
    .eq("data_room_id", options.roomId)
    .in("id", dedupedTagIds);

  if (tagsError) throw tagsError;

  const tagRows = (tagsData || []).map((tag) =>
    asDataRoomTag(tag as Record<string, unknown>),
  );
  if (tagRows.length !== dedupedTagIds.length) {
    throw new DataRoomFolderServiceError(
      "TAG_NOT_FOUND",
      "One or more tags were not found in this room.",
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
        "INVALID_FOLDER_ORDER",
        "Failed to reorder folders",
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
      const { data, error } = await supabase
        .from("data_room_tags")
        .select("*")
        .eq("data_room_id", roomId)
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
    await assertUniqueTagName(roomId, name);

    const { data, error } = await supabase
      .from("data_room_tags")
      .insert({
        data_room_id: roomId,
        name,
        color,
      })
      .select()
      .single();

    if (error || !data) throw error || new Error("Failed to create tag");
    return asDataRoomTag(data as Record<string, unknown>);
  },

  async updateTag(
    tagId: string,
    input: { name: string; color?: string },
    providedUserId?: string,
  ): Promise<DataRoomTag> {
    const userId = await getRequiredSessionUserId(providedUserId);

    const { data: existing, error: fetchError } = await supabase
      .from("data_room_tags")
      .select("*")
      .eq("id", tagId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      throw new DataRoomFolderServiceError(
        "TAG_NOT_FOUND",
        "Tag not found.",
      );
    }

    const existingTag = asDataRoomTag(existing as Record<string, unknown>);
    await assertRoomOwnedByUser(existingTag.data_room_id, userId);

    const name = assertTagName(input.name);
    const color = input.color ? resolveFolderColor(input.color) : existingTag.color as FolderColorKey;
    await assertUniqueTagName(existingTag.data_room_id, name, tagId);

    const { data, error } = await supabase
      .from("data_room_tags")
      .update({
        name,
        color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tagId)
      .select()
      .single();

    if (error || !data) throw error || new Error("Failed to update tag");
    return asDataRoomTag(data as Record<string, unknown>);
  },

  async deleteTag(tagId: string, providedUserId?: string): Promise<void> {
    const userId = await getRequiredSessionUserId(providedUserId);

    const { data: existing, error: fetchError } = await supabase
      .from("data_room_tags")
      .select("*")
      .eq("id", tagId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      throw new DataRoomFolderServiceError(
        "TAG_NOT_FOUND",
        "Tag not found.",
      );
    }

    const tag = asDataRoomTag(existing as Record<string, unknown>);
    await assertRoomOwnedByUser(tag.data_room_id, userId);

    const { error } = await supabase
      .from("data_room_tags")
      .delete()
      .eq("id", tagId);

    if (error) throw error;
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
