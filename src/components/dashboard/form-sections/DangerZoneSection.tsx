import { Trash2 } from "lucide-react";
import { Button } from "../../ui/button";

interface DangerZoneSectionProps {
  onDelete: () => void;
}

export function DangerZoneSection({ onDelete }: DangerZoneSectionProps) {
  return (
    <section className="space-y-4">
      <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="w-12 h-12 flex items-center justify-center shrink-0">
            <Trash2 size={24} className="text-red-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-red-500 leading-tight">
              Delete Asset
            </p>
            <p className="text-xs text-red-500/70 mt-0.5">
              Permanently wipe all records.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto mt-4 md:mt-0">
          <Button
            type="button"
            variant="destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            className="w-full sm:w-auto h-11 px-6 rounded-md font-bold text-sm bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 shadow-none transition-all"
          >
            <Trash2 size={16} className="mr-2" />
            Delete Asset
          </Button>
        </div>
      </div>
    </section>
  );
}
