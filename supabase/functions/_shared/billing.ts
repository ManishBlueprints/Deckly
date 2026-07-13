import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PlanCode = "SHARE_MONTHLY" | "SHARE_YEARLY" | "FOUNDER_MONTHLY" | "FOUNDER_YEARLY" | "RAISE_MONTHLY" | "RAISE_YEARLY";
export type BillingInterval = "monthly" | "yearly";
export type PaidTier = "PRO" | "PRO_PLUS" | "RAISE";
export type ProviderSubscription = Record<string, unknown> & {
  id: string;
  status: string;
  plan_id?: string | null;
  customer_id?: string | null;
  payment_method?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  cancel_at_cycle_end?: boolean | null;
  change_scheduled_at?: number | null;
  has_scheduled_changes?: boolean | null;
};
export type BillingAdminClient = SupabaseClient;

type PlanConfig = { tier: PaidTier; interval: BillingInterval; env: string };
const PLANS: Record<PlanCode, PlanConfig> = {
  SHARE_MONTHLY: { tier: "PRO", interval: "monthly", env: "RAZORPAY_PLAN_SHARE_MONTHLY" },
  SHARE_YEARLY: { tier: "PRO", interval: "yearly", env: "RAZORPAY_PLAN_SHARE_YEARLY" },
  FOUNDER_MONTHLY: { tier: "PRO_PLUS", interval: "monthly", env: "RAZORPAY_PLAN_FOUNDER_MONTHLY" },
  FOUNDER_YEARLY: { tier: "PRO_PLUS", interval: "yearly", env: "RAZORPAY_PLAN_FOUNDER_YEARLY" },
  RAISE_MONTHLY: { tier: "RAISE", interval: "monthly", env: "RAZORPAY_PLAN_RAISE_MONTHLY" },
  RAISE_YEARLY: { tier: "RAISE", interval: "yearly", env: "RAZORPAY_PLAN_RAISE_YEARLY" },
};

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export const unixTime = (value: unknown) => typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString() : null;
export const planFor = (tier: unknown, interval: unknown) => {
  const planFamily = tier === "PRO" ? "SHARE" : tier === "PRO_PLUS" ? "FOUNDER" : tier === "RAISE" ? "RAISE" : "";
  const code = `${planFamily}_${interval === "yearly" ? "YEARLY" : interval === "monthly" ? "MONTHLY" : ""}` as PlanCode;
  return PLANS[code] ? { code, ...PLANS[code] } : null;
};
export const razorpayPlanId = (code: PlanCode) => Deno.env.get(PLANS[code].env)?.trim() || "";
export const planCodeForRazorpayPlanId = (providerPlanId: unknown): PlanCode | null => {
  if (typeof providerPlanId !== "string" || !providerPlanId) return null;
  return (Object.keys(PLANS) as PlanCode[]).find((code) => razorpayPlanId(code) === providerPlanId) ?? null;
};
export const tierRank = (tier: PaidTier) => ({ PRO: 1, PRO_PLUS: 2, RAISE: 3 })[tier];
export const serverConfig = () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("PROJECT_SECRET_KEY") ?? "";
  return { url, publishable, serviceRole };
};
export const adminClient = (): BillingAdminClient => {
  const { url, serviceRole } = serverConfig();
  if (!url || !serviceRole) throw new Error("Missing Supabase server configuration");
  return createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
};
export async function requireUser(req: Request) {
  const { url, publishable } = serverConfig();
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!url || !publishable || !token) throw new Error("Unauthorized");
  const client = createClient(url, publishable, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}
export function razorpayHeaders() {
  const key = Deno.env.get("RAZORPAY_KEY_ID")?.trim() || "";
  const secret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim() || "";
  if (!key || !secret) throw new Error("Razorpay is not configured");
  return { Authorization: `Basic ${btoa(`${key}:${secret}`)}`, "Content-Type": "application/json" };
}
export async function razorpay<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(15_000),
      headers: { ...razorpayHeaders(), ...(init.headers ?? {}) },
    });
  } catch {
    throw new Error("Razorpay is temporarily unavailable. Please try again shortly.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error?.description === "string" ? body.error.description : `Razorpay request failed (${response.status})`);
  return body as T;
}

export async function fetchRazorpaySubscription(subscriptionId: string): Promise<ProviderSubscription> {
  const provider = await razorpay<unknown>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
  return asProviderSubscription(provider);
}

export function asProviderSubscription(value: unknown): ProviderSubscription {
  if (!value || typeof value !== "object" || typeof (value as Record<string, unknown>).id !== "string" || typeof (value as Record<string, unknown>).status !== "string") {
    throw new Error("Razorpay returned an invalid subscription response.");
  }
  return value as ProviderSubscription;
}
export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}
export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0; for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export type ApplyProviderSubscriptionOptions = {
  fallbackPlanCode: PlanCode;
  planCode?: PlanCode | null;
  pendingPlanCode?: PlanCode | null;
  pendingChangeAt?: string | null;
  preservePendingPlan?: boolean;
  checkoutExpiresAt?: string | null;
  checkoutDismissedAt?: string | null;
  checkoutVerifiedAt?: string | null;
};

