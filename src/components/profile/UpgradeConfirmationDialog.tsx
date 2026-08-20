import { TIER_CONFIG, type Tier } from "../../constants/tiers";
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

type UpgradeConfirmationDialogProps = {
  targetTier: Exclude<Tier, "FREE"> | null;
  billingCycle: "monthly" | "yearly";
  onClose: () => void;
  onConfirm: () => void;
};

export function UpgradeConfirmationDialog({ targetTier, billingCycle, onClose, onConfirm }: UpgradeConfirmationDialogProps) {
  const billingLabel = billingCycle === "yearly" ? "annual" : "monthly";
  return (
    <AlertDialog open={!!targetTier} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{targetTier ? `Upgrade to ${TIER_CONFIG[targetTier].planLabel}?` : "Confirm upgrade"}</AlertDialogTitle>
          <AlertDialogDescription>
            Razorpay will calculate and charge the prorated difference for {billingLabel} billing using your authorised payment mandate. Your plan changes only after the charge is confirmed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current plan</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-ui-primary text-ui-primary-text hover:brightness-105">Confirm and charge</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
