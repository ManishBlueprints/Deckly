import { describe, expect, it } from "vitest";
import { formatBillingDate } from "./billingPresentation";

describe("formatBillingDate", () => {
  it("uses the billing fallback for missing and invalid timestamps", () => {
    expect(formatBillingDate(null)).toBe("—");
    expect(formatBillingDate("not-a-date")).toBe("—");
  });

  it("formats valid timestamps", () => {
    expect(formatBillingDate("2026-07-14T00:00:00.000Z")).not.toBe("—");
  });
});
