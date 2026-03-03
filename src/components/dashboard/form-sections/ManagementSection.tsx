import { Save, Upload, AlertTriangle, FileText } from "lucide-react";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { cn } from "../../../lib/utils";
import { normalizeSlug } from "../../../utils/slug";

interface ManagementSectionProps {
  title: string;
  setTitle: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  originalSlug: string;
  userHandle: string;
  onFileClick: () => void;
  newFile: File | null;
}

export function ManagementSection({
  title,
  setTitle,
  slug,
  setSlug,
  originalSlug,
  userHandle,
  onFileClick,
  newFile,
}: ManagementSectionProps) {
  return (
    <section className="space-y-12">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary flex items-center gap-2">
            <FileText size={12} strokeWidth={3} />
            Asset Management
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-4">
          <Label
            htmlFor="title"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ml-1"
          >
            Asset Title
          </Label>
          <Input
            id="title"
            placeholder="Series A Pitch Deck"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white/[0.03] border-white/5 text-white h-14 rounded-2xl focus-visible:ring-deckly-primary/30 font-bold tracking-tight px-6 placeholder:text-slate-800 focus:bg-white/[0.08] transition-all"
          />
        </div>
        <div className="space-y-4">
          <Label
            htmlFor="slug"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ml-1"
          >
            Access Slug
          </Label>
          <div className="relative group/slug">
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10 transition-opacity group-focus-within/slug:opacity-100">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                {userHandle}/
              </span>
            </div>
            <Input
              id="slug"
              placeholder="series-a"
              value={slug}
              onChange={(e) => setSlug(normalizeSlug(e.target.value))}
              className={cn(
                "bg-white/[0.03] border-white/5 text-deckly-primary h-14 rounded-2xl focus-visible:ring-deckly-primary/30 font-bold uppercase tracking-widest transition-all focus:bg-white/[0.08]",
                userHandle.length > 10 ? "pl-32" : "pl-24",
              )}
            />
          </div>
          <div className="flex flex-col gap-2 mt-2 px-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-700">
              Your URL: deckly.com/{userHandle}/{slug || "..."}
            </p>
            {slug !== originalSlug && (
              <div className="flex items-center gap-2 text-red-500 animate-pulse">
                <AlertTriangle size={12} strokeWidth={3} />
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  Breaking Change! Old links will expire.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 ml-1">
          Replacement Source
        </Label>
        <div
          onClick={onFileClick}
          className={cn(
            "flex items-center justify-between p-8 rounded-3xl bg-white/[0.02] border border-dashed border-white/10 cursor-pointer hover:border-deckly-primary/40 hover:bg-deckly-primary/5 transition-all group relative overflow-hidden",
            newFile ? "border-deckly-primary/50 bg-deckly-primary/10" : "",
          )}
        >
          <div className="absolute inset-0 bg-deckly-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 group-hover:text-deckly-primary group-hover:border-deckly-primary/30 transition-all shadow-xl">
              <Upload size={24} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-sm font-bold text-white uppercase tracking-wider block">
                {newFile ? "New file ready" : "Replace PDF document"}
              </span>
              <span className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em] mt-1.5 block">
                {newFile ? newFile.name : "High-fidelity optimization"}
              </span>
            </div>
          </div>
          {!newFile && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 group-hover:text-deckly-primary transition-colors relative z-10">
              Update
            </span>
          )}
          {newFile && (
            <div className="w-8 h-8 rounded-full bg-deckly-primary flex items-center justify-center text-slate-950 relative z-10 shadow-lg shadow-deckly-primary/20">
              <Save size={14} strokeWidth={3} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
