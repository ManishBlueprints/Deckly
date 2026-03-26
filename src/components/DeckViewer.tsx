import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDeckAnalytics } from "../hooks/useDeckAnalytics";
import { useKeyboardControls } from "../hooks/useKeyboardControls";
import { Deck } from "../types";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DeckViewerProps {
  deck: Deck;
  isOwner?: boolean;
}

function DeckViewer({ deck, isOwner = false }: DeckViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Custom hooks for handling logic
  const { trackCurrentPage } = useDeckAnalytics(
    deck,
    pageNumber,
    numPages || 0,
    isOwner,
  );

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
    },
    [],
  );

  const goToPrevPage = useCallback(() => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  }, []);

  const goToNextPage = useCallback(() => {
    if (numPages) {
      setPageNumber((prevPageNumber) => Math.min(prevPageNumber + 1, numPages));
    }
  }, [numPages]);

  // Set up keyboard controls with stable callbacks
  useKeyboardControls(goToPrevPage, goToNextPage);

  const handleNavigationClick = (direction: "prev" | "next") => {
    trackCurrentPage();
    if (direction === "next") {
      goToNextPage();
    } else {
      goToPrevPage();
    }
  };

  const isPdf = !deck.file_type || deck.file_type === "pdf";
  const officeEmbedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(deck.file_url)}`;

  return (
    <div className="flex flex-col h-full bg-[#0d0f14] overflow-hidden">
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center p-4 md:p-8 pb-8 md:pb-12 overflow-hidden"
      >
        {isPdf ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={pageNumber}
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
              className="bg-white shadow-2xl rounded-sm flex items-center justify-center overflow-hidden"
            >
              <Document
                file={deck.file_url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center gap-4 p-20">
                    <div className="w-10 h-10 border-2 border-deckly-primary/30 border-t-deckly-primary rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                      Loading PDF
                    </p>
                  </div>
                }
                error={
                  <div className="p-10 text-red-500 font-bold">
                    Failed to load asset.
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                  width={(() => {
                    if (!containerWidth || !containerHeight) return undefined;
                    const targetAspect = 16 / 9;
                    return containerWidth / containerHeight > targetAspect
                      ? containerHeight * targetAspect
                      : containerWidth;
                  })()}
                  height={(() => {
                    if (!containerWidth || !containerHeight) return undefined;
                    const targetAspect = 16 / 9;
                    return containerWidth / containerHeight > targetAspect
                      ? containerHeight
                      : containerWidth / targetAspect;
                  })()}
                  loading=""
                />
              </Document>
            </motion.div>
          </AnimatePresence>
        ) : (
          /* Office Viewer Embed for DOCX, PPTX, XLSX */
          <div className="w-full h-full max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
            <iframe
              src={officeEmbedUrl}
              className="w-full h-full border-none"
              title="Document Viewer"
              frameBorder="0"
            />
          </div>
        )}

        {/* Navigation Overlays & Visual Arrows (Only for PDF) */}
        {isPdf && (
          <div className="absolute inset-0 flex pointer-events-none">
            <div
              className="flex-1 cursor-pointer group/nav overflow-hidden pointer-events-auto relative"
              onClick={() => handleNavigationClick("prev")}
              title="Previous Page"
            >
              <div className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white opacity-40 group-hover/nav:opacity-100 -translate-x-2 group-hover/nav:translate-x-0 transition-all duration-300 shadow-2xl">
                <ChevronLeft size={20} className="md:w-8 md:h-8" />
              </div>
            </div>
            <div
              className="flex-1 cursor-pointer group/nav overflow-hidden pointer-events-auto relative"
              onClick={() => handleNavigationClick("next")}
              title="Next Page"
            >
              <div className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white opacity-40 group-hover/nav:opacity-100 translate-x-2 group-hover/nav:translate-x-0 transition-all duration-300 shadow-2xl">
                <ChevronRight size={20} className="md:w-8 md:h-8" />
              </div>
            </div>
          </div>
        )}
      </div>

      {isPdf && (
        <footer className="h-16 md:h-20 bg-black/40 backdrop-blur-xl border-t border-white/5 flex items-center justify-center relative z-10 px-6">
          <div className="px-4 py-1.5 md:px-5 md:py-2 bg-white/5 rounded-full border border-white/5 text-slate-300 text-xs md:text-sm font-bold tracking-widest uppercase">
            {pageNumber} <span className="text-slate-600 mx-2">/</span>{" "}
            {numPages || "..."}
          </div>
        </footer>
      )}
    </div>
  );
}

export default DeckViewer;
