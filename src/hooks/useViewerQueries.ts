import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { noteService } from "../services/noteService";

const viewerQueryKeys = {
    deckSaved: (deckId: string | undefined, userId: string | undefined) =>
        ["deck-saved", deckId, userId] as const,
    investorNotes: (deckId: string | undefined, userId: string | undefined) =>
        ["investor-notes", deckId, userId] as const,
};

export function useIsDeckSaved(
    deckId: string | undefined,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: viewerQueryKeys.deckSaved(deckId, userId),
        queryFn: () => deckService.isDeckSaved(deckId!),
        enabled: !!deckId && !!userId,
    });
}

export function useInvestorNotes(
    deckId: string | undefined,
    userId: string | undefined,
) {
    return useQuery({
        queryKey: viewerQueryKeys.investorNotes(deckId, userId),
        queryFn: () => noteService.getNote(deckId!),
        enabled: !!deckId && !!userId,
    });
}

export function useSaveToLibraryMutation(userId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ deckId, save }: { deckId: string; save: boolean }) => {
            if (!userId) {
                return Promise.reject(new Error("User must be authenticated to save decks"));
            }
            return save
                ? deckService.saveToLibrary(deckId)
                : deckService.removeFromLibrary(deckId);
        },
        onMutate: async ({ deckId, save }) => {
            // Bail early if userId is undefined to avoid invalid cache keys
            if (!userId) {
                return {};
            }

            const queryKey = viewerQueryKeys.deckSaved(deckId, userId);

            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey,
            });

            // Snapshot the previous value
            const previousSaved = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, save);

            return { previousSaved, savedUserId: userId };
        },
        onError: (_err, { deckId }, context) => {
            // Rollback on error (only if userId was valid)
            if (context?.savedUserId && context.previousSaved !== undefined) {
                queryClient.setQueryData(
                    viewerQueryKeys.deckSaved(deckId, context.savedUserId),
                    context.previousSaved,
                );
            }
        },
        onSettled: (_data, _err, { deckId }, context) => {
            // Always refetch after error or success to ensure sync (only if userId is valid)
            if (context?.savedUserId) {
                queryClient.invalidateQueries({
                    queryKey: viewerQueryKeys.deckSaved(deckId, context.savedUserId),
                });
                queryClient.invalidateQueries({
                    queryKey: ["user-total-stats", context.savedUserId],
                });
            }
        },
    });
}

export function useSaveNoteMutation(userId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (
            { deckId, content }: { deckId: string; content: string },
        ) => {
            if (!userId) {
                return Promise.reject(new Error("User must be authenticated to save notes"));
            }
            return noteService.saveNote(deckId, content);
        },
        onMutate: async ({ deckId, content }) => {
            if (!userId) return {};

            const queryKey = viewerQueryKeys.investorNotes(deckId, userId);

            await queryClient.cancelQueries({
                queryKey,
            });
            const previousNote = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, content);
            return { previousNote, savedUserId: userId };
        },
        onError: (_err, { deckId }, context) => {
            if (context?.savedUserId && context.previousNote !== undefined) {
                queryClient.setQueryData(
                    viewerQueryKeys.investorNotes(deckId, context.savedUserId),
                    context.previousNote,
                );
            }
        },
        onSettled: (_data, _err, { deckId }, context) => {
            if (context?.savedUserId) {
                queryClient.invalidateQueries({
                    queryKey: viewerQueryKeys.investorNotes(deckId, context.savedUserId),
                });
            }
        },
    });
}
