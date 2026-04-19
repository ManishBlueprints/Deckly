import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfLinkHotspot } from "../types";
import { extractPdfLinkHotspots } from "../utils/pdfLinks";

export interface ProcessedPdfAsset {
  blob: Blob;
  links: PdfLinkHotspot[];
}

export interface ProcessPdfToImagesOptions {
  scale?: number;
  quality?: number;
  onProgress?: (current: number, total: number) => void;
}

// Keep the worker setup in one place so all deck-processing flows use the same runtime.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function processPdfToImages(
  pdfFile: File,
  options: ProcessPdfToImagesOptions = {},
): Promise<ProcessedPdfAsset[]> {
  const {
    scale = 2,
    quality = 1,
    onProgress,
  } = options;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const imageAssets: ProcessedPdfAsset[] = [];

  try {
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);

      try {
        const viewport = page.getViewport({ scale });
        const links = await extractPdfLinkHotspots(page).catch(() => []);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error(`Failed to create canvas context for page ${i}`);
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Ensure white background (PDF pages are usually white, but PDF.js renders on transparent by default)
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", quality),
        );

        if (!blob) {
          throw new Error(`Failed to generate blob for page ${i}`);
        }

        imageAssets.push({ blob, links });
        onProgress?.(i, numPages);
      } finally {
        await page.cleanup();
      }
    }
  } finally {
    await pdf.destroy();
  }

  return imageAssets;
}
