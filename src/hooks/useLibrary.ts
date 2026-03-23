import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { organizerService } from "../services/organizerService";
import { LibraryFolder, LibraryTag, SavedDeckOrganized } from "../types";

// Query keys
const KEYS = {
  decks: (uid: string) => ["library-decks", uid],
  folders: (uid: string) => ["library-folders", uid],
  tags: (uid: string) => ["library-tags", uid],
};

// Stale times — data is fresh for 30s, served from cache instantly on navigation
const STALE_TIME = 30_000;

export function useLibrary(userId: string | undefined) {
  const qc = useQueryClient();

  // ---- Queries ----
  const decksQ = useQuery({
    queryKey: userId ? KEYS.decks(userId) : ["library-decks-noop"],
    queryFn: () => organizerService.getSavedDecksOrganized(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  const foldersQ = useQuery({
    queryKey: userId ? KEYS.folders(userId) : ["library-folders-noop"],
    queryFn: () => organizerService.getFolders(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  const tagsQ = useQuery({
    queryKey: userId ? KEYS.tags(userId) : ["library-tags-noop"],
    queryFn: () => organizerService.getTags(userId!),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });

  const decks: SavedDeckOrganized[] = decksQ.data ?? [];
  const folders: LibraryFolder[] = foldersQ.data ?? [];
  const tags: LibraryTag[] = tagsQ.data ?? [];
  const isLoading =
    (decksQ.isLoading || foldersQ.isLoading || tagsQ.isLoading) &&
    decks.length === 0 &&
    folders.length === 0 &&
    tags.length === 0;

  const refetch = useCallback(() => {
    if (!userId) return Promise.resolve();
    return Promise.all([
      qc.invalidateQueries({ queryKey: KEYS.decks(userId) }),
      qc.invalidateQueries({ queryKey: KEYS.folders(userId) }),
      qc.invalidateQueries({ queryKey: KEYS.tags(userId) }),
    ]).then(() => undefined);
  }, [qc, userId]);

  // ---- Deck mutations ----
  const unsaveMutation = useMutation({
    mutationFn: (deckId: string) => deckService.removeFromLibrary(deckId),
    onSuccess: (_data, deckId) => {
      if (!userId) return;
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) => (prev ?? []).filter((d) => d.deck_id !== deckId),
      );
    },
  });

  const moveMutation = useMutation({
    mutationFn: (
      { libraryId, folderId }: { libraryId: string; folderId: string | null },
    ) => organizerService.updateDeckFolder(libraryId, folderId),
    onSuccess: (_data, { libraryId, folderId }) => {
      if (!userId) return;
      // Find the deck's current folder before patching
      const currentDecks =
        qc.getQueryData<SavedDeckOrganized[]>(KEYS.decks(userId)) ?? [];
      const movedDeck = currentDecks.find((d) => d.library_id === libraryId);
      const oldFolderId = movedDeck?.folder_id ?? null;

      // 1. Update deck's folder_id in the decks cache
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) =>
          (prev ?? []).map((
            d,
          ) => (d.library_id === libraryId
            ? { ...d, folder_id: folderId }
            : d)
          ),
      );

      // 2. Update deck_count on folders in the folders cache
      qc.setQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
        (prev) =>
          (prev ?? []).map((f) => {
            if (f.id === oldFolderId && oldFolderId !== null) {
              return { ...f, deck_count: Math.max(0, f.deck_count - 1) };
            }
            if (f.id === folderId && folderId !== null) {
              return { ...f, deck_count: f.deck_count + 1 };
            }
            return f;
          }),
      );
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: (
      { libraryId, tagIds }: { libraryId: string; tagIds: string[] },
    ) => organizerService.updateDeckTags(libraryId, tagIds),
    onSuccess: (_data, { libraryId, tagIds }) => {
      if (!userId) return;
      const cachedTags = qc.getQueryData<LibraryTag[]>(KEYS.tags(userId));
      if (!cachedTags) return;

      const newTags = cachedTags.filter((t) => tagIds.includes(t.id));
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) =>
          (prev ?? []).map((
            d,
          ) => (d.library_id === libraryId ? { ...d, tags: newTags } : d)),
      );
    },
  });

  // ---- Folder mutations ----
  const createFolderMutation = useMutation({
    mutationFn: (
      { name, color, tagNames }: {
        name: string;
        color: string;
        tagNames: string[];
      },
    ) => organizerService.createFolder(name, color, tagNames),
    onSuccess: (newFolder) => {
      if (!userId) return;
      qc.setQueryData<LibraryFolder[]>(KEYS.folders(userId), (prev) => [
        ...(prev ?? []),
        newFolder,
      ]);
      // Tags may have been created — invalidate
      qc.invalidateQueries({ queryKey: KEYS.tags(userId) });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: ({
      folder,
      name,
      color,
      tagNames,
    }: {
      folder: LibraryFolder;
      name: string;
      color: string;
      tagNames: string[];
    }) => organizerService.updateFolder(folder.id, name, color, tagNames),
    onSuccess: (updated, { folder }) => {
      if (!userId) return;
      qc.setQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
        (prev) =>
          (prev ?? []).map((f) =>
            f.id === folder.id
              ? {
                ...f,
                name: updated.name,
                color: updated.color,
                tags: updated.tags,
              }
              : f
          ),
      );
      qc.invalidateQueries({ queryKey: KEYS.tags(userId) });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folder: LibraryFolder) =>
      organizerService.deleteFolder(folder.id),
    onSuccess: (_data, folder) => {
      if (!userId) return;
      qc.setQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
        (prev) => (prev ?? []).filter((f) => f.id !== folder.id),
      );
      // Move decks in this folder back to uncategorized in local cache
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) =>
          (prev ?? []).map((
            d,
          ) => (d.folder_id === folder.id ? { ...d, folder_id: null } : d)),
      );
    },
  });

  // ---- Tag mutations ----
  const createTagMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      organizerService.createTag(name, color),
    onSuccess: (newTag) => {
      if (!userId) return;
      qc.setQueryData<LibraryTag[]>(
        KEYS.tags(userId),
        (prev) => [...(prev ?? []), newTag],
      );
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: (
      { id, name, color }: { id: string; name: string; color: string },
    ) => organizerService.updateTag(id, name, color),
    onMutate: ({ id, name, color }) => {
      if (!userId) return;
      // Snapshot all three caches for rollback
      const prevTags = qc.getQueryData<LibraryTag[]>(KEYS.tags(userId));
      const prevFolders = qc.getQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
      );
      const prevDecks = qc.getQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
      );

      // Optimistic update all three caches simultaneously
      const patchTag = (
        t: LibraryTag,
      ) => (t.id === id ? { ...t, name, color } : t);
      qc.setQueryData<LibraryTag[]>(
        KEYS.tags(userId),
        (prev) => (prev ?? []).map(patchTag),
      );
      qc.setQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
        (prev) =>
          (prev ?? []).map((f) => ({ ...f, tags: f.tags.map(patchTag) })),
      );
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) =>
          (prev ?? []).map((d) => ({
            ...d,
            tags: (d.tags ?? []).map(patchTag),
          })),
      );

      return { prevTags, prevFolders, prevDecks };
    },
    onError: (_err, _vars, context) => {
      if (!userId || !context) return;
      // Roll back all three caches to their pre-mutation state
      qc.setQueryData(KEYS.tags(userId), context.prevTags);
      qc.setQueryData(KEYS.folders(userId), context.prevFolders);
      qc.setQueryData(KEYS.decks(userId), context.prevDecks);
    },
    onSettled: () => {
      if (!userId) return;
      // Ensure eventual consistency with the server
      qc.invalidateQueries({ queryKey: KEYS.tags(userId) });
      qc.invalidateQueries({ queryKey: KEYS.folders(userId) });
      qc.invalidateQueries({ queryKey: KEYS.decks(userId) });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: string) => organizerService.deleteTag(id),
    onSuccess: (_data, id) => {
      if (!userId) return;
      qc.setQueryData<LibraryTag[]>(
        KEYS.tags(userId),
        (prev) => (prev ?? []).filter((t) => t.id !== id),
      );
      qc.setQueryData<LibraryFolder[]>(
        KEYS.folders(userId),
        (prev) =>
          (prev ?? []).map((f) => ({
            ...f,
            tags: f.tags.filter((t) => t.id !== id),
          })),
      );
      qc.setQueryData<SavedDeckOrganized[]>(
        KEYS.decks(userId),
        (prev) =>
          (prev ?? []).map((d) => ({
            ...d,
            tags: (d.tags ?? []).filter((t) => t.id !== id),
          })),
      );
    },
  });

  // ---- Stable action wrappers ----
  const actions = {
    refetch,
    unsaveDeck: (deckId: string) => unsaveMutation.mutateAsync(deckId),
    moveDeck: (libraryId: string, folderId: string | null) =>
      moveMutation.mutateAsync({ libraryId, folderId }),
    updateDeckTags: (libraryId: string, tagIds: string[]) =>
      updateTagsMutation.mutateAsync({ libraryId, tagIds }),
    createFolder: (name: string, color: string, tagNames: string[]) =>
      createFolderMutation.mutateAsync({ name, color, tagNames }),
    updateFolder: (
      folder: LibraryFolder,
      name: string,
      color: string,
      tagNames: string[],
    ) => updateFolderMutation.mutateAsync({ folder, name, color, tagNames }),
    deleteFolder: (folder: LibraryFolder) =>
      deleteFolderMutation.mutateAsync(folder),
    createTag: (name: string, color: string) =>
      createTagMutation.mutateAsync({ name, color }),
    updateTag: (id: string, name: string, color: string) =>
      updateTagMutation.mutateAsync({ id, name, color }),
    deleteTag: (id: string) => deleteTagMutation.mutateAsync(id),
  };

  return { decks, folders, tags, isLoading, actions };
}
