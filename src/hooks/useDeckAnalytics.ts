import { useState, useEffect, useRef, useCallback } from 'react';
import { analyticsService } from '../services/analyticsService';
import { Deck } from '../types';

export function useDeckAnalytics(deck: Deck | null, pageNumber: number, numPages: number, isOwner: boolean = false, dataRoomId?: string) {
  const [viewedPages, setViewedPages] = useState<Set<number>>(new Set());
  const pageStartTime = useRef<number>(Date.now());

  // Effect to track the initial deck view
  useEffect(() => {
    if (deck && !isOwner) {
      analyticsService.trackDeckView(deck);
    }
  }, [deck, isOwner]);

  // Function to track time spent on the current page
  const trackCurrentPage = useCallback(() => {
    if (!pageNumber || !deck || isOwner) return;
    const timeSpent = Math.floor((Date.now() - pageStartTime.current) / 1000);
    analyticsService.trackPageView(deck, pageNumber, timeSpent);
    analyticsService.syncSlideStats(deck, pageNumber, timeSpent, undefined, dataRoomId);
    setViewedPages(prev => new Set(prev).add(pageNumber));
  }, [pageNumber, deck, isOwner, dataRoomId]);

  // Effect to track page changes and reset the timer
  useEffect(() => {
    pageStartTime.current = Date.now();
    
    // Cleanup function to track the page view when the page changes or component unmounts
    return () => {
      trackCurrentPage();
    };
  }, [trackCurrentPage]);

  // Effect to check if the entire deck has been viewed
  useEffect(() => {
    if (deck && numPages && viewedPages.size === numPages) {
      analyticsService.trackDeckComplete(deck, numPages);
    }
  }, [viewedPages, numPages, deck]);

  return { trackCurrentPage };  
}