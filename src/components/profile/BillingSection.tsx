import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { TIER_CONFIG, type Tier } from "../../constants/tiers";
import { billingHistoryQueryKey } from "../../hooks/useSubscriptionState";
import { subscriptionService, type Subscription } from "../../services/subscriptionService";
import { cn } from "../../utils/cn";
import { formatBillingAmount, formatBillingDate, invoiceDate, planLabelForCode } from "../../utils/billingPresentation";

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
  const cancelDialogRef = useRef<HTMLDialogElement>(null);
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

  useEffect(() => {
    const dialog = cancelDialogRef.current;
    if (!dialog) return;
    if (cancelConfirmOpen && !dialog.open) dialog.showModal();
    if (!cancelConfirmOpen && dialog.open) dialog.close();
  }, [cancelConfirmOpen]);

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
    <div className="space-y-6">
      <dialog
        ref={cancelDialogRef}
        onCancel={(event) => { event.preventDefault(); setCancelConfirmOpen(false); }}
        className="fixed left-1/2 top-1/2 m-0 max-h-[calc(100dvh-2rem)] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-surface-lowest p-0 text-foreground backdrop:bg-black/75"
        aria-labelledby="cancel-subscription-title"
      >
        <div className="p-6">
          <h3 id="cancel-subscription-title" className="text-base font-semibold text-foreground">Cancel at the end of this billing period?</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You will retain access until {formatBillingDate(subscription?.current_period_end ?? null)}. This cancellation cannot be undone once scheduled; you can subscribe again after access ends.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" disabled={billingBusy} onClick={() => setCancelConfirmOpen(false)} className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">Keep plan</button>
            <button type="button" disabled={billingBusy} onClick={() => void cancelAtRenewal()} className="border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/20 disabled:opacity-50">
              {billingBusy ? "Scheduling…" : "Cancel at renewal"}
            </button>
          </div>
        </div>
      </dialog>

      <section className="overflow-hidden border border-border bg-surface-low" aria-labelledby="billing-status-title">
        <header className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-deckly-primary/35 bg-deckly-primary/10 text-deckly-primary">
              <ReceiptText size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 id="billing-status-title" className="text-base font-semibold text-foreground">Subscription</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Your plan, renewal, and payment status in one place.</p>
            </div>
          </div>
          <span className={cn(
            "inline-flex w-fit items-center gap-2 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
            subscriptionIsLive ? "border-deckly-primary/30 bg-deckly-primary/10 text-deckly-primary" : "border-border bg-surface-lowest text-muted-foreground",
          )}>
            <span className={cn("h-1.5 w-1.5", subscriptionIsLive ? "bg-deckly-primary" : "bg-muted-foreground")} />
            {subscriptionStateLabel}
          </span>
        </header>

        <div className="p-5 sm:p-6">
          {subscriptionLoading ? (
            <p className="text-sm text-muted-foreground">Loading billing status…</p>
          ) : isInactiveCheckout ? (
            <div className="max-w-xl">
              <p className="text-sm font-medium text-foreground">No active subscription</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your previous checkout did not complete, so no payment method was saved and no plan was activated.</p>
            </div>
          ) : !subscription || currentTier === "FREE" ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">You are currently on Free. Choose a paid plan whenever you are ready to unlock more rooms, storage, and analytics.</p>
              <button type="button" onClick={onManagePlan} className="shrink-0 bg-deckly-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-primary-foreground hover:brightness-110">Choose a plan</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
              <div className="border border-border bg-surface-lowest p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Current plan</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{TIER_CONFIG[subscription.entitlement_tier].planLabel}</p>
                  <span className="text-sm font-medium text-muted-foreground">{subscription.billing_interval === "yearly" ? "Annual" : "Monthly"}</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Your workspace limits and premium controls are active now.</p>
              </div>
              <div className="border border-border bg-surface-container p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{subscription.cancel_at_period_end ? "Access ends" : "Next renewal"}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatBillingDate(subscription.current_period_end)}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{subscription.cancel_at_period_end ? "Your plan will not renew again." : "Razorpay will charge your authorised payment method then."}</p>
              </div>
            </div>
          )}

          {subscription?.pending_plan_code && (
            <div className="mt-4 flex flex-col gap-3 border border-border bg-surface-lowest p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{planLabelForCode(subscription.pending_plan_code)}</span> is scheduled for your next renewal.</p>
              <button type="button" disabled={billingBusy} onClick={() => void undoPlanChange()} className="border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground hover:bg-surface-high disabled:opacity-50">Undo change</button>
            </div>
          )}

          {subscription?.cancel_at_period_end && (
            <div className="mt-4 border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-100/90">
              Cancellation is scheduled. Access remains available until {formatBillingDate(subscription.current_period_end)} and cannot be reactivated after it ends.
            </div>
          )}

          {requiresPaymentAction && (
            <div className="mt-4 border border-amber-400/25 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-100/90">
              Payment action is needed. Razorpay is processing or has exhausted a payment attempt; access remains governed by your recorded paid period.
            </div>
          )}

          {canCancel && (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Need to stop renewals?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cancellation takes effect at the end of the paid billing period.</p>
              </div>
              <button type="button" disabled={billingBusy} onClick={() => setCancelConfirmOpen(true)} className="shrink-0 border border-red-500/45 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/10 disabled:opacity-50">Cancel subscription</button>
            </div>
          )}
        </div>
      </section>

      <section className="border border-border bg-surface-low" aria-labelledby="billing-history-title">
        <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="billing-history-title" className="text-base font-semibold text-foreground">Billing history</h3>
            <p className="mt-1 text-xs text-muted-foreground">Invoices from every subscription, including paid, pending, expired, and cancelled attempts.</p>
            {historyQuery.data?.stale && <p className="mt-2 text-xs text-amber-200/90">Showing saved history while Razorpay is temporarily unavailable.</p>}
            {historyQuery.data?.sync_pending && <p className="mt-2 text-xs text-muted-foreground">Older invoices are still synchronizing in the background.</p>}
          </div>
          {historyQuery.isFetching && <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Refreshing</p>}
        </div>

        {historyQuery.isLoading ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">Loading billing history…</div>
        ) : historyQuery.isError ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">
            We could not refresh your billing history. <button type="button" onClick={() => void historyQuery.refetch()} className="font-semibold text-deckly-primary hover:underline">Try again</button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">No billing activity yet.</div>
        ) : (
          <div className="divide-y divide-border/70">
            {invoices.map((invoice) => (
              <div key={invoice.razorpay_invoice_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{planLabelForCode(invoice.plan_code)} · {formatBillingAmount(invoice.amount, invoice.currency)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatBillingDate(invoiceDate(invoice))}{invoice.invoice_number ? ` · ${invoice.invoice_number}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{invoice.provider_status.replaceAll("_", " ")}</span>
                  {invoice.hosted_url && (
                    <a href={invoice.hosted_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-deckly-primary hover:underline">
                      View invoice <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showHistoryPager && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button type="button" disabled={offset === 0 || historyQuery.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-30">Previous</button>
            <button type="button" disabled={nextOffset === null || historyQuery.isFetching} onClick={() => setOffset(nextOffset ?? offset)} className="text-[10px] font-bold uppercase tracking-widest text-deckly-primary hover:underline disabled:opacity-30">Next</button>
          </div>
        )}
      </section>
    </div>
  );
}
