import type { PdfLinkHotspot } from "../types";

type PdfAnnotation = {
  subtype?: string;
  url?: string;
  unsafeUrl?: string;
  rect?: number[];
};

type PdfPageLike = {
  getAnnotations: (options?: { intent?: "display" | "print" }) => Promise<
    PdfAnnotation[]
  >;
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportRectangle: (rect: number[]) => number[];
  };
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export async function extractPdfLinkHotspots(
  page: PdfPageLike,
): Promise<PdfLinkHotspot[]> {
  const annotations = await page.getAnnotations({ intent: "display" });
  if (!annotations.length) return [];

  const viewport = page.getViewport({ scale: 1 });
  const hotspots: PdfLinkHotspot[] = [];

  for (const annotation of annotations) {
    if (annotation.subtype !== "Link") continue;

    const href = annotation.url || annotation.unsafeUrl;
    if (!href || !Array.isArray(annotation.rect) || annotation.rect.length !== 4) {
      continue;
    }

    const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(
      annotation.rect,
    );
    const left = clamp01(Math.min(x1, x2) / viewport.width);
    const top = clamp01(Math.min(y1, y2) / viewport.height);
    const width = clamp01(Math.abs(x2 - x1) / viewport.width);
    const height = clamp01(Math.abs(y2 - y1) / viewport.height);

    if (width <= 0 || height <= 0) continue;

    hotspots.push({
      href,
      rect: {
        x: left,
        y: top,
        width,
        height,
      },
    });
  }

  return hotspots;
}
