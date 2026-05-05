import { memo, useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { SavedDeckOrganized, LibraryFolder, LibraryTag } from "../../types";
import { TagChip } from "./TagChip";
import { LibraryActionMenu } from "./LibraryActionMenu";
import { SavedItemNoteCard } from "./SavedItemNoteCard";
import { toast } from "sonner";
import { cn } from "../../utils/cn";

function formatSavedDate(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

interface DocumentRowProps {
  deck: SavedDeckOrganized;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  matchedTagNames?: string[];
  onSummarize: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onUpdateTags: (tagIds: string[]) => void;
  onSaveNote: (note: string) => Promise<void>;
  onUnsave: () => void;
  isUnsaving?: boolean;
}
let viewerPreloaded = false;

export const DocumentRow = memo(function DocumentRow({
  deck,
  folders,
  tags,
  matchedTagNames = [],
  onSummarize,
  onMoveToFolder,
  onUpdateTags,
  onSaveNote,
  onUnsave,
  isUnsaving,
}: DocumentRowProps) {
  const savedDate = new Date(deck.saved_at);
  const savedDateStr = formatSavedDate(savedDate);

  const [note, setNote] = useState(deck.investor_note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveJustCompletedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (saveJustCompletedRef.current) {
      saveJustCompletedRef.current = false;
      return;
    }
    if (!isEditingNote) {
      setNote(deck.investor_note || "");
    }
  }, [deck.investor_note, isEditingNote]);

  const handleNoteClick = () => {
    setIsEditingNote(true);
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    // Focus on next tick after render
    focusTimeoutRef.current = setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleNoteSave = async () => {
    if (note === (deck.investor_note || "")) {
      setIsEditingNote(false);
      return;
    }
    setIsSavingNote(true);
    try {
      await onSaveNote(note);
      saveJustCompletedRef.current = true;
      // Skip the next useEffect sync to keep local optimistic state
    } catch (err) {
      toast.error("Failed to save note", {
        description: err instanceof Error ? err.message : String(err),
      });
      setNote(deck.investor_note || "");
    } finally {
      setIsSavingNote(false);
      setIsEditingNote(false);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNoteSave();
    }
    if (e.key === "Escape") {
      setNote(deck.investor_note || "");
      setIsEditingNote(false);
    }
  };

  const handleNoteDiscard = () => {
    setNote(deck.investor_note || "");
    setIsEditingNote(false);
  };

  const handleMouseEnter = () => {
    // Preload Viewer chunk on hover only once
    if (!viewerPreloaded) {
      viewerPreloaded = true;
      import("../../pages/Viewer").catch(() => {});
    }
  };

  return (
    <motion.div
      onMouseEnter={handleMouseEnter}
      className={cn(
        "bg-surface-card border border-white/5 p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-[#54e98a]/20 transition-all",
        isUnsaving && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-center gap-4 w-full flex-1">
        {/* Drag Handle */}
        <div className="text-[#bbcbbb]/10 group-hover:text-[#bbcbbb]/30 transition-colors pointer-events-none hidden md:block">
          <GripVertical size={20} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <Link
              to={`/${deck.user_handle}/${deck.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-lg font-headline font-bold text-[#e5e2e1] hover:text-[#54e98a] transition-colors truncate"
            >
              {deck.title}
            </Link>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border border-white/10 text-[#bbcbbb]/40">
              Saved Deck
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold uppercase text-[#bbcbbb]/30 tracking-widest">
              {deck.user_handle}
            </span>
            <span className="w-1 h-1 bg-[#bbcbbb]/10 rounded-full" />
            <span className="text-[10px] font-bold uppercase text-[#bbcbbb]/30 tracking-widest">
              Interactive Deck
            </span>
          </div>
          {matchedTagNames.length > 0 && (
            <p className="mt-2 text-[11px] text-[#54e98a] leading-relaxed">
              Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
              {matchedTagNames.slice(0, 3).join(", ")}
              {matchedTagNames.length > 3 ? ` +${matchedTagNames.length - 3} more` : ""}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="hidden lg:flex flex-wrap gap-2 max-w-[200px]">
          {deck.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>

        <SavedItemNoteCard
          note={note}
          isEditing={isEditingNote}
          isSaving={isSavingNote}
          savedDateLabel={savedDateStr}
          textareaRef={textareaRef}
          onNoteChange={setNote}
          onEdit={handleNoteClick}
          onSave={handleNoteSave}
          onDiscard={handleNoteDiscard}
          onKeyDown={handleNoteKeyDown}
        />

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <LibraryActionMenu
            item={{
              title: deck.title,
              folder_id: deck.folder_id,
              tags: deck.tags,
            }}
            folders={folders}
            tags={tags}
            openLabel="Open Deck"
            openAction={() => window.open(`/${deck.user_handle}/${deck.slug}`, "_blank", "noopener,noreferrer")}
            summarizeLabel="Summarize with AI"
            onSummarize={onSummarize}
            unsaveLabel="Remove from Saved"
            unsaveDescription={`Are you sure you want to remove "${deck.title}" from your saved decks? You can still access it via the original URL if needed.`}
            onMoveToFolder={onMoveToFolder}
            onUpdateTags={onUpdateTags}
            onUnsave={onUnsave}
          />
        </div>
      </div>
    </motion.div>
  );
});
