import { supabase } from "./supabase";
import { withRetry } from "../utils/resilience";
import {
  LibraryFolder,
  LibraryTag,
  SavedDeckOrganized,
} from "../types";

interface FolderJoinResult {
  id: string;
  name: string;
  color: string;
  created_at: string;
  library_folder_tags: { library_tags: LibraryTag }[];
  investor_library: { count: number }[];
}

interface DeckJoinResult {
  id: string;
  deck_id: string;
  folder_id: string | null;
  saved_at: string;
  last_viewed_at: string | null;
  updated_at: string;
  investor_note: string | null;
  decks: {
    title: string;
    slug: string;
    file_type: string;
    status: string;
    description: string | null;
    profiles: { handle: string };
  } | null;
  library_deck_tags: { library_tags: LibraryTag }[];
}

export const organizerService = {
  // --- FOLDERS ---

  async getFolders(): Promise<LibraryFolder[]> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from("library_folders")
        .select(`
          *,
          library_folder_tags (
            library_tags (*)
          ),
          investor_library (count)
        `)
        .eq("user_id", session.user.id)
        .order("name");

      if (error) {
        console.warn("Complex getFolders query failed, falling back to simple select:", error);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("library_folders")
          .select("*")
          .eq("user_id", session.user.id)
          .order("name");

        if (fallbackError) throw fallbackError;

        return (fallbackData || []).map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color || '#54e98a',
          created_at: f.created_at,
          deck_count: 0,
          tags: [],
        }));
      }

      return (data as FolderJoinResult[] || []).map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color || '#54e98a',
        created_at: f.created_at,
        deck_count: f.investor_library?.[0]?.count || 0,
        tags: (f.library_folder_tags || []).map((ft) => ft.library_tags),
      }));
    });
  },

  async createFolder(name: string, color?: string, tagNames: string[] = []): Promise<LibraryFolder> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data: folderData, error: folderError } = await supabase
        .from("library_folders")
        .insert([{ 
          name, 
          color: color || '#54e98a', 
          user_id: session.user.id 
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
          .insert([{ name, user_id: session.user.id }])
          .select()
          .single();
        finalData = fbData;
        finalError = fbError;
      }

      if (finalError) throw finalError;

      const createdTags: LibraryTag[] = [];

      // Link tags
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          try {
            let { data: tagData } = await supabase
              .from("library_tags")
              .select("*")
              .eq("user_id", session.user.id)
              .ilike("name", tagName)
              .single();

            if (!tagData) {
              const { data: newTag, error: tagErr } = await supabase
                .from("library_tags")
                .insert([{ name: tagName.toUpperCase(), color: '#666666', user_id: session.user.id }])
                .select()
                .single();
              if (!tagErr && newTag) {
                tagData = newTag;
              }
            }

            if (tagData) {
              createdTags.push(tagData);
              // Link
              await supabase
                .from("library_folder_tags")
                .insert([{ folder_id: finalData.id, tag_id: tagData.id }]);
            }
          } catch (err) {
            console.error(`Failed to process tag ${tagName}:`, err);
          }
        }
      }

      return {
        ...finalData,
        tags: createdTags,
        deck_count: 0,
      };
    });
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

  async updateFolder(folderId: string, name: string, color?: string, tagNames: string[] = []): Promise<LibraryFolder> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { error: folderError } = await supabase
        .from("library_folders")
        .update({ 
          name, 
          color: color || '#54e98a',
          updated_at: new Date().toISOString()
        })
        .eq("id", folderId);

      if (folderError && folderError.message?.includes("color")) {
        console.warn("Falling back to update folder without color...");
        const { error: fbError } = await supabase
          .from("library_folders")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", folderId);
        if (fbError) throw fbError;
      } else if (folderError) {
        throw folderError;
      }

      // Delete existing tags linking then recreate
      await supabase
        .from("library_folder_tags")
        .delete()
        .eq("folder_id", folderId);

      const createdTags: LibraryTag[] = [];

      // Link tags
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          try {
            let { data: tagData } = await supabase
              .from("library_tags")
              .select("*")
              .eq("user_id", session.user.id)
              .ilike("name", tagName)
              .single();

            if (!tagData) {
              const { data: newTag, error: tagErr } = await supabase
                .from("library_tags")
                .insert([{ name: tagName.toUpperCase(), color: '#666666', user_id: session.user.id }])
                .select()
                .single();
              if (!tagErr && newTag) {
                tagData = newTag;
              }
            }

            if (tagData) {
              createdTags.push(tagData);
              await supabase
                .from("library_folder_tags")
                .insert([{ folder_id: folderId, tag_id: tagData.id }]);
            }
          } catch (err) {
            console.error(`Failed to process tag ${tagName}:`, err);
          }
        }
      }

      return {
        id: folderId,
        name,
        color: color || '#54e98a',
        created_at: new Date().toISOString(),
        tags: createdTags,
        deck_count: 0 // simplified
      };
    });
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

  async getTags(): Promise<LibraryTag[]> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from("library_tags")
        .select("*")
        .eq("user_id", session.user.id)
        .order("name");

      if (error) throw error;
      return data || [];
    });
  },

  async createTag(name: string, color: string): Promise<LibraryTag> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("library_tags")
        .insert([{ name, color, user_id: session.user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    });
  },

  async updateTag(id: string, name: string, color: string): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("library_tags")
        .update({ name, color })
        .eq("id", id);

      if (error) throw error;
    });
  },

  async deleteTag(id: string): Promise<void> {
    return withRetry(async () => {
      const { error } = await supabase
        .from("library_tags")
        .delete()
        .eq("id", id);

      if (error) throw error;
    });
  },

  // --- ORGANIZATION ACTIONS ---

  async updateDeckFolder(libraryId: string, folderId: string | null): Promise<void> {
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
      // 1. Get current tags
      const { data: currentTags, error: fetchError } = await supabase
        .from("library_deck_tags")
        .select("tag_id")
        .eq("library_id", libraryId);

      if (fetchError) throw fetchError;

      const currentTagIds = (currentTags || []).map((t) => t.tag_id);
      
      const toAdd = tagIds.filter(id => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter(id => !tagIds.includes(id));

      // 2. Remove tags
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("library_deck_tags")
          .delete()
          .eq("library_id", libraryId)
          .in("tag_id", toRemove);
        if (removeError) throw removeError;
      }

      // 3. Add tags
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("library_deck_tags")
          .insert(toAdd.map(tagId => ({ library_id: libraryId, tag_id: tagId })));
        if (addError) throw addError;
      }
    });
  },

  // --- MAIN FETCH ---

  async getSavedDecksOrganized(): Promise<SavedDeckOrganized[]> {
    return withRetry(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const { data, error } = await supabase
        .from("investor_library")
        .select(`
          id,
          deck_id,
          folder_id,
          saved_at,
          last_viewed_at,
          updated_at,
          investor_note,
          decks (
            title,
            slug,
            file_type,
            status,
            description,
            profiles (handle)
          ),
          library_deck_tags (
            library_tags (*)
          )
        `)
        .eq("user_id", session.user.id)
        .order("saved_at", { ascending: false });

      if (error) throw error;

      return (data as unknown as DeckJoinResult[] || []).map((item) => {
        const deckData = Array.isArray(item.decks) ? item.decks[0] : item.decks;
        const handleData = deckData?.profiles;
        const userHandle = Array.isArray(handleData)
          ? handleData[0]?.handle
          : (handleData as { handle: string })?.handle;

        return {
          library_id: item.id,
          deck_id: item.deck_id,
          folder_id: item.folder_id,
          saved_at: item.saved_at,
          last_viewed_at: item.last_viewed_at,
          updated_at: item.updated_at,
          title: deckData?.title || "Deleted Document",
          slug: deckData?.slug || "",
          file_type: deckData?.file_type || "",
          status: deckData?.status || "DELETED",
          user_handle: userHandle || "unknown",
          description: deckData?.description || null,
          investor_note: item.investor_note,
          is_available: !!deckData,
          tags: (item.library_deck_tags || []).map((dt) => dt.library_tags),
        };
      });
    });
  },
};
