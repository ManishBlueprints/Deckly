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
import { cn } from "../../utils/cn";

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
              className={`flex items-center gap-4 px-4 py-3 rounded-md border transition-all duration-300 group ${
                isDragging
                  ? "opacity-40 border-primary/50 bg-[#2B2B2B]"
                  : isDragOver
                    ? "border-white/10 bg-surface-card scale-[1.01]"
                    : "bg-[#2B2B2B] border-white/5 hover:border-primary/30"
              }`}
            >
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-deckly-primary transition-colors">
                <GripVertical size={18} />
              </div>

              {/* Order number */}
              <span className="text-[10px] font-semibold text-slate-500 w-6 text-center shrink-0 uppercase tracking-wider">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Thumbnail */}
              <div className="w-12 h-10 rounded-md bg-background border border-white/10 overflow-hidden shrink-0 group-hover:border-deckly-primary/30 transition-all">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={16} className="text-slate-700" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate group-hover:text-deckly-primary transition-colors">
                  {deck?.title || "Untitled Asset"}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5 whitespace-nowrap">
                  {deck?.pages?.length || 0} Slides
                </p>
                {matchedTagNames.length > 0 && (
                  <p className="mt-1 text-[11px] text-emerald-400 leading-relaxed">
                    Matched by tag{matchedTagNames.length > 1 ? "s" : ""}:{" "}
                    {matchedTagNames.slice(0, 3).join(", ")}
                    {matchedTagNames.length > 3
                      ? ` +${matchedTagNames.length - 3} more`
                      : ""}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="text-slate-600">Folder:</span>
                  <span className="text-slate-300 truncate max-w-[140px]">
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
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        +{doc.tags.length - 3} More
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
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
                        className="w-8 h-8 flex items-center justify-center bg-background border border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/20 rounded-md transition-all active:scale-95"
                        title={currentTagIds.length > 0 ? `${currentTagIds.length} tag(s) applied` : "Manage tags"}
                      >
                        <Tag size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-80 p-0 overflow-hidden border-white/10 bg-[#151515] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
                      onEscapeKeyDown={() => setTagFilterQuery("")}
                    >
                      <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/40">
                              Apply tags
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {currentTagIds.length > 0
                                ? `${currentTagIds.length} selected`
                                : "Pick one or more tags"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onUpdateDocumentTags(doc.id, [])}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-300 transition-colors hover:border-white/20 hover:text-white"
                          >
                            Clear all
                          </button>
                        </div>

                        <div className="mt-3">
                          <input
                            value={tagFilterQuery}
                            onChange={(e) => setTagFilterQuery(e.target.value)}
                            placeholder="Search tags..."
                            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                        {filteredTags.length === 0 ? (
                          <div className="px-3 py-8 text-center">
                            <p className="text-sm font-medium text-slate-400">
                              No tags found
                            </p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-slate-600">
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
                                    ? "border-emerald-500/25 bg-emerald-500/10"
                                    : "border-transparent hover:border-white/10 hover:bg-white/[0.04]",
                                )}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <TagChip tag={tag} size="md" className="shrink-0" />
                                    {isSelected && (
                                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
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
                        className="w-8 h-8 flex items-center justify-center bg-background border border-white/10 text-slate-400 hover:text-white hover:border-white/20 rounded-md transition-all active:scale-95"
                        title="Move to folder"
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
                        className="text-red-400 focus:text-red-400"
                      >
                        Remove from room
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-8 h-8 flex items-center justify-center bg-background border border-white/10 text-slate-400 hover:text-white hover:border-white/20 rounded-md transition-all active:scale-95"
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
                      className="text-red-400 focus:text-red-400"
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
