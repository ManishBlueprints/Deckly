import { Crown } from "lucide-react";
import { TIER_CONFIG, type Tier } from "../../constants/tiers";

interface PremiumFeatureIconProps {
  tier: Extract<Tier, "PRO" | "RAISE">;
}

export function PremiumFeatureIcon({ tier }: PremiumFeatureIconProps) {
  const planLabel = TIER_CONFIG[tier].planLabel;

  return (
    <span
      className="inline-flex shrink-0 text-deckly-primary"
      title={`Premium feature available on ${planLabel}`}
    >
      <Crown size={14} strokeWidth={2.25} aria-hidden="true" />
      <span className="sr-only">Premium feature available on {planLabel}</span>
    </span>
  );
}
