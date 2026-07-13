import { supabase } from "./supabase.ts";
import type { Tier } from "../constants/tiers.ts";

export type BillingInterval = "monthly" | "yearly";
export type SubscriptionStatus = "created" | "authenticated" | "active" | "pending" | "halted" | "paused" | "cancelled" | "completed" | "expired";

export type Subscription = {
  id: string;
  plan_code: string;
  entitlement_tier: Exclude<Tier, "FREE">;
  billing_interval: BillingInterval;
  razorpay_subscription_id: string;
  provider_status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan_code: string | null;
  pending_change_at: string | null;
  checkout_expires_at: string | null;
  checkout_dismissed_at: string | null;
};

export type BillingInvoice = {
  razorpay_invoice_id: string;
  razorpay_subscription_id: string;
  plan_code: string;
  invoice_number: string | null;
  provider_status: "draft" | "issued" | "partially_paid" | "paid" | "expired" | "cancelled" | "deleted";
  currency: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  hosted_url: string | null;
  billing_start: string | null;
  billing_end: string | null;
  issued_at: string | null;
  paid_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
};

export type BillingHistory = { items: BillingInvoice[]; total: number; next_offset: number | null; stale?: boolean };
type SubscriptionRefresh = { reconciled: number };
export type SubscriptionChange = {
  status: SubscriptionStatus;
  pending_plan_code: string | null;
  applied_immediately: boolean;
  immediate_charge: { amount: number; currency: string; status: string } | null;
};

type CheckoutResponse = { key_id: string; subscription_id: string; checkout_expires_at: string };
type RazorpayCheckout = new (options: Record<string, unknown>) => { open: () => void };

declare global { interface Window { Razorpay?: RazorpayCheckout } }

const functionError = async (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    // Supabase wraps non-2xx Edge Function responses in FunctionsHttpError.
    // Its Response context holds the server's safe, user-actionable message.
    const context = "context" in error ? error.context : null;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null);
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
        return body.error;
      }
    }
    if ("message" in error && typeof error.message === "string") return error.message;
  }
  return fallback;
};

async function invoke<T>(
  name: string,
  body?: Record<string, string | number | boolean | null>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await functionError(error, "Billing request failed"));
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") throw new Error(data.error);
  return data as T;
}

export const subscriptionService = {
  async getCurrent(): Promise<Subscription | null> {
    const { data, error } = await supabase.rpc("get_my_subscription");
    if (error) throw error;
    return (data?.[0] ?? null) as Subscription | null;
  },
  create(tier: Exclude<Tier, "FREE">, interval: BillingInterval) { return invoke<CheckoutResponse>("create-subscription", { tier, interval }); },
  verify(subscriptionId: string, paymentId: string, signature: string) { return invoke("verify-subscription-checkout", { subscription_id: subscriptionId, payment_id: paymentId, signature }); },
  refreshCreated() { return invoke<SubscriptionRefresh>("refresh-subscription"); },
  abandon(subscriptionId: string) { return invoke("manage-subscription", { action: "abandon_checkout", subscription_id: subscriptionId }); },
  cancel() { return invoke("manage-subscription", { action: "cancel" }); },
  change(tier: Exclude<Tier, "FREE">, interval: BillingInterval) { return invoke<SubscriptionChange>("manage-subscription", { action: "change", tier, interval }); },
  cancelChange() { return invoke("manage-subscription", { action: "cancel_change" }); },
  history(offset = 0, limit = 20) { return invoke<BillingHistory>("billing-history", { offset, limit }); },
  async loadCheckout(): Promise<RazorpayCheckout> {
    if (window.Razorpay) return window.Razorpay;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
      if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("Razorpay Checkout failed to load.")), { once: true }); return; }
      const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.async = true; script.dataset.razorpayCheckout = "true";
      script.onload = () => resolve(); script.onerror = () => reject(new Error("Razorpay Checkout failed to load. Check your connection or content blocker.")); document.head.append(script);
    });
    if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");
    return window.Razorpay;
  },
};
