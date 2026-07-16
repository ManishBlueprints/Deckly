import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDeckAnalytics } from "../../hooks/useDeckAnalytics";
import { useKeyboardControls } from "../../hooks/useKeyboardControls";
import { Deck } from "../../types";
import {
  fitAspectRatioWithinBounds,
  getAspectRatio,
} from "../../utils/viewerDimensions";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DeckViewerProps {
  deck: Deck;
  isOwner?: boolean;
  dataRoomId?: string;
  viewerEmail?: string;
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => {
      width: number;
      height: number;
    };
  }>;
}

function DeckViewer({
  deck,
  isOwner = false,
  dataRoomId,
  viewerEmail,
}: DeckViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfDocument | null>(null);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);
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
    dataRoomId,
    viewerEmail,
  );

  const onDocumentLoadSuccess = useCallback((document: PdfDocument) => {
    setNumPages(document.numPages);
    setPageAspectRatio(null);
    setPdfDocument(document);
  }, []);

  useEffect(() => {
    if (!pdfDocument || pageNumber > pdfDocument.numPages) return;

    let cancelled = false;
    setPageAspectRatio(null);

    void pdfDocument
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        setPageAspectRatio(getAspectRatio(viewport.width, viewport.height));
      })
      .catch(() => {
        if (!cancelled) setPageAspectRatio(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, pdfDocument]);

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

  const dimensions = useMemo(() => {
    if (!containerWidth || !containerHeight || !pageAspectRatio) {
      return { width: 0, height: 0 };
    }

    return fitAspectRatioWithinBounds(
      containerWidth,
      containerHeight,
      pageAspectRatio,
    );
  }, [containerHeight, containerWidth, pageAspectRatio]);

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
              onPanEnd={(_, info) => {
                if (info.offset.x > 100) handleNavigationClick("prev");
                if (info.offset.x < -100) handleNavigationClick("next");
              }}
              style={{
                ...(dimensions.width > 0 ? dimensions : {}),
                touchAction: "pan-y",
              }}
              className={`rounded-sm flex items-center justify-center overflow-hidden ${
                dimensions.width > 0 ? "bg-white shadow-2xl" : "bg-transparent"
              }`}
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
                {dimensions.width > 0 && (
                  <Page
                    pageNumber={pageNumber}
                    renderTextLayer={false}
                    renderAnnotationLayer={true}
                    width={dimensions.width}
                    loading=""
                  />
                )}
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
            />
          </div>
        )}

        {/* Navigation Overlays & Visual Arrows (Only for PDF) */}
        {isPdf && (
          <div className="absolute inset-0 z-30 flex pointer-events-none">
            <div
              className="flex-1 cursor-pointer group/nav overflow-hidden pointer-events-auto relative"
              onClick={() => handleNavigationClick("prev")}
              title="Previous Page"
            >
              <div className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-black/50 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white opacity-80 md:opacity-50 group-hover/nav:opacity-100 transition-all duration-300 shadow-2xl">
                <ChevronLeft size={24} className="md:w-8 md:h-8" />
              </div>
            </div>
            <div
              className="flex-1 cursor-pointer group/nav overflow-hidden pointer-events-auto relative"
              onClick={() => handleNavigationClick("next")}
              title="Next Page"
            >
              <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-black/50 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white opacity-80 md:opacity-50 group-hover/nav:opacity-100 transition-all duration-300 shadow-2xl">
                <ChevronRight size={24} className="md:w-8 md:h-8" />
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
