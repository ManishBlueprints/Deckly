import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataRoomFolderService } from "../services/dataRoomFolderService";
import { DataRoomFolderWithTags, DataRoomTag } from "../types";

const QUERY_CONFIG = {
  staleTime: 30000,
  gcTime: 300000,
} as const;

const KEYS = {
  folders: (roomId: string) => ["data-room-folders", roomId] as const,
  tags: (roomId: string) => ["data-room-tags", roomId] as const,
};

export function useDataRoomFolders(roomId?: string) {
  const queryClient = useQueryClient();
  const enabled = !!roomId;

  const foldersQuery = useQuery({
    queryKey: roomId ? KEYS.folders(roomId) : ["data-room-folders", "disabled"],
    queryFn: () => dataRoomFolderService.listFolders(roomId!),
    enabled,
    ...QUERY_CONFIG,
  });

  const tagsQuery = useQuery({
    queryKey: roomId ? KEYS.tags(roomId) : ["data-room-tags", "disabled"],
    queryFn: () => dataRoomFolderService.listTags(roomId!),
    enabled,
    ...QUERY_CONFIG,
  });

  const invalidateRoomData = async () => {
    if (!roomId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: KEYS.folders(roomId) }),
      queryClient.invalidateQueries({ queryKey: KEYS.tags(roomId) }),
    ]);
  };

  const createFolderMutation = useMutation({
    mutationFn: (input: {
      name: string;
      color?: string;
      tagIds?: string[];
    }) => dataRoomFolderService.createFolder(roomId!, input),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: (input: {
      folderId: string;
      name: string;
      color?: string;
      tagIds?: string[];
    }) =>
      dataRoomFolderService.updateFolder(
        input.folderId,
        {
          name: input.name,
          color: input.color,
          tagIds: input.tagIds,
        },
      ),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) =>
      dataRoomFolderService.deleteFolder(folderId),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const createTagMutation = useMutation({
    mutationFn: (input: { name: string; color?: string }) =>
      dataRoomFolderService.createTag(roomId!, input),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const updateTagMutation = useMutation({
    mutationFn: (input: { tagId: string; name: string; color?: string }) =>
      dataRoomFolderService.updateTag(input.tagId, {
        name: input.name,
        color: input.color,
      }),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: string) => dataRoomFolderService.deleteTag(tagId),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const setFolderTagsMutation = useMutation({
    mutationFn: (input: { folderId: string; tagIds: string[] }) =>
      dataRoomFolderService.setFolderTags(input.folderId, input.tagIds),
    onSuccess: async () => {
      await invalidateRoomData();
    },
  });

  const moveDocumentToFolderMutation = useMutation({
    mutationFn: (input: { documentId: string; folderId: string | null }) =>
      dataRoomFolderService.moveDocumentToFolder(
        input.documentId,
        input.folderId,
      ),
  });

  const bulkMoveDocumentsMutation = useMutation({
    mutationFn: (input: { documentIds: string[]; folderId: string | null }) =>
      dataRoomFolderService.bulkMoveDocumentsToFolder(
        input.documentIds,
        input.folderId,
      ),
  });

  const setDocumentTagsMutation = useMutation({
    mutationFn: (input: { documentId: string; tagIds: string[] }) =>
      dataRoomFolderService.setDocumentTags(input.documentId, input.tagIds),
  });

  return {
    folders: (foldersQuery.data ?? []) as DataRoomFolderWithTags[],
    tags: (tagsQuery.data ?? []) as DataRoomTag[],
    isLoading: foldersQuery.isLoading || tagsQuery.isLoading,
    isFetching: foldersQuery.isFetching || tagsQuery.isFetching,
    isError: foldersQuery.isError || tagsQuery.isError,
    actions: {
      createFolder: (name: string, color?: string, tagIds?: string[]) =>
        createFolderMutation.mutateAsync({ name, color, tagIds }),
      updateFolder: (
        folderId: string,
        name: string,
        color?: string,
        tagIds?: string[],
      ) =>
        updateFolderMutation.mutateAsync({
          folderId,
          name,
          color,
          tagIds,
        }),
      deleteFolder: (folderId: string) =>
        deleteFolderMutation.mutateAsync(folderId),
      createTag: (name: string, color?: string) =>
        createTagMutation.mutateAsync({ name, color }),
      updateTag: (tagId: string, name: string, color?: string) =>
        updateTagMutation.mutateAsync({ tagId, name, color }),
      deleteTag: (tagId: string) => deleteTagMutation.mutateAsync(tagId),
      setFolderTags: (folderId: string, tagIds: string[]) =>
        setFolderTagsMutation.mutateAsync({ folderId, tagIds }),
      moveDocumentToFolder: (documentId: string, folderId: string | null) =>
        moveDocumentToFolderMutation.mutateAsync({ documentId, folderId }),
      bulkMoveDocumentsToFolder: (
        documentIds: string[],
        folderId: string | null,
      ) => bulkMoveDocumentsMutation.mutateAsync({ documentIds, folderId }),
      setDocumentTags: (documentId: string, tagIds: string[]) =>
        setDocumentTagsMutation.mutateAsync({ documentId, tagIds }),
      refetch: async () => {
        await Promise.all([foldersQuery.refetch(), tagsQuery.refetch()]);
      },
    },
  };
}
