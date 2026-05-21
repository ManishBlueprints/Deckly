import { supabase } from "./supabase";
import { getRequiredSessionUserId, getSessionUserId } from "./authSession";
import { withRetry } from "../utils/resilience";
import { LibraryFolder, LibraryTag, SavedDeckOrganized } from "../types";
import { globalTagService } from "./globalTagService";
import {
  DEFAULT_FOLDER_COLOR,
  resolveFolderColorKey,
  type FolderColorKey,
} from "../constants/folderColors";

interface FolderJoinResult {
  id: string;
  name: string;
  color: string;
  created_at: string;
  library_folder_tags: { global_tags: LibraryTag }[];
  investor_library: { count: number }[];
}

/** Narrow type for the investor_library select used in getSavedDecksOrganized.
 *  The query does NOT select the `decks` column, so the full join type would be too wide. */
interface InvestorLibraryEntry {
  id: string;
  deck_id: string;
  folder_id: string | null;
  created_at: string;
  last_viewed_at: string | null;
}

type SavedDeckMeta = {
  id: string;
  title: string;
  slug: string;
  file_type?: string;
  status?: string;
  description?: string | null;
  user_id: string;
  user_handle?: string | null;
  tags?: LibraryTag[] | null;
};

const normalizeLibraryTag = (tag: LibraryTag | null | undefined): LibraryTag | null => {
  if (!tag) return null;

  return {
    ...tag,
    deleted_at: tag.deleted_at ?? null,
  };
};

const normalizeTagCollection = (
  rawTags: Array<LibraryTag | null | undefined> | null | undefined,
): LibraryTag[] => {
  return (rawTags || [])
    .map((tag) => normalizeLibraryTag(tag))
    .filter((tag): tag is LibraryTag => Boolean(tag && tag.deleted_at === null));
};

