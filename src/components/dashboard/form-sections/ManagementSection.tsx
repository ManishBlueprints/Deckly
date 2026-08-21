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
      <div className="mb-2 flex items-center gap-2">
        <FileText size={16} className="text-ui-primary" />
        <h3 className="text-sm font-semibold text-ui-text">Asset Management</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-2">
          <Label
            htmlFor="title"
            className="text-xs font-semibold text-ui-text"
          >
            Asset Title
          </Label>
          <Input
            id="title"
            placeholder="Series A Pitch Deck"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-md border-ui-border bg-ui-surface text-ui-text placeholder:text-ui-muted focus-visible:ring-2 focus-visible:ring-ui-focus"
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor="slug"
            className="text-xs font-semibold text-ui-text"
          >
            Access Slug
          </Label>
          <div className="relative group/slug">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10 transition-opacity">
              <span className="text-sm font-medium text-ui-primary">{userHandle}/</span>
            </div>
            <Input
              id="slug"
              placeholder="series-a"
              value={slug}
              onChange={(e) => setSlug(normalizeSlug(e.target.value))}
              className={cn(
                "h-11 rounded-md border-ui-border bg-ui-surface text-ui-text focus-visible:ring-2 focus-visible:ring-ui-focus",
                userHandle.length > 10 ? "pl-[100px]" : "pl-[80px]",
              )}
            />
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-xs text-ui-muted">
              Your URL: deckly.com/{userHandle}/{slug || "..."}
            </p>
            {slug !== originalSlug && (
              <div className="flex items-center gap-1.5 text-ui-destructive">
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
        <Label className="text-xs font-semibold text-ui-text">
          Replacement Source
        </Label>
        <div
          onClick={onFileClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onFileClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Replace PDF document"
          className={cn(
            "group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-[10px] border border-dashed border-ui-border bg-ui-subtle p-6 outline-none transition-colors hover:border-ui-primary/40 hover:bg-ui-elevated focus-visible:ring-2 focus-visible:ring-ui-focus",
            newFile ? "border-ui-primary/40 bg-ui-primary/10" : "",
          )}
        >
          <div className="flex items-center gap-4 relative z-10">
            {newFile ? (
              <div className="flex size-12 items-center justify-center rounded-md border border-ui-primary/25 bg-ui-primary/10">
                <Save size={24} className="text-ui-primary" />
              </div>
            ) : (
              <div className="flex size-12 items-center justify-center rounded-md border border-ui-border bg-ui-surface transition-colors group-hover:border-ui-primary/30">
                <Upload
                  size={24}
                  className="text-ui-muted transition-colors group-hover:text-ui-primary"
                />
              </div>
            )}
            <div>
              <span className="block text-sm font-semibold text-ui-text">
                {newFile ? "New file ready" : "Replace PDF document"}
              </span>
              <span className="mt-1 block text-xs text-ui-muted">
                {newFile ? newFile.name : "High-fidelity optimization"}
              </span>
            </div>
          </div>
          {!newFile && (
            <span className="relative z-10 rounded-md border border-ui-border bg-ui-surface px-3 py-2 text-xs font-semibold text-ui-muted transition-colors group-hover:border-ui-primary/30 group-hover:text-ui-primary">
              Update
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
