import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { analyticsService } from "../services/analyticsService";
import { Deck } from "../types";

interface ImageDeckViewerProps {
  deck: Deck;
  viewerEmail?: string;
  isOwner?: boolean;
}

function ImageDeckViewer({
  deck,
  viewerEmail,
  isOwner = false,
}: ImageDeckViewerProps) {
  const pages = useMemo(
    () => (Array.isArray(deck?.pages) ? deck.pages : []),
    [deck?.pages],
  );
  const numPages = pages.length;

  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(Date.now());

  // Set up ResizeObserver to track container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
        setContainerHeight(entries[0].contentRect.height);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Helper to resolve image URL from potentially stringified slide data
  const resolveSlideImage = useCallback((pageData: any) => {
    if (!pageData) return "";

    let processedData = pageData;
    if (
      typeof processedData === "string" &&
      (processedData.startsWith("{") || processedData.startsWith("["))
    ) {
      try {
        processedData = JSON.parse(processedData);
      } catch (e) {
        // Fallback for malformed JSON
      }
    }

    if (typeof processedData === "string") return processedData;
    return processedData.image_url || processedData.url || "";
  }, []);

  useEffect(() => {
    // Prefetch next 5 slides for buttery smooth transitions
    const prefetchOffset = 5;
    for (let i = 1; i <= prefetchOffset; i++) {
      const pageIdx = currentPage + i;
      if (pageIdx <= numPages) {
        const imageUrl = resolveSlideImage(pages[pageIdx - 1]);
        if (imageUrl) {
          const img = new Image();
          img.src = imageUrl;
          // Note: browser handles the request once src is set,
          // essentially warming up the cache for the upcoming slides.
        }
      }
    }
  }, [currentPage, pages, numPages, resolveSlideImage]);

  useEffect(() => {
    startTimeRef.current = Date.now();
    return () => {
      const endTime = Date.now();
      const timeSpent = (endTime - startTimeRef.current) / 1000;
      if (timeSpent > 0.5 && !isOwner) {
        analyticsService.trackPageView(deck, currentPage, timeSpent);
        analyticsService.syncSlideStats(
          deck,
          currentPage,
          timeSpent,
          viewerEmail,
        );
        if (currentPage === numPages) {
          analyticsService.trackDeckComplete(deck, numPages);
        }
      }
    };
  }, [currentPage, deck, numPages, isOwner, viewerEmail]);

  const goToPrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    if (numPages > 0) {
      setCurrentPage((prev) => Math.min(prev + 1, numPages));
    }
  }, [numPages]);

  useKeyboardControls(goToPrevPage, goToNextPage);

  if (numPages === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-6">
          <span className="text-2xl font-bold">!</span>
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight mb-2">
          No Pages Processed
        </h2>
        <p className="text-slate-400 font-medium">
          This asset is still being optimized. Please wait a moment.
        </p>
      </div>
    );
  }

  const currentImage = resolveSlideImage(pages[currentPage - 1]);

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-4 md:p-8 pb-8 md:pb-12 overflow-hidden"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={(() => {
              if (!containerWidth || !containerHeight) return {};
              const targetAspect = 16 / 9;
              const containerAspect = containerWidth / containerHeight;

              let finalWidth, finalHeight;
              if (containerAspect > targetAspect) {
                // Window is wider than 16:9 - height is limit
                finalHeight = containerHeight;
                finalWidth = containerHeight * targetAspect;
              } else {
                // Window is taller than 16:9 - width is limit
                finalWidth = containerWidth;
                finalHeight = containerWidth / targetAspect;
              }

              return {
                width: finalWidth,
                height: finalHeight,
              };
            })()}
            className="bg-white shadow-[0_32px_128px_-12px_rgba(0,0,0,1)] rounded-sm flex items-center justify-center overflow-hidden"
          >
            {(() => {
              const imgSrc =
                currentImage ||
                "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2000";
              return (
                <img
                  src={imgSrc}
                  alt={`Slide ${currentPage}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              );
            })()}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Overlays & Visual Arrows */}
        <div
          className="absolute inset-y-0 left-0 w-1/4 cursor-pointer group/nav overflow-hidden"
          onClick={goToPrevPage}
          title="Previous"
        >
          <div className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white opacity-40 group-hover/nav:opacity-100 -translate-x-2 group-hover/nav:translate-x-0 transition-all duration-300 shadow-2xl">
            <ChevronLeft size={20} className="md:w-8 md:h-8" />
          </div>
        </div>

        <div
          className="absolute inset-y-0 right-0 w-1/4 cursor-pointer group/nav overflow-hidden"
          onClick={goToNextPage}
          title="Next"
        >
          <div className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white opacity-40 group-hover/nav:opacity-100 translate-x-2 group-hover/nav:translate-x-0 transition-all duration-300 shadow-2xl">
            <ChevronRight size={20} className="md:w-8 md:h-8" />
          </div>
        </div>
      </div>

      <footer className="h-14 md:h-20 bg-black/40 backdrop-blur-xl border-t border-white/5 flex items-center justify-center relative z-10 px-6">
        <div className="px-3 py-1 md:px-5 md:py-2 bg-white/5 rounded-full border border-white/5 text-slate-300 text-[10px] md:text-sm font-black tracking-widest uppercase">
          {currentPage} <span className="text-slate-600 mx-1 md:mx-2">/</span>{" "}
          {numPages}
        </div>
      </footer>
    </div>
  );
}

export default ImageDeckViewer;
