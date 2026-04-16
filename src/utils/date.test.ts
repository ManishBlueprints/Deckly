/// <reference types="vitest/globals" />
import { formatRelativeTime } from "./date";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    // Set a consistent 'now' for all tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for falsy inputs", () => {
    expect(formatRelativeTime(null)).toBe(null);
    expect(formatRelativeTime(undefined)).toBe(null);
    expect(formatRelativeTime("")).toBe(null);
  });

  it("returns 'just now' for durations under 60 seconds", () => {
    const fortyFiveSecondsAgo = new Date("2026-04-14T09:59:15Z").toISOString();
    expect(formatRelativeTime(fortyFiveSecondsAgo)).toBe("just now");
  });

  it("returns minutes ago for durations under 1 hour", () => {
    const fiveMinutesAgo = new Date("2026-04-14T09:55:00Z").toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe("5m ago");
  });

  it("returns hours ago for durations under 24 hours", () => {
    const threeHoursAgo = new Date("2026-04-14T07:00:00Z").toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for durations under 30 days", () => {
    const fiveDaysAgo = new Date("2026-04-09T10:00:00Z").toISOString();
    expect(formatRelativeTime(fiveDaysAgo)).toBe("5d ago");
  });

  it("returns months ago for durations under 1 year", () => {
    // 61 days ago to ensure it hits the 2 month mark (61 * 24 * 3600 > 2 * 2592000)
    const sixtyOneDaysAgo = new Date("2026-02-12T10:00:00Z").toISOString();
    expect(formatRelativeTime(sixtyOneDaysAgo)).toBe("2mo ago");
  });

  it("returns years ago for durations over 1 year", () => {
    const twoYearsAgo = new Date("2024-04-14T10:00:00Z").toISOString();
    expect(formatRelativeTime(twoYearsAgo)).toBe("2y ago");
  });

  it("handles future dates as 'just now'", () => {
    const oneMinuteInFuture = new Date("2026-04-14T10:01:00Z").toISOString();
    expect(formatRelativeTime(oneMinuteInFuture)).toBe("just now");
  });
});
