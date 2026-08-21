import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LibraryFolder, LibraryTag, SavedDataRoomOrganized } from "../../types";
import { getDataRoomPath } from "../../utils/url";
import { useAuth } from "../../contexts/AuthContext";
import { LibraryActionMenu } from "./LibraryActionMenu";
import { SavedItemNoteCard } from "./SavedItemNoteCard";
import { SavedLibraryItemRow } from "./SavedLibraryItemRow";
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
  const effectiveHandle =
    room.room_owner_handle && room.room_owner_handle !== "unknown"
      ? room.room_owner_handle
      : room.room_handle && room.room_handle !== "unknown"
        ? room.room_handle
        : null;
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

  const savedRoomHref = effectiveHandle
    ? getDataRoomPath(effectiveHandle, room.slug)
    : null;

  return (
    <SavedLibraryItemRow
      title={room.title}
      href={savedRoomHref}
      creator={effectiveHandle || "Unknown owner"}
      type="Room"
      folder={currentFolder}
      tags={room.tags}
      savedDateLabel={savedDateStr}
      matchedTagNames={matchedTagNames}
      unavailable={Boolean(room.is_deleted)}
      className={unsaveMutation.isPending ? "pointer-events-none opacity-50" : undefined}
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
              title: room.title,
              folder_id: room.folder_id,
              tags: room.tags,
            }}
            folders={folders}
            tags={tags}
            openLabel="Open Room"
            openAction={() => {
              if (room.data_room_id && effectiveHandle !== null && savedRoomHref) {
                window.open(savedRoomHref, "_blank", "noopener,noreferrer");
              }
            }}
            unsaveLabel="Remove from Saved"
            unsaveDescription={`Are you sure you want to remove "${room.title}" from your saved rooms? Your private note will stay saved for later.`}
            onMoveToFolder={(folderId) => moveFolderMutation.mutate(folderId)}
            onUnsave={() => unsaveMutation.mutate()}
          />
      }
    />
  );
});
