import { useId, type RefObject } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../../utils/cn";

interface SavedItemNoteCardProps {
  note: string;
  isEditing: boolean;
  isSaving: boolean;
  savedDateLabel: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onNoteChange: (value: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;
}

export function SavedItemNoteCard({
  note,
  isEditing,
  isSaving,
  savedDateLabel,
  textareaRef,
  onNoteChange,
  onEdit,
  onSave,
  onDiscard,
  onKeyDown,
  placeholder = "Add a note...",
  className,
}: SavedItemNoteCardProps) {
  const noteFieldId = useId();

  return (
    <div className={cn("w-full xl:w-[420px] xl:flex-none xl:mx-auto", className)}>
      <div className="rounded-xl border border-[#e6d8b0]/12 bg-[#11100d]/20 px-2.5 py-2.5 sm:px-3 sm:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.24em] text-[#e8d9af]/70">
              Note
            </span>
          </div>
          <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.16em] text-[#bbcbbb]/20">
            {isSaving ? "Saving..." : `Saved ${savedDateLabel}`}
          </span>
        </div>

        <div className="mt-1.5 sm:mt-2">
          {isEditing ? (
            <div>
              <textarea
                id={noteFieldId}
                name={noteFieldId}
                ref={textareaRef}
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                onBlur={onSave}
                onKeyDown={onKeyDown}
                maxLength={1000}
                rows={3}
                placeholder="Write a note..."
                className="w-full rounded-lg border border-[#e6d8b0]/20 bg-[#120f0b]/65 px-2.5 py-2 text-[11px] sm:text-xs text-[#f3ead0] placeholder:text-[#f3ead0]/30 resize-none outline-none focus:border-[#e6d8b0]/40 transition-colors"
              />
            </div>
          ) : (
            <button
              onClick={onEdit}
              title="Click to edit note"
              className="w-full text-left rounded-lg border border-transparent px-0.5 py-0.5 group/note"
            >
              <p
                className={cn(
                  "text-[10px] sm:text-[11px] leading-[1.15rem] sm:leading-5 italic transition-colors line-clamp-2 sm:line-clamp-3",
                  note
                    ? "text-[#f3ead0]/90 group-hover/note:text-[#fff5da]"
                    : "text-[#f3ead0]/28 group-hover/note:text-[#f3ead0]/45",
                )}
              >
                {note || placeholder}
              </p>
            </button>
          )}
        </div>

        {isEditing && (
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium text-[#bbcbbb]/25">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[#bbcbbb]/45">
                Enter
              </span>
              <span className="truncate">to save</span>
              <span className="text-[#bbcbbb]/15">•</span>
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[#bbcbbb]/45">
                Esc
              </span>
              <span className="truncate">to cancel</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-[#bbcbbb]/18">{note.length}/1000</span>
              <button
                type="button"
                onClick={onDiscard}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-transparent px-3 text-[10px] font-medium text-[#d9d2c5] transition-colors hover:border-white/20 hover:bg-white/5 hover:text-[#f0ebe3]"
                title="Discard note changes"
              >
                <X size={10} />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#54e98a]/25 bg-[#54e98a] px-3 text-[10px] font-semibold text-[#051309] transition-colors hover:bg-[#67f29a] disabled:opacity-50"
                title="Save note"
              >
                <span className="hidden sm:inline">Save</span>
                <Check size={10} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
