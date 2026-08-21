interface DeckWatermarkProps {
  enabled?: boolean;
  text?: string | null;
}

export function DeckWatermark({ enabled, text }: DeckWatermarkProps) {
  if (!enabled || !text?.trim()) return null;
  const label = text.trim();

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden select-none" aria-hidden="true">
      <div className="absolute left-[-30%] top-[20%] flex w-[160%] justify-around -rotate-[35deg] whitespace-nowrap text-[clamp(0.85rem,2vw,1.5rem)] font-bold tracking-[0.18em] text-slate-700/35">
        <span>{label}</span><span>{label}</span><span>{label}</span>
      </div>
      <div className="absolute left-[-30%] top-[48%] flex w-[160%] justify-around -rotate-[35deg] whitespace-nowrap text-[clamp(0.85rem,2vw,1.5rem)] font-bold tracking-[0.18em] text-slate-700/35">
        <span>{label}</span><span>{label}</span><span>{label}</span>
      </div>
      <div className="absolute left-[-30%] top-[76%] flex w-[160%] justify-around -rotate-[35deg] whitespace-nowrap text-[clamp(0.85rem,2vw,1.5rem)] font-bold tracking-[0.18em] text-slate-700/35">
        <span>{label}</span><span>{label}</span><span>{label}</span>
      </div>
    </div>
  );
}
