import {
  GripVertical,
  FileText,
  FolderInput,
  Tag,
  Check,
  MoreVertical,
} from "lucide-react";
import { DataRoomDocument, DataRoomTag } from "../../types";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TagChip } from "../saved-decks/TagChip";
import { type DataRoomDocumentSearchResult } from "../../utils/metadataSearchAdapters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

const ROOM_DOCUMENT_ACTION_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-[4px] border transition-colors active:scale-95";

const ROOM_DOCUMENT_TAG_ACTION_CLASS =
  "border-ui-chart-3/25 bg-ui-chart-3/10 text-ui-chart-3 hover:border-ui-chart-3/40 hover:bg-ui-chart-3/15 hover:text-ui-chart-3";

const ROOM_DOCUMENT_FOLDER_ACTION_CLASS =
  "border-ui-info/25 bg-ui-info/10 text-ui-info hover:border-ui-info/40 hover:bg-ui-info/15 hover:text-ui-info";

interface RoomDocumentListProps {
  documents: DataRoomDocument[];
  documentMatchInfo?: Record<string, DataRoomDocumentSearchResult>;
  onRemove: (deckId: string) => void;
  onReorder: (orderedDeckIds: string[]) => void;
  folderOptions?: { id: string; name: string }[];
  onMoveToFolder?: (documentId: string, folderId: string | null) => void;
  onViewAnalytics?: (deckId: string) => void;
  onEditDeck?: (deckId: string) => void;
  availableTags?: DataRoomTag[];
  onUpdateDocumentTags?: (documentId: string, tagIds: string[]) => void;
  signedThumbnails?: Record<string, string>;
}

