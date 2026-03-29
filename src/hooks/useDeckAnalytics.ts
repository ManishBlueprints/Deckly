import { useState, useEffect, useRef, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import { Deck } from '../types';

/**
 * Custom hook for tracking deck analytics with debouncing.
 * Tracks page views, time spent, and deck completion.
 * 
 * Debounces Supabase sync calls to prevent API flooding when users rapidly navigate.
 */
export function useDeckAnalytics(
  deck: Deck | null,
  pageNumber: number,
  numPages: number,
  isOwner: boolean = false,
  dataRoomId?: string
) {
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
  const pageStartTime = useRef<number>(Date.now());
  
  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedPageRef = useRef<number | null>(null);

  // Effect to track the initial deck view
  useEffect(() => {
    if (deck && !isOwner) {
      analyticsService.trackDeckView(deck);
    }
  }, [deck, isOwner]);

  // Immediate sync function (used for final cleanup)
  const syncImmediate = useCallback((d: Deck, pageNum: number, time: number, drId?: string) => {
    analyticsService.syncSlideStats(d, pageNum, time, undefined, drId);
    lastSyncedPageRef.current = pageNum;
  }, []);

  // Debounced sync function (used during navigation)
  const syncDebounced = useCallback((d: Deck, pageNum: number, time: number, drId?: string) => {
    // Clear any pending sync
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only sync if this page hasn't been synced already
    if (lastSyncedPageRef.current === pageNum) {
      return;
    }

    // Debounce: wait 500ms before syncing
    debounceTimerRef.current = setTimeout(() => {
      analyticsService.syncSlideStats(d, pageNum, time, undefined, drId);
      lastSyncedPageRef.current = pageNum;
    }, 500);
  }, []);

  // Function to track time spent on the current page
  const trackCurrentPage = useCallback(() => {
    if (!pageNumber || !deck || isOwner) return;
    
    const timeSpent = Math.floor((Date.now() - pageStartTime.current) / 1000);
    
    // Always track page view in PostHog immediately (lightweight operation)
    analyticsService.trackPageView(deck, pageNumber, timeSpent);
    
    // Debounce the Supabase sync (heavier operation)
    syncDebounced(deck, pageNumber, timeSpent, dataRoomId);
    
    setViewedPages(prev => new Set(prev).add(pageNumber));
  }, [pageNumber, deck, isOwner, dataRoomId, syncDebounced]);

  // Effect to track page changes and reset the timer
  useEffect(() => {
    // Reset timer for the new page
    pageStartTime.current = Date.now();
    
    // Cleanup: flush pending data when page changes or component unmounts
    return () => {
      // Clear any pending debounced sync
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Immediately sync the current page on cleanup (no debounce for final sync)
      if (pageNumber && deck && !isOwner) {
        const timeSpent = Math.floor((Date.now() - pageStartTime.current) / 1000);
        syncImmediate(deck, pageNumber, timeSpent, dataRoomId);
      }
    };
  }, [pageNumber, deck, isOwner, dataRoomId, syncImmediate]);

  // Effect to check if the entire deck has been viewed
  useEffect(() => {
    if (deck && numPages && viewedPages.size === numPages) {
      analyticsService.trackDeckComplete(deck, numPages);
    }
  }, [viewedPages, numPages, deck]);

  return { trackCurrentPage };
}
