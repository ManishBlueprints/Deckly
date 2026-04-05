import { Trash2 } from "lucide-react";

interface DangerZoneSectionProps {
  onDelete: () => void;
}

export function DangerZoneSection({ onDelete }: DangerZoneSectionProps) {
  return (
    <section className="space-y-4">
      <div className="p-4 rounded-none bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-black uppercase tracking-tight text-red-500 leading-tight">
              Delete Asset
            </p>
            <p className="text-xs uppercase font-bold tracking-widest text-red-500/70 mt-1.5">
              Permanently wipe all records.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
          <button
            type="button"
            onClick={onDelete}
            className="w-full sm:w-auto h-14 px-8 rounded-none font-black text-xs uppercase tracking-[0.2em] bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Trash2 size={16} />
            Delete Asset
          </button>
        </div>
      </div>
    </section>
  );
}