export function RoomDocumentList({
  documents,
  documentMatchInfo = {},
  onRemove,
  onReorder,
  folderOptions = [],
  onMoveToFolder,
  onViewAnalytics,
  onEditDeck,
  availableTags = [],
  onUpdateDocumentTags,
  signedThumbnails = {},
}: RoomDocumentListProps) {
  const navigate = useNavigate();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [tagFilterQuery, setTagFilterQuery] = useState("");
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragItemRef.current === null || dragItemRef.current === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const items = [...documents];
    const [moved] = items.splice(dragItemRef.current, 1);
    items.splice(index, 0, moved);

    onReorder(items.map((d) => d.deck_id));
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  };

  if (documents.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
      <div className="space-y-1 min-w-[500px] md:min-w-0">
        {documents.map((doc, index) => {
          const deck = doc.deck;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index;
          const signedUrl = signedThumbnails[doc.deck_id];
          const thumbnailUrl = signedUrl || deck?.pages?.[0]?.image_url;
          const currentTagIds = (doc.tags || []).map((tag) => tag.id);
          const matchedTagNames = documentMatchInfo[doc.id]?.matchedTagNames ?? [];
          const currentFolder =
            doc.folder_id === null
              ? null
              : folderOptions.find((folder) => folder.id === doc.folder_id) ?? null;
          const filteredTags = availableTags.filter((tag) =>
            tagFilterQuery.trim()
              ? tag.name.toLowerCase().includes(tagFilterQuery.trim().toLowerCase())
              : true,
          );

          return (
            <div
              key={doc.deck_id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`group flex items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                isDragging
                  ? "border-ui-primary/50 bg-ui-subtle opacity-40"
                  : isDragOver
                    ? "border-ui-primary bg-ui-subtle"
                    : "border-ui-border bg-ui-surface hover:border-ui-primary/30 hover:bg-ui-subtle"
              }`}
            >
              {/* Drag handle */}
              <div className="cursor-grab text-ui-muted transition-colors hover:text-ui-primary active:cursor-grabbing">
                <GripVertical size={18} />
              </div>

              {/* Order number */}
              <span className="w-6 shrink-0 text-center font-mono text-[10px] font-semibold text-ui-muted">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Thumbnail */}
              <div className="h-10 w-12 shrink-0 overflow-hidden rounded-md border border-ui-border bg-ui-subtle transition-colors group-hover:border-ui-primary/30">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={16} className="text-ui-muted" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-semibold text-ui-text transition-colors group-hover:text-ui-primary">
                  {deck?.title || "Untitled Asset"}
                </p>
                <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-ui-muted">
                  {deck?.pages?.length || 0} Slides
                </p>
                {matchedTagNames.length > 0 && (
                  <p className="mt-1 text-[11px] leading-relaxed text-ui-primary">
                    Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
                    {matchedTagNames.slice(0, 3).join(", ")}
                    {matchedTagNames.length > 3
                      ? ` +${matchedTagNames.length - 3} more`
                      : ""}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="text-ui-muted">Folder:</span>
                  <span className="max-w-[140px] truncate text-ui-text">
                    {currentFolder?.name ?? "Unorganized"}
                  </span>
                </div>
              </div>

              <div className="flex-1 min-w-0 px-4 flex items-center justify-center">
                {doc.tags && doc.tags.length > 0 ? (
                  <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5">
                    {doc.tags.slice(0, 3).map((tag) => (
                      <TagChip key={tag.id} tag={tag} className="px-2 py-0.5" />
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="text-[10px] font-semibold text-ui-muted">
                        +{doc.tags.length - 3} More
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold text-ui-muted">
                    No Tags
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {onUpdateDocumentTags && availableTags.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          ROOM_DOCUMENT_ACTION_CLASS,
                          ROOM_DOCUMENT_TAG_ACTION_CLASS,
                        )}
                        title={currentTagIds.length > 0 ? `${currentTagIds.length} tag(s) applied` : "Manage tags"}
                        aria-label={currentTagIds.length > 0 ? `Manage tags, ${currentTagIds.length} applied` : "Manage tags"}
                      >
                        <Tag size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-80 overflow-hidden border-ui-border bg-ui-elevated p-0 shadow-[var(--ui-shadow-overlay)]"
                      onEscapeKeyDown={() => setTagFilterQuery("")}
                    >
                      <div className="border-b border-ui-border bg-ui-subtle px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-ui-text">
                              Apply tags
                            </p>
                            <p className="mt-1 text-xs text-ui-muted">
                              {currentTagIds.length > 0
                                ? `${currentTagIds.length} selected`
                                : "Pick one or more tags"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateDocumentTags(doc.id, [])}
                            className="rounded-md border border-ui-border bg-ui-surface px-2.5 py-1.5 text-xs font-medium text-ui-muted transition-colors hover:bg-ui-elevated hover:text-ui-text"
                          >
                            Clear all
                          </button>
                        </div>

                        <div className="mt-3">
                          <input
                            value={tagFilterQuery}
                            onChange={(e) => setTagFilterQuery(e.target.value)}
                            placeholder="Search tags..."
                            className="w-full rounded-md border border-ui-border bg-ui-surface px-3 py-2 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
                          />
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                        {filteredTags.length === 0 ? (
                          <div className="px-3 py-8 text-center">
                            <p className="text-sm font-medium text-ui-text">
                              No tags found
                            </p>
                            <p className="mt-1 text-xs text-ui-muted">
                              Try a different search
                            </p>
                          </div>
                        ) : (
                          filteredTags.map((tag) => {
                            const isSelected = currentTagIds.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                  const nextIds = isSelected
                                    ? currentTagIds.filter((id) => id !== tag.id)
                                    : [...currentTagIds, tag.id];
                                  onUpdateDocumentTags(doc.id, nextIds);
                                }}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-all",
                                  isSelected
                                    ? "border-ui-primary/30 bg-ui-primary/10"
                                    : "border-transparent hover:border-ui-border hover:bg-ui-subtle",
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <TagChip tag={tag} size="md" className="shrink-0" />
                                    {isSelected && (
                                      <span className="text-[10px] font-semibold text-ui-primary">
                                        Applied
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {onMoveToFolder && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          ROOM_DOCUMENT_ACTION_CLASS,
                          ROOM_DOCUMENT_FOLDER_ACTION_CLASS,
                        )}
                        title="Move to folder"
                        aria-label="Move to folder"
                      >
                        <FolderInput size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onClick={() => onMoveToFolder(doc.id, null)}
                      >
                        Unorganized
                        {!doc.folder_id && <Check size={14} className="ml-auto" />}
                      </DropdownMenuItem>
                      {folderOptions.length > 0 && <DropdownMenuSeparator />}
                      {folderOptions.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => onMoveToFolder(doc.id, folder.id)}
                        >
                          {folder.name}
                          {doc.folder_id === folder.id && (
                            <Check size={14} className="ml-auto" />
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onRemove(doc.deck_id)}
                        className="text-ui-destructive focus:text-ui-destructive"
                      >
                        Remove from room
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-ui-border bg-ui-elevated text-ui-muted transition-colors hover:border-ui-primary/30 hover:text-ui-text"
                      title="Document actions"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onClick={() => {
                        if (onViewAnalytics) {
                          onViewAnalytics(doc.deck_id);
                          return;
                        }
                        navigate(`/analytics/${doc.deck_id}`);
                      }}
                    >
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        if (onEditDeck) {
                          onEditDeck(doc.deck_id);
                          return;
                        }
                        navigate(`/edit/${doc.deck_id}`);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onRemove(doc.deck_id)}
                      className="text-ui-destructive focus:text-ui-destructive"
                    >
                      Remove from data room
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
