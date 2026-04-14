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
    <section className="space-y-6 pt-2">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">Asset Management</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-2">
          <Label
            htmlFor="title"
            className="text-xs font-semibold text-slate-300"
          >
            Asset Title
          </Label>
          <Input
            id="title"
            placeholder="Series A Pitch Deck"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 transition-all focus:bg-[#2B2B2B]"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="slug"
            className="text-xs font-semibold text-slate-300"
          >
            Access Slug
          </Label>
          <div className="relative group/slug">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10 transition-opacity">
              <span className="text-sm text-deckly-primary">{userHandle}/</span>
            </div>
            <Input
              id="slug"
              placeholder="series-a"
              value={slug}
              onChange={(e) => setSlug(normalizeSlug(e.target.value))}
              className={cn(
                "h-11 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-[#2B2B2B]",
                userHandle.length > 10 ? "pl-[100px]" : "pl-[80px]",
              )}
            />
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-xs text-slate-500">
              Your URL: deckly.com/{userHandle}/{slug || "..."}
            </p>
            {slug !== originalSlug && (
              <div className="flex items-center gap-1.5 text-red-500">
                <AlertTriangle size={14} />
                <span className="text-xs">
                  Breaking Change! Old links will expire.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-slate-300">
          Replacement Source
        </Label>
        <div
          onClick={onFileClick}
          className={cn(
            "flex items-center justify-between p-6 rounded-lg bg-[#2B2B2B] border border-white/10 border-dashed cursor-pointer hover:bg-surface-card hover:border-white/20 transition-all group relative overflow-hidden",
            newFile ? "border-deckly-primary/30 bg-surface-card" : "",
          )}
        >
          <div className="flex items-center gap-4 relative z-10">
            {newFile ? (
              <div className="w-12 h-12 flex items-center justify-center">
                <Save size={24} className="text-deckly-primary" />
              </div>
            ) : (
              <div className="w-12 h-12 flex items-center justify-center transition-colors">
                <Upload
                  size={24}
                  className="text-slate-500 group-hover:text-deckly-primary transition-colors"
                />
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-white block">
                {newFile ? "New file ready" : "Replace PDF document"}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">
                {newFile ? newFile.name : "High-fidelity optimization"}
              </span>
            </div>
          </div>
          {!newFile && (
            <span className="text-xs font-medium text-slate-500 group-hover:text-deckly-primary transition-colors relative z-10">
              Update
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
