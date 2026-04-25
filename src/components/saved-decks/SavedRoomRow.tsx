import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LibraryFolder, LibraryTag, SavedDataRoomOrganized } from "../../types";
import { cn } from "../../utils/cn";
import { getDataRoomPath } from "../../utils/url";
import { useAuth } from "../../contexts/AuthContext";
import { TagChip } from "./TagChip";
import { LibraryActionMenu } from "./LibraryActionMenu";
import {
  useDataRoomNotes,
  useSaveDataRoomNoteMutation,
} from "../../hooks/useDataRoomViewerQueries";
import { dataRoomLibraryService } from "../../services/dataRoomLibraryService";

interface SavedRoomRowProps {
  room: SavedDataRoomOrganized;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onUnsave: () => void;
}

function formatSavedDate(date: Date): string {
  return date
    .toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

export const SavedRoomRow = memo(function SavedRoomRow({
  room,
  folders,
  tags,
  onUnsave,
}: SavedRoomRowProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(room.investor_note || "");
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveJustCompletedRef = useRef(false);

  const savedDateStr = formatSavedDate(new Date(room.saved_at));
  const currentFolder = folders.find((folder) => folder.id === room.folder_id);
  const { data: initialNote } = useDataRoomNotes(
    room.data_room_id || undefined,
    session?.user?.id,
  );
  const saveNoteMutation = useSaveDataRoomNoteMutation(session?.user?.id);

  const unsaveMutation = useMutation({
    mutationFn: async () => {
      if (!room.data_room_id) return;
      await dataRoomLibraryService.removeFromLibrary(room.data_room_id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["saved-data-rooms", session?.user?.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["data-room-saved", room.data_room_id, session?.user?.id],
      });
      onUnsave();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove room from saved.",
      );
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async (folderId: string | null) => {
      if (!room.library_id) return;
      await dataRoomLibraryService.updateRoomFolder(room.library_id, folderId);
    },
    onMutate: async (folderId: string | null) => {
      if (!session?.user?.id) return {};

      const queryKey = ["saved-data-rooms", session.user.id];
      await queryClient.cancelQueries({ queryKey });
      const previousRooms = queryClient.getQueryData<SavedDataRoomOrganized[]>(queryKey);
      queryClient.setQueryData<SavedDataRoomOrganized[]>(queryKey, (prev) =>
        (prev ?? []).map((savedRoom) =>
          savedRoom.library_id === room.library_id
            ? { ...savedRoom, folder_id: folderId }
            : savedRoom,
        ),
      );
      return { previousRooms, queryKey };
    },
    onError: (err, _folderId, context) => {
      if (context?.queryKey && context.previousRooms) {
        queryClient.setQueryData(context.queryKey, context.previousRooms);
      }
      toast.error(err instanceof Error ? err.message : "Failed to move room.");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["saved-data-rooms", session?.user?.id],
      });
    },
  });

  const updateTagsMutation = useMutation({
    mutationFn: async (tagIds: string[]) => {
      if (!room.library_id) return;
      await dataRoomLibraryService.updateRoomTags(room.library_id, tagIds);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["saved-data-rooms", session?.user?.id],
      });
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to update room tags.",
      );
    },
  });

  useEffect(() => {
    if (initialNote !== undefined) {
      setNote(initialNote);
    }
  }, [initialNote]);

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
      setNote(initialNote || "");
    }
  }, [initialNote, isEditingNote]);

  const handleNoteClick = () => {
    setIsEditingNote(true);
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const handleNoteSave = async () => {
    if (!room.data_room_id) {
      setIsEditingNote(false);
      return;
    }

    if (note === (initialNote || "")) {
      setIsEditingNote(false);
      return;
    }

    setIsSavingNote(true);
    try {
      await saveNoteMutation.mutateAsync({
        dataRoomId: room.data_room_id,
        content: note,
      });
      saveJustCompletedRef.current = true;
    } catch (err) {
      toast.error("Failed to save note", {
        description: err instanceof Error ? err.message : String(err),
      });
      setNote(initialNote || "");
    } finally {
      setIsSavingNote(false);
      setIsEditingNote(false);
    }
  };

  const handleNoteDiscard = () => {
    setNote(initialNote || "");
    setIsEditingNote(false);
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNoteSave();
    }
    if (e.key === "Escape") {
      setNote(initialNote || "");
      setIsEditingNote(false);
    }
  };

  const savedRoomHref = room.room_handle
    ? getDataRoomPath(room.room_handle, room.slug)
    : "#";

  return (
    <motion.div
      className={cn(
        "bg-surface-card border border-white/5 p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-[#54e98a]/20 transition-all",
        unsaveMutation.isPending && "opacity-50 pointer-events-none",
      )}
    >
      <div className="w-full flex flex-col xl:flex-row xl:items-center gap-4 sm:gap-5">
        <div className="hidden md:block shrink-0 text-[#bbcbbb]/10 group-hover:text-[#bbcbbb]/30 transition-colors pointer-events-none">
          <GripVertical size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  to={savedRoomHref}
                  className="text-lg font-headline font-bold text-[#e5e2e1] hover:text-[#54e98a] transition-colors truncate"
                >
                  {room.title}
                </Link>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border border-white/10 text-[#bbcbbb]/40">
                  Room
                </span>
                {room.is_deleted && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border border-amber-500/30 text-amber-400">
                    Deleted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-[#bbcbbb]/30 tracking-widest">
                  {room.room_handle}
                </span>
                <span className="w-1 h-1 bg-[#bbcbbb]/10 rounded-full" />
                <span className="text-[10px] font-bold uppercase text-[#bbcbbb]/30 tracking-widest">
                  Saved {savedDateStr}
                </span>
                {currentFolder && (
                  <>
                    <span className="w-1 h-1 bg-[#bbcbbb]/10 rounded-full" />
                    <span className="text-[10px] font-bold uppercase text-[#54e98a] tracking-widest">
                      Folder {currentFolder.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {room.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {room.tags.map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
            </div>
          )}
        </div>

        <div className="w-full xl:w-[420px] xl:flex-none xl:mx-auto">
          <div className="rounded-xl border border-[#e6d8b0]/12 bg-[#11100d]/20 px-2.5 py-2.5 sm:px-3 sm:py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.24em] text-[#e8d9af]/70">
                  Note
                </span>
              </div>
              <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-[0.16em] text-[#bbcbbb]/20">
                {isSavingNote ? "Saving..." : `Saved ${savedDateStr}`}
              </span>
            </div>

            <div className="mt-1.5 sm:mt-2">
              {isEditingNote ? (
                <div>
                  <textarea
                    ref={textareaRef}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={handleNoteSave}
                    onKeyDown={handleNoteKeyDown}
                    rows={3}
                    placeholder="Write a note..."
                    className="w-full rounded-lg border border-[#e6d8b0]/20 bg-[#120f0b]/65 px-2.5 py-2 text-[11px] sm:text-xs text-[#f3ead0] placeholder:text-[#f3ead0]/30 resize-none outline-none focus:border-[#e6d8b0]/40 transition-colors"
                  />
                </div>
              ) : (
                <button
                  onClick={handleNoteClick}
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
                    {note || "Add a note..."}
                  </p>
                </button>
              )}
            </div>
            {isEditingNote && (
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
                  <span className="hidden sm:inline text-[#bbcbbb]/18">
                    {note.length}/1000
                  </span>
                  <button
                    type="button"
                    onClick={handleNoteDiscard}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-white/10 bg-transparent px-3 text-[10px] font-medium text-[#d9d2c5] transition-colors hover:border-white/20 hover:bg-white/5 hover:text-[#f0ebe3]"
                    title="Discard note changes"
                  >
                    <X size={10} />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNoteSave}
                    disabled={isSavingNote}
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

        <div className="shrink-0 flex items-center gap-2 justify-end self-start xl:self-auto">
          <LibraryActionMenu
            item={{
              title: room.title,
              folder_id: room.folder_id,
              tags: room.tags,
            }}
            folders={folders}
            tags={tags}
            openLabel="Open Room"
            openAction={() => {
              if (room.data_room_id && room.room_handle) {
                window.open(savedRoomHref, "_blank", "noopener,noreferrer");
              }
            }}
            unsaveLabel="Remove from Saved"
            unsaveDescription={`Are you sure you want to remove "${room.title}" from your saved rooms? Your private note will stay saved for later.`}
            onMoveToFolder={(folderId) => moveFolderMutation.mutate(folderId)}
            onUpdateTags={(tagIds) => updateTagsMutation.mutate(tagIds)}
            onUnsave={() => unsaveMutation.mutate()}
          />
        </div>

      </div>
    </motion.div>
  );
});
