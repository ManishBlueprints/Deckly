import type { BillingInvoice } from "../services/subscriptionService";

export function planLabelForCode(code: string) {
  if (code.startsWith("SHARE_")) return "Share";
  if (code.startsWith("FOUNDER_")) return "Founder";
  if (code.startsWith("RAISE_")) return "Raise";
  return code.replaceAll("_", " ");
}

export function formatBillingAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

export function formatBillingDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "—";
}

export function invoiceDate(invoice: BillingInvoice) {
  return invoice.paid_at ?? invoice.issued_at ?? invoice.expired_at ?? invoice.cancelled_at;
}
