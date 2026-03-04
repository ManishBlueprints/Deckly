import { Trash2 } from "lucide-react";
import { Button } from "../../ui/button";

interface DangerZoneSectionProps {
  onDelete: () => void;
}

export function DangerZoneSection({ onDelete }: DangerZoneSectionProps) {
  return (
    <section className="pt-12 border-t border-white/5">
      <div className="p-10 rounded-[2.5rem] bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group">
        <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto">
          <div className="w-16 h-16 rounded-[1.5rem] bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20 shrink-0 shadow-2xl shadow-red-500/10 group-hover:scale-110 transition-transform duration-500">
            <Trash2 size={32} />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] mb-2">
              TERMINAL ACTION
            </p>
            <p className="text-xl font-bold text-white uppercase tracking-wider">
              Delete Asset
            </p>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">
              PERMANENTLY WIPE ALL RECORDS.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full md:w-auto">
          <Button
            type="button"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="w-full sm:w-auto rounded-2xl px-10 py-7 font-bold uppercase tracking-[0.2em] text-[10px] bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 shadow-none active:scale-[0.98] transition-all"
          >
            <Trash2 size={14} className="mr-2" strokeWidth={3} />
            DELETE ASSET
          </Button>
        </div>
      </div>
    </section>
  );
}