export const organizerService = {
  // --- FOLDERS ---

  async getFolders(optionalUserId?: string): Promise<LibraryFolder[]> {
    return withRetry(async () => {
      const uid = await getSessionUserId(optionalUserId);
      if (!uid) return [];

      const { data, error } = await supabase
        .from("library_folders")
        .select(`
          *,
          library_folder_tags (
            global_tags (*)
          ),
          investor_library (count)
        `)
        .eq("user_id", uid)
        .order("name");

      if (error) {
        console.warn(
          "Complex getFolders query failed, falling back to simple select:",
          error,
        );
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("library_folders")
          .select("*")
          .eq("user_id", uid)
          .order("name");

        if (fallbackError) throw fallbackError;

        return (fallbackData || []).map((f) => ({
          id: f.id,
          name: f.name,
          color: resolveFolderColorKey(f.color),
          created_at: f.created_at,
          deck_count: 0,
          tags: [],
        }));
      }

      return (data as FolderJoinResult[] || []).map((f) => ({
        id: f.id,
        name: f.name,
        color: resolveFolderColorKey(f.color),
        created_at: f.created_at,
        deck_count: f.investor_library?.[0]?.count || 0,
        tags: (f.library_folder_tags || [])
          .map((ft) => normalizeLibraryTag(ft.global_tags))
          .filter((tag): tag is LibraryTag => Boolean(tag && tag.deleted_at === null)),
      }));
    });
  },

  async createFolder(
    name: string,
    color: FolderColorKey = DEFAULT_FOLDER_COLOR,
    tagIds: string[] = [],
  ): Promise<LibraryFolder> {
    // Note: No withRetry here - this is a multi-step non-idempotent operation.
    // Retrying could create duplicate folders since there's no unique constraint on (user_id, name).
    const userId = await getRequiredSessionUserId();

    const { data: folderData, error: folderError } = await supabase
      .from("library_folders")
      .insert([{
        name,
        color,
        user_id: userId,
      }])
      .select()
      .single();

    let finalData = folderData;
    let finalError = folderError;

    // Fallback if 'color' column doesn't exist yet
    if (folderError && folderError.message?.includes("color")) {
      console.warn("Falling back to insert folder without color...");
      const { data: fbData, error: fbError } = await supabase
        .from("library_folders")
        .insert([{ name, user_id: userId }])
        .select()
        .single();
      finalData = fbData ? { ...fbData, color } : fbData;
      finalError = fbError;
    }

    if (finalError) throw finalError;

    const uniqueTagIds = Array.from(
      new Set(tagIds.map((id) => id.trim()).filter(Boolean)),
    );
    let createdTags: LibraryTag[] = [];

    try {
      createdTags = await globalTagService.fetchTagsByIds(
        uniqueTagIds,
        userId,
        false,
      );

      if (createdTags.length !== uniqueTagIds.length) {
        throw new Error("One or more tags were not found.");
      }

      for (const tagData of createdTags) {
        const { error: linkErr } = await supabase
          .from("library_folder_tags")
          .insert([{ folder_id: finalData.id, tag_id: tagData.id }]);

        if (linkErr) {
          console.error("Failed to link folder tag:", {
            folder_id: finalData.id,
            tag_id: tagData.id,
            error: linkErr,
          });
          throw linkErr;
        }
      }
    } catch (err) {
      console.error("Critical failure during folder creation process, rolling back:", err);
      // Cleanup the folder so we don't end up with partial/broken states
      if (finalData?.id) {
        try {
          await supabase.from("library_folders").delete().eq("id", finalData.id);
        } catch (cleanupErr) {
          console.error(`Cleanup failed for folder ${finalData.id}:`, cleanupErr);
        }
      }
      throw err;
    }

    return {
      ...finalData,
      tags: createdTags,
      deck_count: 0,
    };
  },

  async renameFolder(folderId: string, name: string): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("library_folders")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", folderId);

      if (error) throw error;
    });
  },

  async updateFolder(
    folderId: string,
    name: string,
    color: FolderColorKey = DEFAULT_FOLDER_COLOR,
    tagIds: string[] = [],
  ): Promise<LibraryFolder> {
    // Note: No withRetry here - this is a multi-step operation with compensating rollback.
    // The caller can handle network errors and retry if needed.
    const userId = await getRequiredSessionUserId();

    // 1. Fetch original folder data for potential rollback
    const { data: originalFolder, error: snapErr } = await supabase
      .from("library_folders")
      .select("name, color, created_at")
      .eq("id", folderId)
      .single();

    if (snapErr || !originalFolder) {
      throw snapErr || new Error("Failed to fetch folder snapshot for update");
    }

    const originalName = originalFolder.name;
    const originalColor = originalFolder.color;

    // 2. Update folder
    let updatedFolderData;
    const { data, error: folderError } = await supabase
      .from("library_folders")
      .update({
        name,
        color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", folderId)
      .select("created_at")
      .single();

    updatedFolderData = data;

    if (folderError && folderError.message?.includes("color")) {
      console.warn("Falling back to update folder without color...");
      const { data: fbData, error: fbError } = await supabase
        .from("library_folders")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", folderId)
        .select("created_at")
        .single();
      if (fbError) throw fbError;
      updatedFolderData = fbData;
    } else if (folderError) {
      throw folderError;
    }

    // 3. Delete existing tags linking then recreate (with rollback emulation)
    const { data: previousLinks, error: linkErr } = await supabase
      .from("library_folder_tags")
      .select("tag_id")
      .eq("folder_id", folderId);

    if (linkErr) throw linkErr;

    const { error: delErr } = await supabase
      .from("library_folder_tags")
      .delete()
      .eq("folder_id", folderId);

    if (delErr) throw delErr;

    const createdTags: LibraryTag[] = [];
    let updateFailed = false;
    let originalError: unknown = null;

    // 4. Link tags
    try {
      const resolvedTags = await globalTagService.fetchTagsByIds(tagIds, userId, false);
      if (resolvedTags.length !== Array.from(new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean))).length) {
        throw new Error("One or more tags were not found.");
      }

      if (resolvedTags.length > 0) {
        for (const tagData of resolvedTags) {
          const { error: insertErr } = await supabase
            .from("library_folder_tags")
            .insert([{ folder_id: folderId, tag_id: tagData.id }]);

          if (insertErr) {
            console.error("Failed to link folder tag:", {
              folder_id: folderId,
              tag_id: tagData.id,
              error: insertErr,
            });
            throw insertErr;
          }

          createdTags.push(tagData);
        }
      }
    } catch (err) {
      console.error(`Update failed during tag processing:`, err);
      updateFailed = true;
      originalError = err;
    }

    // 5. Rollback if process failed - restore BOTH tags AND folder row, cleanup orphans
    if (updateFailed) {
      try {
        // Wipe broken links
        await supabase
          .from("library_folder_tags")
          .delete()
          .eq("folder_id", folderId);

        // Restore original tag links
        if (previousLinks && previousLinks.length > 0) {
          await supabase
            .from("library_folder_tags")
            .insert(
              previousLinks.map((link) => ({
                folder_id: folderId,
                tag_id: link.tag_id,
              })),
            );
        }

        // Restore folder row to original state
        if (originalName !== undefined) {
          const rollbackPayload: {
            name: string;
            updated_at: string;
            color?: string;
          } = {
            name: originalName,
            updated_at: new Date().toISOString(),
          };

          if (originalColor !== undefined) {
            rollbackPayload.color = originalColor || DEFAULT_FOLDER_COLOR;
          }

          await supabase
            .from("library_folders")
            .update(rollbackPayload)
            .eq("id", folderId);
        }
      } catch (rollbackErr) {
        console.error(
          "Rollback failed - folder and tags may be in inconsistent state:",
          { folderId, rollbackErr },
        );
      }

      throw new Error(
        "Failed to update folder tags. Rolled back to previous state and cleaned up orphaned tags.",
        { cause: originalError },
      );
    }

    return {
      id: folderId,
      name,
      color,
      created_at: updatedFolderData?.created_at || new Date().toISOString(),
      tags: createdTags,
      deck_count: 0, // simplified
    };
  },

  async deleteFolder(folderId: string): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("library_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
    });
  },

  // --- TAGS ---

  async getTags(optionalUserId?: string): Promise<LibraryTag[]> {
    return withRetry(async () => {
      const uid = await getSessionUserId(optionalUserId);
      if (!uid) return [];

      const { data, error } = await supabase
        .from("global_tags")
        .select("*")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data || [];
    });
  },

  async createTag(name: string, color: string): Promise<LibraryTag> {
    // Uses upsert for idempotency - safe to retry since UNIQUE(user_id, name) constraint
    // prevents duplicates. On conflict, updates the existing tag's color.
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();

      const canonicalName = name.trim().toUpperCase();
      return globalTagService.createOrRestoreTag(userId, canonicalName, color);
    });
  },

  async updateTag(id: string, name: string, color: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();
      await globalTagService.updateTag(id, userId, name, color);
    });
  },

  async deleteTag(id: string): Promise<void> {
    return withRetry(async () => {
      const userId = await getRequiredSessionUserId();
      await globalTagService.deleteTag(id, userId);
    });
  },

  // --- ORGANIZATION ACTIONS ---

  async updateDeckFolder(
    libraryId: string,
    folderId: string | null,
  ): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("investor_library")
        .update({ folder_id: folderId })
        .eq("id", libraryId);

      if (error) throw error;
    });
  },

  async updateDeckTags(libraryId: string, tagIds: string[]): Promise<void> {
    return withRetry(async () => {
      const uid = await getRequiredSessionUserId();

      const ownedTags = await globalTagService.fetchTagsByIds(tagIds, uid, false);
      const ownedTagIds = ownedTags.map((tag) => tag.id);
      if (ownedTagIds.length !== Array.from(new Set(tagIds.map((tagId) => tagId.trim()).filter(Boolean))).length) {
        throw new Error("One or more tags were not found.");
      }

      const { data: libraryItem, error: libraryItemError } = await supabase
        .from("investor_library")
        .select("deck_id")
        .eq("id", libraryId)
        .eq("user_id", uid)
        .maybeSingle();

      if (libraryItemError) throw libraryItemError;
      if (!libraryItem?.deck_id) {
        throw new Error("Saved deck not found.");
      }

      const { error } = await supabase.rpc("reconcile_deck_tags", {
        p_deck_id: libraryItem.deck_id,
        p_user_id: uid,
        p_tag_ids: ownedTagIds,
      });

      if (error) throw error;
    });
  },

  // --- MAIN FETCH ---

  async getSavedDecksOrganized(
    optionalUserId?: string,
  ): Promise<SavedDeckOrganized[]> {
    return withRetry(async () => {
      const uid = await getSessionUserId(optionalUserId);
      if (!uid) return [];

      const { data, error } = await supabase
        .from("investor_library")
        .select(`
          id,
          deck_id,
          folder_id,
          created_at,
          last_viewed_at
        `)
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const deckIds = ((data as unknown as InvestorLibraryEntry[]) || []).map((item) =>
        item.deck_id
      );

      const deckMap = new Map<string, SavedDeckMeta>();
      const deckTagsMap = new Map<string, LibraryTag[]>();
      let notesMap: Record<string, string> = {};

      if (deckIds.length > 0) {
        const [
          { data: libraryDecks, error: libraryDecksError },
          { data: notesData, error: notesErr },
        ] = await Promise.all([
          supabase
            .rpc("get_library_deck_metadata", {
              p_deck_ids: deckIds,
            })
            .select("id, title, slug, file_type, status, description, user_id, user_handle, tags"),
          supabase
            .from("investor_notes")
            .select("deck_id, content")
            .eq("user_id", uid)
            .in("deck_id", deckIds),
        ]);

        if (libraryDecksError) throw libraryDecksError;
        if (notesErr) throw notesErr;

        ((Array.isArray(libraryDecks) ? libraryDecks : []) as SavedDeckMeta[]).forEach(
          (deck) => {
            deckMap.set(deck.id, deck as SavedDeckMeta);
            deckTagsMap.set(deck.id, normalizeTagCollection(deck.tags));
          },
        );

        notesMap = (notesData || []).reduce((acc, curr) => {
          acc[curr.deck_id] = curr.content;
          return acc;
        }, {} as Record<string, string>);
      }

      return ((data as unknown as InvestorLibraryEntry[]) || []).map((item) => {
        const deckData = deckMap.get(item.deck_id);
        const userHandle = deckData?.user_handle || "unknown";

        const rawStatus = deckData?.status;
        const mappedStatus = (rawStatus === "PENDING" || rawStatus === "CONVERTING" || rawStatus === "PROCESSED" || rawStatus === "DELETED") 
          ? rawStatus as "PENDING" | "CONVERTING" | "PROCESSED" | "DELETED"
          : "DELETED";

        return {
          library_id: item.id,
          deck_id: item.deck_id,
          user_id: deckData?.user_id || "",
          folder_id: item.folder_id,
          saved_at: item.created_at,
          last_viewed_at: item.last_viewed_at,
          updated_at: item.last_viewed_at || item.created_at,
          title: deckData?.title || "Deleted Document",
          slug: deckData?.slug || "",
          file_type: deckData?.file_type || "",
          status: mappedStatus,
          user_handle: userHandle || "unknown",
          description: deckData?.description || null,
          investor_note: notesMap[item.deck_id] || "",
          is_available: !!deckData,
          tags: deckTagsMap.get(item.deck_id) || [],
        };
      });
    });
  },
};
