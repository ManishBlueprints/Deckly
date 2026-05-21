import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataRoomLibraryService } from "../services/dataRoomLibraryService";
import { roomNoteService } from "../services/roomNoteService";
import { DataRoom } from "../types";

const viewerQueryKeys = {
  roomSaved: (dataRoomId: string | undefined, userId: string | undefined) =>
    ["data-room-saved", dataRoomId, userId] as const,
  roomNotes: (dataRoomId: string | undefined, userId: string | undefined) =>
    ["data-room-notes", dataRoomId, userId] as const,
};

export function useIsDataRoomSaved(
  dataRoomId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: viewerQueryKeys.roomSaved(dataRoomId, userId),
    queryFn: () => dataRoomLibraryService.isDataRoomSaved(dataRoomId!),
    enabled: !!dataRoomId && !!userId,
  });
}

export function useDataRoomNotes(
  dataRoomId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: viewerQueryKeys.roomNotes(dataRoomId, userId),
    queryFn: () => roomNoteService.getNote(dataRoomId!),
    enabled: !!dataRoomId && !!userId,
  });
}

export function useSaveDataRoomToLibraryMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dataRoomId,
      save,
      roomSnapshot,
      ownerHandle,
    }: {
      dataRoomId: string;
      save: boolean;
      roomSnapshot?: DataRoom;
      ownerHandle?: string;
    }) => {
      if (!userId) {
        return Promise.reject(new Error("User must be authenticated to save rooms"));
      }
      return save
        ? dataRoomLibraryService.saveToLibrary(dataRoomId, roomSnapshot, ownerHandle)
        : dataRoomLibraryService.removeFromLibrary(dataRoomId);
    },
    onMutate: async ({ dataRoomId, save }) => {
      if (!userId) return {};

      const queryKey = viewerQueryKeys.roomSaved(dataRoomId, userId);
      await queryClient.cancelQueries({ queryKey });
      const previousSaved = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, save);
      return { previousSaved, savedUserId: userId };
    },
    onError: (_err, { dataRoomId }, context) => {
      if (context?.savedUserId && context.previousSaved !== undefined) {
        queryClient.setQueryData(
          viewerQueryKeys.roomSaved(dataRoomId, context.savedUserId),
          context.previousSaved,
        );
      }
    },
    onSettled: (_data, _err, { dataRoomId }, context) => {
      if (context?.savedUserId) {
        queryClient.invalidateQueries({
          queryKey: viewerQueryKeys.roomSaved(dataRoomId, context.savedUserId),
        });
        queryClient.invalidateQueries({
          queryKey: ["saved-data-rooms", context.savedUserId],
        });
      }
    },
  });
}

export function useSaveDataRoomNoteMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      dataRoomId,
      content,
    }: {
      dataRoomId: string;
      content: string;
    }) => {
      if (!userId) {
        return Promise.reject(new Error("User must be authenticated to save notes"));
      }
      return roomNoteService.saveNote(dataRoomId, content);
    },
    onMutate: async ({ dataRoomId, content }) => {
      if (!userId) return {};

      const queryKey = viewerQueryKeys.roomNotes(dataRoomId, userId);
      await queryClient.cancelQueries({ queryKey });
      const previousNote = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, content);
      return { previousNote, savedUserId: userId };
    },
    onError: (_err, { dataRoomId }, context) => {
      if (context?.savedUserId && context.previousNote !== undefined) {
        queryClient.setQueryData(
          viewerQueryKeys.roomNotes(dataRoomId, context.savedUserId),
          context.previousNote,
        );
      }
    },
    onSettled: (_data, _err, { dataRoomId }, context) => {
      if (context?.savedUserId) {
        queryClient.invalidateQueries({
          queryKey: viewerQueryKeys.roomNotes(dataRoomId, context.savedUserId),
        });
      }
    },
  });
}

export const dataRoomViewerQueryKeys = viewerQueryKeys;
