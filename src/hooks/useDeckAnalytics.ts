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
  dataRoomId?: string,
  viewerEmail?: string
) {
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
  const pageStartTime = useRef<number>(Date.now());
  
  // Refs for debouncing and rate limiting
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncRef = useRef<{ page: number, time: number } | null>(null);
  const viewerEmailRef = useRef(viewerEmail);

  // Keep the ref updated with the latest prop value without triggering re-runs
  useEffect(() => {
    viewerEmailRef.current = viewerEmail;
  }, [viewerEmail]);

  // Immediate sync function (used for final cleanup)
  const syncImmediate = useCallback((d: Deck, pageNum: number, time: number, drId?: string, email?: string) => {
    analyticsService.syncSlideStats(d, pageNum, time, email, drId);
    lastSyncRef.current = { page: pageNum, time: Date.now() };
  }, []);

  // Debounced sync function (used during navigation)
  const syncDebounced = useCallback((d: Deck, pageNum: number, time: number, drId?: string) => {
    // Clear any pending sync
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Deduplication logic:
    // Sync if:
    // 1. Page is different from last sync
    // 2. OR it's been more than 30 seconds since last sync of this page (allow growth)
    const now = Date.now();
    const isSamePage = lastSyncRef.current?.page === pageNum;
    const timeSinceLastSync = lastSyncRef.current ? (now - lastSyncRef.current.time) : Infinity;

    if (isSamePage && timeSinceLastSync < 30000) {
      return;
    }

    // Debounce: wait 500ms before syncing
    debounceTimerRef.current = setTimeout(() => {
      analyticsService.syncSlideStats(d, pageNum, time, viewerEmailRef.current, drId);
      lastSyncRef.current = { page: pageNum, time: Date.now() };
    }, 500);
  }, []);

  // Function to track time spent on the current page
  const trackCurrentPage = useCallback(() => {
    if (!pageNumber || !deck || isOwner) return;
    
    const timeSpent = Math.floor((Date.now() - pageStartTime.current) / 1000);
    
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
        
        // Track slide view in PostHog
        analyticsService.trackPageView(deck, pageNumber, timeSpent);
        
        // Sync stats to Supabase
        syncImmediate(deck, pageNumber, timeSpent, dataRoomId, viewerEmailRef.current);
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
