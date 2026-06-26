/// <reference types="vitest/globals" />

import { vi } from "vitest";

const useQueryMock = vi.hoisted(() => vi.fn((options: unknown) => options));
const analyticsServiceMock = vi.hoisted(() => ({
  getDeckStats: vi.fn(),
  getDeckBookmarks: vi.fn(),
  getUniqueVisitorCount: vi.fn(),
  getDeckLocations: vi.fn(),
}));
const getVisitorSignalsMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("../services/analyticsService", () => ({
  analyticsService: analyticsServiceMock,
}));

vi.mock("../services/interestSignalService", () => ({
  getVisitorSignals: getVisitorSignalsMock,
}));

import {
  useDeckBookmarks,
  useDeckLocations,
  useDeckStats,
  useUniqueVisitorCount,
  useVisitorSignals,
} from "./useDeckAnalyticsData";

describe("useDeckAnalyticsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps deck analytics queries disabled until ownership is known", () => {
    useDeckStats("deck-1", true, "user-1", false);
    useDeckBookmarks("deck-1", "user-1", false);
    useVisitorSignals("deck-1", "user-1", false);
    useUniqueVisitorCount("deck-1", "user-1", false);
    useDeckLocations("deck-1", "user-1", false);

    for (const call of useQueryMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          enabled: false,
        }),
      );
    }
  });

  it("enables queries only when both deck id and owner id are present", () => {
    useDeckStats("deck-1", true, "user-1", true);
    useDeckBookmarks("deck-1", "user-1", true);
    useVisitorSignals("deck-1", "user-1", true);
    useUniqueVisitorCount("deck-1", "user-1", true);
    useDeckLocations("deck-1", "user-1", true);

    for (const call of useQueryMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          enabled: true,
        }),
      );
    }
  });

  it("keeps queries disabled even if enabled=true but deckId and/or ownerId is missing", () => {
    // Missing deckId
    useDeckStats(undefined, true, "user-1", true);
    useDeckBookmarks(undefined, "user-1", true);
    useVisitorSignals(undefined, "user-1", true);
    useUniqueVisitorCount(undefined, "user-1", true);
    useDeckLocations(undefined, "user-1", true);

    // Missing ownerId/userId
    useDeckStats("deck-1", true, undefined, true);
    useDeckBookmarks("deck-1", undefined, true);
    useVisitorSignals("deck-1", undefined, true);
    useUniqueVisitorCount("deck-1", undefined, true);
    useDeckLocations("deck-1", undefined, true);

    // Missing both
    useDeckStats(undefined, true, undefined, true);
    useDeckBookmarks(undefined, undefined, true);
    useVisitorSignals(undefined, undefined, true);
    useUniqueVisitorCount(undefined, undefined, true);
    useDeckLocations(undefined, undefined, true);

    for (const call of useQueryMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          enabled: false,
        }),
      );
    }
  });
});
