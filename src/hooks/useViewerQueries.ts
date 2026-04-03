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
        mutationFn: ({ deckId, save }: { deckId: string; save: boolean }) =>
            save
                ? deckService.saveToLibrary(deckId)
                : deckService.removeFromLibrary(deckId),
        onMutate: async ({ deckId, save }) => {
            const queryKey = viewerQueryKeys.deckSaved(deckId, userId);

            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey,
            });

            // Snapshot the previous value
            const previousSaved = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, save);

            return { previousSaved };
        },
        onError: (_err, { deckId }, context) => {
            // Rollback on error
            if (context?.previousSaved !== undefined) {
                queryClient.setQueryData(
                    viewerQueryKeys.deckSaved(deckId, userId),
                    context.previousSaved,
                );
            }
        },
        onSettled: (_data, _err, { deckId }) => {
            // Always refetch after error or success to ensure sync
            queryClient.invalidateQueries({
                queryKey: viewerQueryKeys.deckSaved(deckId, userId),
            });
            queryClient.invalidateQueries({
                queryKey: ["user-total-stats", userId],
            });
        },
    });
}

export function useSaveNoteMutation(userId: string | undefined) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (
            { deckId, content }: { deckId: string; content: string },
        ) => noteService.saveNote(deckId, content),
        onMutate: async ({ deckId, content }) => {
            const queryKey = viewerQueryKeys.investorNotes(deckId, userId);

            await queryClient.cancelQueries({
                queryKey,
            });
            const previousNote = queryClient.getQueryData(queryKey);
            queryClient.setQueryData(queryKey, content);
            return { previousNote };
        },
        onError: (_err, { deckId }, context) => {
            if (context?.previousNote !== undefined) {
                queryClient.setQueryData(
                    viewerQueryKeys.investorNotes(deckId, userId),
                    context.previousNote,
                );
            }
        },
        onSettled: (_data, _err, { deckId }) => {
            queryClient.invalidateQueries({
                queryKey: viewerQueryKeys.investorNotes(deckId, userId),
            });
        },
    });
}