export async function applyProviderSubscription(
  admin: BillingAdminClient,
  provider: ProviderSubscription,
  options: ApplyProviderSubscriptionOptions,
) {
  const snapshotPlanCode = options.planCode === undefined
    ? planCodeForRazorpayPlanId(provider.plan_id)
    : options.planCode;
  const effectivePlanCode = snapshotPlanCode ?? options.fallbackPlanCode;
  const snapshot: Record<string, unknown> = {
    ...provider,
    _deckly_plan_code: snapshotPlanCode,
    _deckly_preserve_pending_plan: options.preservePendingPlan ?? provider.has_scheduled_changes === true,
  };
  if (options.checkoutExpiresAt !== undefined) snapshot._deckly_checkout_expires_at = options.checkoutExpiresAt;
  if (options.checkoutDismissedAt !== undefined) snapshot._deckly_checkout_dismissed_at = options.checkoutDismissedAt;

  const { error } = await admin.rpc("apply_subscription_entitlement", {
    p_razorpay_subscription_id: provider.id,
    p_provider_status: provider.status,
    p_customer_id: provider.customer_id ?? null,
    p_payment_method: provider.payment_method ?? null,
    p_current_start: unixTime(provider.current_start),
    p_current_end: unixTime(provider.current_end),
    p_cancel_at_period_end: provider.cancel_at_cycle_end === true,
    p_pending_plan_code: options.pendingPlanCode ?? null,
    // `null` is meaningful for undoing a scheduled change; only use the
    // provider value when the caller did not choose a value at all.
    p_pending_change_at: options.pendingChangeAt === undefined
      ? unixTime(provider.change_scheduled_at)
      : options.pendingChangeAt,
    p_snapshot: snapshot,
    p_checkout_verified_at: options.checkoutVerifiedAt ?? null,
  });
  if (error) throw error;
  return { planCode: effectivePlanCode };
}

const invoiceStatuses = new Set(["draft", "issued", "partially_paid", "paid", "expired", "cancelled", "deleted"]);
const providerNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;

type InvoiceSubscription = {
  id: string;
  user_id: string;
  razorpay_subscription_id: string;
  plan_code: string;
};

export type SyncedInvoice = {
  razorpay_invoice_id: string;
  provider_status: string;
  amount: number;
  currency: string;
  issued_at: number | null;
  paid_at: number | null;
};

// Billing history is refreshed server-side so raw provider payloads and payment
// identifiers never need to be exposed to the browser.
export async function syncInvoicesForSubscription(admin: BillingAdminClient, subscription: InvoiceSubscription): Promise<SyncedInvoice[]> {
  let skip = 0;
  const pageSize = 100;
  const syncedInvoices: SyncedInvoice[] = [];

  while (true) {
    const provider = await razorpay(
      `/invoices?subscription_id=${encodeURIComponent(subscription.razorpay_subscription_id)}&count=${pageSize}&skip=${skip}`,
    ) as { items?: unknown[] };
    const invoices = Array.isArray(provider.items) ? provider.items : [];
    const rows = invoices.flatMap((candidate) => {
      const invoice = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
      if (!invoice) return [];
      const id = typeof invoice?.id === "string" ? invoice.id : "";
      const status = typeof invoice?.status === "string" ? invoice.status : "";
      const currency = typeof invoice?.currency === "string" ? invoice.currency.toUpperCase() : "";
      if (!id || !invoiceStatuses.has(status) || !/^[A-Z]{3}$/.test(currency)) return [];

      return [{
        razorpay_invoice_id: id,
        subscription_id: subscription.id,
        user_id: subscription.user_id,
        razorpay_subscription_id: subscription.razorpay_subscription_id,
        plan_code: subscription.plan_code,
        invoice_number: typeof invoice.invoice_number === "string" ? invoice.invoice_number : null,
        provider_status: status,
        currency,
        amount: providerNumber(invoice.amount),
        amount_paid: providerNumber(invoice.amount_paid),
        amount_due: providerNumber(invoice.amount_due),
        hosted_url: typeof invoice.short_url === "string" ? invoice.short_url : null,
        billing_start: unixTime(invoice.billing_start),
        billing_end: unixTime(invoice.billing_end),
        issued_at: unixTime(invoice.issued_at),
        paid_at: unixTime(invoice.paid_at),
        expired_at: unixTime(invoice.expired_at),
        cancelled_at: unixTime(invoice.cancelled_at),
        provider_snapshot: invoice,
        updated_at: new Date().toISOString(),
      }];
    });

    if (rows.length > 0) {
      // A single server-only database function merges a page without an N+1
      // query pattern and deliberately keeps the original plan code on an
      // already-recorded invoice.
      const { error } = await admin.rpc("merge_billing_invoice_snapshots", {
        p_rows: rows,
      });
      if (error) throw error;

      for (const row of rows) {
        const raw = row.provider_snapshot as Record<string, unknown>;
        const issuedAt = typeof raw.issued_at === "number" && raw.issued_at > 0 ? Math.trunc(raw.issued_at) : null;
        const paidAt = typeof raw.paid_at === "number" && raw.paid_at > 0 ? Math.trunc(raw.paid_at) : null;
        syncedInvoices.push({
          razorpay_invoice_id: row.razorpay_invoice_id,
          provider_status: row.provider_status,
          amount: row.amount,
          currency: row.currency,
          issued_at: issuedAt,
          paid_at: paidAt,
        });
      }
    }
    if (invoices.length < pageSize) break;
    skip += invoices.length;
  }

  const { error } = await admin
    .from("subscriptions")
    .update({ invoices_synced_at: new Date().toISOString() })
    .eq("id", subscription.id);
  if (error) throw error;
  return syncedInvoices;
}
