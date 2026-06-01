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
});
