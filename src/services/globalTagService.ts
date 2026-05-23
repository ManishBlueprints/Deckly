import { supabase } from "./supabase.ts";
import { LibraryTag } from "../types";

interface GlobalTagRow extends LibraryTag {
  user_id: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
}

interface GlobalTagAliasRow {
  tag_id: string;
  alias_type: string;
  alias_value: string;
}

const normalizeTagKey = (name: string): string => name.trim().toLowerCase();

const asGlobalTag = (tag: Record<string, unknown>): GlobalTagRow => ({
  id: String(tag.id),
  user_id: String(tag.user_id),
  name: String(tag.name),
  color: String(tag.color),
  created_at: String(tag.created_at),
  updated_at: tag.updated_at ? String(tag.updated_at) : null,
  deleted_at: tag.deleted_at ? String(tag.deleted_at) : null,
});

const addLegacyNameAlias = async (
  userId: string,
  tagId: string,
  aliasName: string,
): Promise<void> => {
  const aliasValue = normalizeTagKey(aliasName);
  if (!aliasValue) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("global_tag_aliases")
    .upsert(
      {
        user_id: userId,
        tag_id: tagId,
        alias_type: "legacy_name",
        alias_value: aliasValue,
        updated_at: now,
      },
      { onConflict: "user_id,alias_type,alias_value" },
    );

  if (error) throw error;
};

const getTagById = async (
  tagId: string,
): Promise<GlobalTagRow | null> => {
  const { data, error } = await supabase
    .from("global_tags")
    .select("*")
    .eq("id", tagId)
    .maybeSingle();

  if (error) throw error;
  return data ? asGlobalTag(data as Record<string, unknown>) : null;
};

const getAllUserTags = async (
  userId: string,
): Promise<GlobalTagRow[]> => {
  const { data, error } = await supabase
    .from("global_tags")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  return (data || []).map((tag) => asGlobalTag(tag as Record<string, unknown>));
};

const getAliasByTypeAndValue = async (
  userId: string,
  aliasType: GlobalTagAliasRow["alias_type"],
  aliasValue: string,
): Promise<GlobalTagAliasRow | null> => {
  const normalizedValue = aliasValue.trim().toLowerCase();
  if (!normalizedValue) return null;

  const { data, error } = await supabase
    .from("global_tag_aliases")
    .select("tag_id, alias_type, alias_value")
    .eq("user_id", userId)
    .eq("alias_type", aliasType)
    .eq("alias_value", normalizedValue)
    .maybeSingle();

  if (error) throw error;
  return (data as GlobalTagAliasRow | null) ?? null;
};

const getTagByName = async (
  userId: string,
  name: string,
): Promise<GlobalTagRow | null> => {
  const trimmedName = name.trim();
  const normalized = normalizeTagKey(trimmedName);
  if (!normalized) return null;

  const tags = await getAllUserTags(userId);
  const activeMatch = tags.find(
    (tag) =>
      tag.deleted_at === null &&
      normalizeTagKey(tag.name) === normalized,
  );
  if (activeMatch) return activeMatch;

  const deletedMatch = tags.find(
    (tag) =>
      tag.deleted_at !== null &&
      normalizeTagKey(tag.name) === normalized,
  );
  if (deletedMatch) return deletedMatch;

  const alias =
    (await getAliasByTypeAndValue(userId, "legacy_name", normalized)) ??
    (await getAliasByTypeAndValue(userId, "legacy_id", trimmedName));

  if (alias) {
    return getTagById(alias.tag_id);
  }

  return null;
};

const ensureUniqueTagName = async (
  userId: string,
  name: string,
  ignoreTagId?: string,
): Promise<void> => {
  const normalized = normalizeTagKey(name);
  if (!normalized) return;

  const resolved = await getTagByName(userId, normalized);
  const conflict = resolved && resolved.id !== ignoreTagId;

  if (conflict) {
    throw new Error("A tag with that name already exists.");
  }
};

const createOrRestoreTag = async (
  userId: string,
  name: string,
  color: string,
): Promise<LibraryTag> => {
  const normalizedName = name.trim();
  const existing = await getTagByName(userId, normalizedName);

  if (existing) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("global_tags")
      .update({
        color,
        deleted_at: null,
        updated_at: now,
      })
      .eq("id", existing.id);

    if (error) throw error;

    if (normalizeTagKey(existing.name) !== normalizeTagKey(normalizedName)) {
      await addLegacyNameAlias(userId, existing.id, existing.name);
    }

    return {
      ...existing,
      color,
      deleted_at: null,
      updated_at: now,
    };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("global_tags")
    .insert({
      user_id: userId,
      name: normalizedName,
      color,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) throw error || new Error("Failed to create tag");
  return asGlobalTag(data as Record<string, unknown>);
};

const updateTag = async (
  tagId: string,
  userId: string,
  name: string,
  color: string,
): Promise<LibraryTag> => {
  const existing = await getTagById(tagId);
  if (!existing || existing.user_id !== userId) {
    throw new Error("Tag not found.");
  }

  await ensureUniqueTagName(userId, name, tagId);

  const trimmedName = name.trim();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("global_tags")
    .update({
      name: trimmedName,
      color,
      deleted_at: null,
      updated_at: now,
    })
    .eq("id", tagId)
    .select("*")
    .single();

  if (error || !data) throw error || new Error("Failed to update tag");

  if (normalizeTagKey(existing.name) !== normalizeTagKey(trimmedName)) {
    await addLegacyNameAlias(userId, tagId, existing.name);
  }

  return asGlobalTag(data as Record<string, unknown>);
};

const deleteTag = async (tagId: string, userId: string): Promise<void> => {
  const existing = await getTagById(tagId);
  if (!existing || existing.user_id !== userId) {
    throw new Error("Tag not found.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("global_tags")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", tagId);

  if (error) throw error;
};

const fetchTagsByIds = async (
  tagIds: string[],
  userId?: string,
  includeDeleted = false,
): Promise<LibraryTag[]> => {
  const uniqueIds = Array.from(new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  let query = supabase
    .from("global_tags")
    .select("*")
    .in("id", uniqueIds);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map((tag) => asGlobalTag(tag as Record<string, unknown>));
};

export const globalTagService = {
  normalizeTagKey,
  getAllUserTags,
  getTagById,
  getTagByName,
  ensureUniqueTagName,
  createOrRestoreTag,
  updateTag,
  deleteTag,
  fetchTagsByIds,
};
