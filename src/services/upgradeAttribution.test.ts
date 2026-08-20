import { describe, expect, it } from "vitest";
import {
  buildUpgradeUrl,
  parseUpgradeSource,
  upgradeSourceForFeature,
} from "./upgradeAttribution";

describe("upgrade attribution", () => {
  it("accepts only known categorical sources", () => {
    expect(parseUpgradeSource("data_room_limit")).toBe("data_room_limit");
    expect(parseUpgradeSource("private-or-unbounded-value")).toBe("profile_direct");
    expect(parseUpgradeSource(null)).toBe("profile_direct");
  });

  it("carries an internal upgrade source to pricing", () => {
    expect(buildUpgradeUrl("document_analytics_gate"))
      .toBe("/profile?section=tier&upgrade_source=document_analytics_gate");
  });

  it("maps document feature gates to stable analytics categories", () => {
    expect(upgradeSourceForFeature("PPTX Support")).toBe("document_format_gate");
    expect(upgradeSourceForFeature("Download controls")).toBe("download_controls_gate");
    expect(upgradeSourceForFeature("Deck watermarking")).toBe("watermark_gate");
  });
});
