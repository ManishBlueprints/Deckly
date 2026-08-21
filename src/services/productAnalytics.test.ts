import { beforeEach, describe, expect, it, vi } from "vitest";

const posthogMocks = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMocks }));

import {
  analyticsFailureCode,
  productAnalytics,
  sanitizeAnalyticsProperties,
} from "./productAnalytics";

describe("productAnalytics", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes sensitive and undefined properties and maps deterministic event IDs", () => {
    expect(sanitizeAnalyticsProperties({
      workspace_id: "user-1",
      event_id: "deck:1:created",
      title: "Confidential pitch",
      email: "private@example.com",
      error_message: "token leaked",
      optional: undefined,
    })).toEqual({
      workspace_id: "user-1",
      $insert_id: "deck:1:created",
    });
  });

  it("captures only the typed privacy-safe payload", () => {
    productAnalytics.capture("deck_link_created", {
      workspace_id: "user-1",
      source_surface: "content_library",
      deck_id: "deck-1",
      link_id: "link-1",
      link_count_after: 2,
      event_id: "link:link-1:created",
    });

    expect(posthogMocks.capture).toHaveBeenCalledWith("deck_link_created", {
      workspace_id: "user-1",
      source_surface: "content_library",
      deck_id: "deck-1",
      link_id: "link-1",
      link_count_after: 2,
      $insert_id: "link:link-1:created",
    });
  });

  it("identifies authenticated users without sending email or full name", () => {
    productAnalytics.identifyWorkspace("user-1", "PRO");

    expect(posthogMocks.identify).toHaveBeenCalledWith("user-1", { plan: "PRO" });
    expect(posthogMocks.group).toHaveBeenCalledWith("workspace", "user-1", { plan: "PRO" });
  });

  it("uses safe categorical failure codes", () => {
    expect(analyticsFailureCode({ code: "FILE_TOO_LARGE" }, "upload_failed"))
      .toBe("file_too_large");
    expect(analyticsFailureCode(new Error("private server response"), "upload_failed"))
      .toBe("upload_failed");
  });
});
