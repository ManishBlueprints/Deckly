import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { dataRoomService } from "../services/dataRoomService";

/**
 * Hook to check if a deck slug is available for the current user.
 * Uses debouncing to avoid excessive API calls.
 */
export function useCheckDeckSlug(slug: string, excludeId?: string) {
    const [debouncedSlug, setDebouncedSlug] = useState(slug);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSlug(slug);
        }, 500);
        return () => clearTimeout(handler);
    }, [slug]);

    return useQuery({
        queryKey: ["deck-slug-available", debouncedSlug, excludeId],
        queryFn: () => deckService.checkSlugAvailable(debouncedSlug, excludeId),
        enabled: !!debouncedSlug && debouncedSlug.length > 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to check if a data room slug is available for the current user.
 * Uses debouncing to avoid excessive API calls.
 */
export function useCheckDataRoomSlug(slug: string, excludeId?: string) {
    const [debouncedSlug, setDebouncedSlug] = useState(slug);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSlug(slug);
        }, 500);
        return () => clearTimeout(handler);
    }, [slug]);

    return useQuery({
        queryKey: ["room-slug-available", debouncedSlug, excludeId],
        queryFn: () =>
            dataRoomService.checkSlugAvailable(debouncedSlug, excludeId),
        enabled: !!debouncedSlug && debouncedSlug.length > 2,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
