import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { TIER_CONFIG, type Tier } from "../../constants/tiers";
import { billingHistoryQueryKey } from "../../hooks/useSubscriptionState";
import { subscriptionService, type Subscription } from "../../services/subscriptionService";
import { cn } from "../../lib/utils";
import { formatBillingAmount, formatBillingDate, invoiceDate, planLabelForCode } from "../../utils/billingPresentation";
import { productAnalytics } from "../../services/productAnalytics";
import { ProfileSectionHeader } from "./ProfileSectionPrimitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

type BillingSectionProps = {
  currentTier: Tier;
  onManagePlan: () => void;
  profileId: string | undefined;
  subscription: Subscription | null | undefined;
  subscriptionLoading: boolean;
  refreshBilling: () => Promise<void>;
};

export function BillingSection({
  currentTier,
  onManagePlan,
  profileId,
  subscription,
  subscriptionLoading,
  refreshBilling,
}: BillingSectionProps) {
  const [offset, setOffset] = useState(0);
  const [billingBusy, setBillingBusy] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const historyQuery = useQuery({
    queryKey: [...billingHistoryQueryKey(profileId), offset],
    queryFn: () => subscriptionService.history(offset),
    enabled: Boolean(profileId),
    staleTime: 30_000,
  });
  const invoices = historyQuery.data?.items ?? [];
  const nextOffset = historyQuery.data?.next_offset ?? null;
  const showHistoryPager = !historyQuery.isLoading && !historyQuery.isError && (
    offset > 0 || nextOffset !== null
  );

  const refreshBillingAfterAction = async () => {
    try {
      await refreshBilling();
    } catch {
      toast.error("Your subscription was updated, but the latest billing details could not be loaded. Please refresh the page.");
    }
  };

  const cancelAtRenewal = async () => {
    setBillingBusy(true);
    try {
      await subscriptionService.cancel();
      productAnalytics.capture("subscription_cancellation_requested", {
        workspace_id: profileId,
        source_surface: "billing",
        plan: currentTier,
        billing_interval: subscription?.billing_interval,
      });
      setCancelConfirmOpen(false);
      toast.success("Cancellation is scheduled. Your access remains available through the current paid period.");
      await refreshBillingAfterAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to schedule cancellation.");
    } finally {
      setBillingBusy(false);
    }
  };

  const undoPlanChange = async () => {
    setBillingBusy(true);
    try {
      await subscriptionService.cancelChange();
      toast.success("Scheduled plan change cancelled.");
      await refreshBillingAfterAction();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel the scheduled plan change.");
    } finally {
      setBillingBusy(false);
    }
  };

  const status = subscription?.provider_status;
  const requiresPaymentAction = status === "pending" || status === "halted" || status === "paused";
  const canCancel = Boolean(subscription && !subscription.cancel_at_period_end && (status === "authenticated" || status === "active"));
  const isInactiveCheckout = status === "created" || status === "expired";
  const subscriptionIsLive = status === "authenticated" || status === "active";
  const subscriptionStateLabel = subscriptionIsLive ? "Active" : status ? status.replaceAll("_", " ") : "Free";

  return (
    <div className="space-y-8">
      <ProfileSectionHeader
        icon={ReceiptText}
        eyebrow="Billing"
        title="Subscription and invoices"
        description="Review your current plan, upcoming renewal, scheduled changes, and complete payment history."
      />

      <AlertDialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => {
          if (!billingBusy) setCancelConfirmOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-1 flex size-11 items-center justify-center rounded-[9px] border border-ui-warning/25 bg-ui-warning/10 text-ui-warning">
              <CalendarClock size={20} aria-hidden="true" />
            </div>
            <AlertDialogTitle>Cancel at the end of this billing period?</AlertDialogTitle>
            <AlertDialogDescription>
            You will retain access until {formatBillingDate(subscription?.current_period_end ?? null)}. This cancellation cannot be undone once scheduled; you can subscribe again after access ends.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={billingBusy}>Keep plan</AlertDialogCancel>
            <AlertDialogAction
              disabled={billingBusy}
              onClick={(event) => {
                event.preventDefault();
                void cancelAtRenewal();
              }}
              className="bg-ui-destructive text-ui-surface hover:brightness-95"
            >
              {billingBusy ? "Scheduling…" : "Cancel at renewal"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="overflow-hidden rounded-[14px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]" aria-labelledby="billing-status-title">
        <header className="flex flex-col gap-4 border-b border-ui-border bg-ui-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[9px] border border-ui-primary/25 bg-ui-primary/10 text-ui-primary">
              <CreditCard size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 id="billing-status-title" className="text-base font-semibold text-ui-text">Subscription</h3>
              <p className="mt-0.5 text-xs text-ui-muted">Your plan, renewal, and payment status in one place.</p>
            </div>
          </div>
          <span className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold capitalize",
            subscriptionIsLive ? "border-ui-primary/25 bg-ui-primary/10 text-ui-primary" : "border-ui-border bg-ui-surface text-ui-muted",
          )}>
            <span className={cn("size-1.5 rounded-full", subscriptionIsLive ? "bg-ui-primary" : "bg-ui-muted")} />
            {subscriptionStateLabel}
          </span>
        </header>

        <div className="p-5 sm:p-6">
          {subscriptionLoading ? (
            <p className="text-sm text-ui-muted">Loading billing status…</p>
          ) : isInactiveCheckout ? (
            <div className="max-w-xl">
              <p className="text-sm font-medium text-ui-text">No active subscription</p>
              <p className="mt-2 text-sm leading-relaxed text-ui-muted">Your previous checkout did not complete, so no payment method was saved and no plan was activated.</p>
            </div>
          ) : !subscription || currentTier === "FREE" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-relaxed text-ui-muted">You are currently on Free. Choose a paid plan whenever you are ready to unlock more rooms, storage, and analytics.</p>
              <button type="button" onClick={onManagePlan} className="h-10 shrink-0 rounded-[8px] bg-ui-primary px-4 text-sm font-semibold text-ui-primary-text transition-all hover:brightness-95">Choose a plan</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
              <div className="rounded-[10px] border border-ui-border bg-ui-surface p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ui-muted">Current plan</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-2xl font-semibold tracking-tight text-ui-text">{TIER_CONFIG[subscription.entitlement_tier].planLabel}</p>
                  <span className="text-sm font-medium text-ui-muted">{subscription.billing_interval === "yearly" ? "Annual" : "Monthly"}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ui-muted">Your workspace limits and premium controls are active now.</p>
              </div>
              <div className="rounded-[10px] border border-ui-border bg-ui-subtle/70 p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ui-muted">{subscription.cancel_at_period_end ? "Access ends" : "Next renewal"}</p>
                <p className="mt-2 text-lg font-semibold text-ui-text">{formatBillingDate(subscription.current_period_end)}</p>
                <p className="mt-2 text-xs leading-relaxed text-ui-muted">{subscription.cancel_at_period_end ? "Your plan will not renew again." : "Razorpay will charge your authorised payment method then."}</p>
              </div>
            </div>
          )}

          {subscription?.pending_plan_code && (
            <div className="mt-4 flex flex-col gap-3 rounded-[10px] border border-ui-border bg-ui-subtle/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ui-muted"><span className="font-medium text-ui-text">{planLabelForCode(subscription.pending_plan_code)}</span> is scheduled for your next renewal.</p>
              <button type="button" disabled={billingBusy} onClick={() => void undoPlanChange()} className="h-9 rounded-[8px] border border-ui-border px-3 text-xs font-semibold text-ui-text transition-colors hover:bg-ui-elevated disabled:opacity-50">Undo change</button>
            </div>
          )}

          {subscription?.cancel_at_period_end && (
            <div className="mt-4 rounded-[10px] border border-ui-warning/25 bg-ui-warning/5 p-4 text-sm leading-relaxed text-ui-warning">
              Cancellation is scheduled. Access remains available until {formatBillingDate(subscription.current_period_end)} and cannot be reactivated after it ends.
            </div>
          )}

          {requiresPaymentAction && (
            <div className="mt-4 rounded-[10px] border border-ui-warning/25 bg-ui-warning/5 p-4 text-sm leading-relaxed text-ui-warning">
              Payment action is needed. Razorpay is processing or has exhausted a payment attempt; access remains governed by your recorded paid period.
            </div>
          )}

          {canCancel && (
            <div className="mt-5 flex flex-col gap-3 border-t border-ui-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ui-text">Need to stop renewals?</p>
                <p className="mt-1 text-xs leading-relaxed text-ui-muted">Cancellation takes effect at the end of the paid billing period.</p>
              </div>
              <button type="button" disabled={billingBusy} onClick={() => setCancelConfirmOpen(true)} className="h-9 shrink-0 rounded-[8px] border border-ui-destructive/35 bg-ui-destructive/5 px-3 text-xs font-semibold text-ui-destructive transition-colors hover:bg-ui-destructive/10 disabled:opacity-50">Cancel subscription</button>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]" aria-labelledby="billing-history-title">
        <div className="flex flex-col gap-3 border-b border-ui-border bg-ui-subtle/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[9px] border border-ui-border bg-ui-surface text-ui-muted">
              <ReceiptText size={18} aria-hidden="true" />
            </div>
            <div>
            <h3 id="billing-history-title" className="text-base font-semibold text-ui-text">Billing history</h3>
            <p className="mt-1 text-xs text-ui-muted">Invoices from paid, pending, expired, and cancelled subscription attempts.</p>
            {historyQuery.data?.stale && <p className="mt-2 text-xs text-ui-warning">Showing saved history while Razorpay is temporarily unavailable.</p>}
            {historyQuery.data?.sync_pending && <p className="mt-2 text-xs text-ui-muted">Older invoices are still synchronizing in the background.</p>}
            </div>
          </div>
          {historyQuery.isFetching && <p className="text-[10px] font-semibold uppercase tracking-widest text-ui-muted">Refreshing</p>}
        </div>

        {historyQuery.isLoading ? (
          <div className="px-5 py-8 text-sm text-ui-muted">Loading billing history…</div>
        ) : historyQuery.isError ? (
          <div className="px-5 py-8 text-sm text-ui-muted">
            We could not refresh your billing history. <button type="button" onClick={() => void historyQuery.refetch()} className="font-semibold text-ui-primary hover:underline">Try again</button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-[9px] border border-ui-border bg-ui-subtle text-ui-muted"><ReceiptText size={17} /></div>
            <p className="mt-3 text-sm font-medium text-ui-text">No billing activity yet</p>
            <p className="mt-1 text-xs text-ui-muted">Invoices will appear here after your first subscription payment.</p>
          </div>
        ) : (
          <div className="divide-y divide-ui-border/70">
            {invoices.map((invoice) => (
              <div key={invoice.razorpay_invoice_id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-ui-subtle/50 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ui-text">{planLabelForCode(invoice.plan_code)} · {formatBillingAmount(invoice.amount, invoice.currency)}</p>
                  <p className="mt-1 text-xs text-ui-muted">{formatBillingDate(invoiceDate(invoice))}{invoice.invoice_number ? ` · ${invoice.invoice_number}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-ui-border bg-ui-subtle px-2.5 py-1 text-[10px] font-semibold capitalize text-ui-muted">{invoice.provider_status.replaceAll("_", " ")}</span>
                  {invoice.hosted_url && (
                    <a href={invoice.hosted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-ui-primary hover:underline">
                      View invoice <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showHistoryPager && (
          <div className="flex items-center justify-between border-t border-ui-border px-5 py-3 sm:px-6">
            <button type="button" disabled={offset === 0 || historyQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))} className="rounded-[8px] px-3 py-2 text-xs font-semibold text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-text disabled:opacity-30">Previous</button>
            <button type="button" disabled={nextOffset === null || historyQuery.isFetching} onClick={() => setOffset(nextOffset ?? offset)} className="rounded-[8px] px-3 py-2 text-xs font-semibold text-ui-primary transition-colors hover:bg-ui-primary/10 disabled:opacity-30">Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
