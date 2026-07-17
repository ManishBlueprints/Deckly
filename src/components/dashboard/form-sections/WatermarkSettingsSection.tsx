import { useState } from "react";
import { Droplets, Lock } from "lucide-react";
import { Switch } from "../../ui/switch";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { cn } from "@/lib/utils";

interface WatermarkSettingsSectionProps {
  enabled: boolean;
  text: string;
  status?: "disabled" | "pending" | "processing" | "ready" | "failed";
  isPdf: boolean;
  canUseWatermarking: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onTextChange: (text: string) => void;
  onUpsell: () => void;
}

export function WatermarkSettingsSection({
  enabled,
  text,
  status = "disabled",
  isPdf,
  canUseWatermarking,
  onEnabledChange,
  onTextChange,
  onUpsell,
}: WatermarkSettingsSectionProps) {
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestChange = (next: boolean) => {
    if (next && !canUseWatermarking) {
      onUpsell();
      return;
    }
    if (next && !isPdf) {
      setError("Watermarking is currently available for PDF decks only.");
      return;
    }
    setApplied(false);
    setError(null);
    onEnabledChange(next);
  };

  const applyPreview = () => {
    const normalized = text.trim();
    if (!normalized) {
      setError("Enter the watermark text before applying it.");
      return;
    }
    onTextChange(normalized);
    setError(null);
    setApplied(true);
  };

  const statusLabel = status === "ready"
    ? "Watermarked download ready"
    : status === "pending" || status === "processing"
      ? "Preparing watermarked download"
      : status === "failed"
        ? "Watermarked download needs retry"
        : null;

  return (
    <section className="space-y-4 pt-6 border-t border-white/5">
      <div className="flex items-center gap-2">
        <Droplets size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">Watermark</h3>
        {!canUseWatermarking && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Lock size={12} /> Raise feature
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors",
          enabled ? "bg-background border-deckly-primary/50" : "bg-surface-container border-white/10",
          !isPdf && "opacity-75",
        )}
        onClick={() => requestChange(!enabled)}
      >
        <div>
          <p className="text-sm font-semibold text-white">Watermark enabled</p>
          <p className="mt-0.5 text-xs text-slate-500">Shown on every shared PDF page and protected download.</p>
        </div>
        <Switch
          checked={enabled}
          disabled={!isPdf && !enabled}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={requestChange}
          aria-label={canUseWatermarking ? "Enable deck watermark" : "Enable deck watermark, available on Raise"}
        />
      </div>

      {enabled && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-surface-lowest/50 p-4">
          <div className="space-y-2">
            <Label htmlFor="watermark-text" className="text-xs font-semibold text-slate-300">Watermark text</Label>
            <Input
              id="watermark-text"
              value={text}
              maxLength={80}
              onChange={(event) => { setApplied(false); setError(null); onTextChange(event.target.value); }}
              placeholder="Confidential — Your Company"
              className="h-11 rounded-md border-white/10 bg-surface-lowest text-white placeholder:text-slate-500"
            />
            <p className="text-right text-[11px] text-slate-500">{text.length}/80</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={applyPreview} className="px-3 py-2 text-xs font-semibold text-deckly-primary border border-deckly-primary/30 hover:bg-deckly-primary/10 transition-colors rounded-md">
              Apply watermark
            </button>
            <span className="text-xs text-slate-500">{applied ? "Ready to save" : "Apply to preview before saving"}</span>
          </div>
          {statusLabel && <p className="text-xs text-slate-400">{statusLabel}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      )}
    </section>
  );
}
