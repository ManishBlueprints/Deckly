import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "../types";

const analyticsMocks = vi.hoisted(() => ({
  getVisitorId: vi.fn(() => "visitor-1"),
  capture: vi.fn(),
}));

vi.mock("../services/analyticsService", () => ({
  analyticsService: { getVisitorId: analyticsMocks.getVisitorId },
}));

vi.mock("../services/productAnalytics", () => ({
  productAnalytics: { capture: analyticsMocks.capture },
}));

import { captureCreatorFirstExternalView } from "./viewerAnalytics";

const deck = {
  id: "deck-1",
  user_id: "owner-1",
  deck_link_id: "link-1",
} as Deck;

describe("captureCreatorFirstExternalView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the creator-attributed payload and deterministic event ID", () => {
    captureCreatorFirstExternalView({ deck, isOwner: false });

    expect(analyticsMocks.capture).toHaveBeenCalledWith(
      "creator_first_external_view_received",
      {
        workspace_id: "owner-1",
        source_surface: "deck_viewer",
        deck_id: "deck-1",
        link_id: "link-1",
        event_id: "external-view:deck-1:link-1:visitor-1",
      },
    );
  });

  it.each([
    { isOwner: true, suppressAnalytics: false },
    { isOwner: false, suppressAnalytics: true },
  ])("does not capture for guarded viewer paths", (options) => {
    captureCreatorFirstExternalView({ deck, ...options });

    expect(analyticsMocks.capture).not.toHaveBeenCalled();
    expect(analyticsMocks.getVisitorId).not.toHaveBeenCalled();
  });
});
