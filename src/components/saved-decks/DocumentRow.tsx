import { memo, useState, useEffect, useRef } from "react";
import { SavedDeckOrganized, LibraryFolder, LibraryTag } from "../../types";
import { LibraryActionMenu } from "./LibraryActionMenu";
import { SavedItemNoteCard } from "./SavedItemNoteCard";
import { SavedLibraryItemRow } from "./SavedLibraryItemRow";
import { toast } from "sonner";

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
  const currentFolder = folders.find((folder) => folder.id === deck.folder_id);

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

  return (
    <SavedLibraryItemRow
      title={deck.title}
      href={`/${deck.user_handle}/${deck.slug}`}
      creator={deck.user_handle || "Unknown creator"}
      type="Deck"
      folder={currentFolder}
      tags={deck.tags}
      savedDateLabel={savedDateStr}
      matchedTagNames={matchedTagNames}
      className={isUnsaving ? "pointer-events-none opacity-50" : undefined}
      note={<SavedItemNoteCard
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
          compact
        />}
      actions={<LibraryActionMenu
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
      }
    />
  );
});
