/// <reference types="vitest/globals" />

import type { BillingInvoice } from "../services/subscriptionService";
import { formatBillingAmount, invoiceDate, planLabelForCode } from "./billingPresentation";

describe("billing presentation", () => {
  it("turns immutable provider plan codes into customer-facing labels", () => {
    expect(planLabelForCode("SHARE_YEARLY")).toBe("Share");
    expect(planLabelForCode("FOUNDER_MONTHLY")).toBe("Founder");
    expect(planLabelForCode("RAISE_YEARLY")).toBe("Raise");
  });

  it("formats minor-unit invoice amounts", () => {
    expect(formatBillingAmount(8640, "USD")).toMatch(/86[.,]40/);
  });

  it("uses the most meaningful lifecycle timestamp for an invoice", () => {
    const invoice = {
      paid_at: "2026-07-13T12:00:00.000Z",
      issued_at: "2026-07-12T12:00:00.000Z",
      expired_at: null,
      cancelled_at: null,
    } as BillingInvoice;

    expect(invoiceDate(invoice)).toBe(invoice.paid_at);
  });
});
