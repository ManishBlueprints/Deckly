import type { Deck } from "../types";
import { analyticsService } from "../services/analyticsService";
import { productAnalytics } from "../services/productAnalytics";

type CaptureCreatorExternalViewOptions = {
  deck: Deck;
  isOwner: boolean;
  suppressAnalytics?: boolean;
};

export function captureCreatorFirstExternalView({
  deck,
  isOwner,
  suppressAnalytics = false,
}: CaptureCreatorExternalViewOptions): void {
  if (isOwner || suppressAnalytics) return;

  const visitorId = analyticsService.getVisitorId();
  productAnalytics.capture("creator_first_external_view_received", {
    workspace_id: deck.user_id,
    source_surface: "deck_viewer",
    deck_id: deck.id,
    link_id: deck.deck_link_id || undefined,
    event_id: `external-view:${deck.id}:${deck.deck_link_id ?? "primary"}:${visitorId}`,
  });
}
