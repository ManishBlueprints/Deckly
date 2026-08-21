import { useId, type RefObject } from "react";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/utils";

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
  compact?: boolean;
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
  compact = false,
}: SavedItemNoteCardProps) {
  const noteFieldId = useId();

  return (
    <div className={cn(compact ? "w-full" : "w-full xl:w-[420px] xl:flex-none xl:mx-auto", className)}>
      <div className={cn(compact ? "min-w-0" : "rounded-[12px] border border-ui-border bg-ui-subtle px-2.5 py-2.5 sm:px-3 sm:py-3")}>
        {!compact && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-bold uppercase tracking-[0.24em] text-ui-primary sm:text-[8px]">
              Note
            </span>
          </div>
          <span className="text-[7px] font-bold uppercase tracking-[0.16em] text-ui-muted sm:text-[8px]">
            {isSaving ? "Saving..." : `Saved ${savedDateLabel}`}
          </span>
        </div>
        )}

        <div className={cn(!compact && "mt-1.5 sm:mt-2")}>
          {isEditing ? (
            <div>
              <label htmlFor={noteFieldId} className="sr-only">
                Note
              </label>
              <textarea
                id={noteFieldId}
                name={noteFieldId}
                ref={textareaRef}
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                onBlur={onSave}
                onKeyDown={onKeyDown}
                maxLength={1000}
                rows={compact ? 2 : 3}
                placeholder="Write a note..."
                className="w-full resize-none rounded-md border border-ui-border bg-ui-surface px-2.5 py-2 text-xs text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-focus/25"
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
                  "line-clamp-2 text-xs leading-5 transition-colors",
                  note
                    ? "text-ui-text group-hover/note:text-ui-primary"
                    : "text-ui-muted group-hover/note:text-ui-text",
                )}
              >
                {note || placeholder}
              </p>
            </button>
          )}
        </div>

        {isEditing && !compact && (
          <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-medium text-ui-muted">
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
              <span className="rounded border border-ui-border px-1.5 py-0.5 text-ui-muted">
                Enter
              </span>
              <span className="truncate">to save</span>
              <span className="text-ui-border">•</span>
              <span className="rounded border border-ui-border px-1.5 py-0.5 text-ui-muted">
                Esc
              </span>
              <span className="truncate">to cancel</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden text-ui-muted sm:inline">{note.length}/1000</span>
              <button
                type="button"
                onClick={onDiscard}
                className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-ui-border bg-transparent px-3 text-[10px] font-medium text-ui-muted transition-colors hover:bg-ui-surface hover:text-ui-text"
                title="Discard note changes"
              >
                <X size={10} />
                <span className="hidden sm:inline">Cancel</span>
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-ui-primary bg-ui-primary px-3 text-[10px] font-semibold text-ui-primary-text transition-opacity hover:opacity-90 disabled:opacity-50"
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
