import { useEffect, useRef } from "react";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { productAnalytics, type UpgradeSource } from "../../services/productAnalytics";
import { buildUpgradeUrl } from "../../services/upgradeAttribution";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface TierUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  upgradeSource?: UpgradeSource;
}

const UPGRADE_BENEFITS = [
  { title: "Unlock the features you need", detail: "Choose a plan with the controls, insights, and capacity that fit your workflow." },
  { title: "Compare plans with confidence", detail: "Review every included feature and limit before deciding what is right for your team." },
];

export function TierUpsellModal({
  isOpen,
  onClose,
  featureName = "Premium features",
  upgradeSource = "unknown_feature_gate",
}: TierUpsellModalProps) {
  const { profile, session } = useAuth();
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      productAnalytics.capture("upgrade_prompt_viewed", {
        workspace_id: session?.user?.id,
        source_surface: "upgrade_prompt",
        plan: profile?.tier,
        upgrade_source: upgradeSource,
      });
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, profile?.tier, session?.user?.id, upgradeSource]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader className="bg-ui-subtle">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-ui-primary/25 bg-ui-primary/10 text-ui-primary">
            <LockKeyhole size={18} aria-hidden="true" />
          </div>
          <DialogTitle>Unlock {featureName}</DialogTitle>
          <DialogDescription>Compare plans and choose the controls, insights, and capacity that support your workflow.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <dl className="divide-y divide-ui-border rounded-lg border border-ui-border bg-ui-surface px-4">
            {UPGRADE_BENEFITS.map((benefit) => (
              <div key={benefit.title} className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 py-4">
                <Check size={15} strokeWidth={2.5} className="mt-0.5 text-ui-primary" aria-hidden="true" />
                <div><dt className="text-sm font-semibold text-ui-text">{benefit.title}</dt><dd className="mt-1 text-xs leading-relaxed text-ui-muted">{benefit.detail}</dd></div>
              </div>
            ))}
          </dl>
        </DialogBody>
        <DialogFooter>
          <button type="button" onClick={onClose} className="inline-flex h-11 items-center justify-center rounded-md border border-ui-border bg-ui-surface px-4 text-sm font-semibold text-ui-text hover:bg-ui-subtle">Keep editing</button>
          <button type="button" onClick={() => { window.location.href = buildUpgradeUrl(upgradeSource); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ui-primary px-5 text-sm font-semibold text-ui-primary-text hover:brightness-105">View plans<ArrowRight size={16} aria-hidden="true" /></button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
