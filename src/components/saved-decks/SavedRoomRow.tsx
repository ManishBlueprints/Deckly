import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LibraryFolder, LibraryTag, SavedDataRoomOrganized } from "../../types";
import { cn } from "../../utils/cn";
import { getDataRoomPath } from "../../utils/url";
import { useAuth } from "../../contexts/AuthContext";
import { TagChip } from "./TagChip";
import { LibraryActionMenu } from "./LibraryActionMenu";
import { SavedItemNoteCard } from "./SavedItemNoteCard";
import {
  useDataRoomNotes,
  useSaveDataRoomNoteMutation,
} from "../../hooks/useDataRoomViewerQueries";
import { dataRoomLibraryService } from "../../services/dataRoomLibraryService";

interface SavedRoomRowProps {
  room: SavedDataRoomOrganized;
  folders: LibraryFolder[]; 
  tags: LibraryTag[];
  matchedTagNames?: string[];
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
  matchedTagNames = [],
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
  const roomHandle = room.room_owner_handle || room.room_handle;
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

  const savedRoomHref = roomHandle
    ? getDataRoomPath(roomHandle, room.slug)
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
                  Saved Room
                </span>
                {room.is_deleted && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 border border-amber-500/30 text-amber-400">
                    Deleted
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-[#bbcbbb]/30 tracking-widest">
                  {roomHandle}
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
              {matchedTagNames.length > 0 && (
                <p className="mt-2 text-[11px] text-[#54e98a] leading-relaxed">
                  Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
                  {matchedTagNames.slice(0, 3).join(", ")}
                  {matchedTagNames.length > 3
                    ? ` +${matchedTagNames.length - 3} more`
                    : ""}
                </p>
              )}
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
              if (room.data_room_id && roomHandle) {
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
