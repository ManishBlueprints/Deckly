import type { ReactNode } from "react";
import { Clock3, Lock } from "lucide-react";
import type { FeatureAccess } from "../../services/tierEntitlementService";

interface FeatureGateProps {
  access: FeatureAccess;
  children?: ReactNode;
  onUpgrade?: () => void;
  compact?: boolean;
}

export function FeatureGate({ access, children, onUpgrade, compact = false }: FeatureGateProps) {
  if (access.state === "available") return <>{children}</>;

  const isComingSoon = access.state === "coming_soon";
  const Icon = isComingSoon ? Clock3 : Lock;
  const title = isComingSoon
    ? `${access.feature?.label ?? "This feature"} is coming soon`
    : `${access.feature?.label ?? "This feature"} is not included in your plan`;
  const detail = isComingSoon
    ? "This capability is planned but is not available yet."
    : `Available on ${access.feature?.requiredTier === "PRO" ? "Share" : access.feature?.requiredTier === "PRO_PLUS" ? "Founder" : "Raise"}.`;

  return (
    <div className={compact ? "flex items-center gap-2 text-xs text-muted-foreground" : "border border-border bg-surface-lowest/40 p-3"}>
      <Icon size={16} className={isComingSoon ? "shrink-0 text-amber-400" : "shrink-0 text-muted-foreground"} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{title}</p>
        {!compact && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </div>
      {!isComingSoon && onUpgrade && (
        <button type="button" onClick={onUpgrade} className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-deckly-primary hover:underline">
          Upgrade
        </button>
      )}
    </div>
  );
}
