import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { SavedDeckOrganized, LibraryFolder, LibraryTag } from "../../types";
import { TagChip } from "./TagChip";
import { DeckActionMenu } from "./DeckActionMenu";
import { toast } from "sonner";
import { cn } from "../../utils/cn";

function formatSavedDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

interface DocumentRowProps {
  deck: SavedDeckOrganized;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onMoveToFolder: (folderId: string | null) => void;
  onUpdateTags: (tagIds: string[]) => void;
  onSaveNote: (note: string) => Promise<void>;
  onUnsave: () => void;
  isUnsaving?: boolean;
}

export function DocumentRow({
  deck,
  folders,
  tags,
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

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
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
      // Optimistically update prop to prevent useEffect from reverting state 
      // before parent rerenders with new data
      deck.investor_note = note;
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "bg-surface-card border border-white/5 p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-[#54e98a]/20 transition-all",
        isUnsaving && "opacity-50 pointer-events-none"
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
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black uppercase text-[#bbcbbb]/30 tracking-widest">
              {deck.user_handle}
            </span>
            <span className="w-1 h-1 bg-[#bbcbbb]/10 rounded-full" />
            <span className="text-[10px] font-black uppercase text-[#bbcbbb]/30 tracking-widest">
              Interactive Deck
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="hidden lg:flex flex-wrap gap-2 max-w-[200px]">
          {deck.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>

        {/* Note Snippet — inline editable */}
        <div className="hidden xl:block flex-1 max-w-[300px]">
          {isEditingNote ? (
            <textarea
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteSave}
              onKeyDown={handleNoteKeyDown}
              rows={2}
              placeholder="Write a note..."
              className="w-full bg-[#0e0e0e] border border-[#54e98a]/30 px-3 py-2 text-xs text-[#e5e2e1] placeholder:text-[#bbcbbb]/20 resize-none focus:outline-none focus:border-[#54e98a]/60 transition-colors"
            />
          ) : (
            <button
              onClick={handleNoteClick}
              title="Click to edit note"
              className="text-left w-full group/note"
            >
              <p className={cn(
                "text-xs font-medium italic line-clamp-1 leading-relaxed transition-colors",
                note ? "text-[#bbcbbb]/60 group-hover/note:text-[#bbcbbb]/90" : "text-[#bbcbbb]/20 group-hover/note:text-[#bbcbbb]/40"
              )}>
                {note || "Add a note..."}
              </p>
              <p className="text-[9px] font-black uppercase text-[#bbcbbb]/20 tracking-[0.1em] mt-1">
                {isSavingNote ? "SAVING..." : `SAVED ${savedDateStr}`}
              </p>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <DeckActionMenu
            deck={deck}
            folders={folders}
            tags={tags}
            onMoveToFolder={onMoveToFolder}
            onUpdateTags={onUpdateTags}
            onUnsave={onUnsave}
          />
        </div>
      </div>
    </motion.div>
  );
}
