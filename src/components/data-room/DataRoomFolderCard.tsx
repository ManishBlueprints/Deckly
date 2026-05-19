import { memo, useEffect, useState } from "react";
import { Edit2, Folder, Tag, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { DataRoomFolderWithTags, DataRoomTag } from "../../types";
import { FOLDER_COLORS } from "../../constants/folderColors";
import { cn } from "../../utils/cn";
import { TagChip } from "../saved-decks/TagChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface DataRoomFolderCardProps {
  folder?: DataRoomFolderWithTags;
  isNew?: boolean;
  isActive?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onEdit?: (folder: DataRoomFolderWithTags) => void;
  availableTags?: DataRoomTag[];
  onUpdateTags?: (folder: DataRoomFolderWithTags, tagIds: string[]) => Promise<void> | void;
  onDelete?: (folder: DataRoomFolderWithTags) => void;
  documentCount?: number;
}

const getColorHex = (color: string) =>
  FOLDER_COLORS.find((option) => option.key === color)?.hex ?? color;

export const DataRoomFolderCard = memo(function DataRoomFolderCard({
  folder,
  isNew,
  isActive,
  compact,
  onClick,
  onEdit,
  availableTags = [],
  onUpdateTags,
  onDelete,
  documentCount,
}: DataRoomFolderCardProps) {
  const [tagFilterQuery, setTagFilterQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const folderColor = getColorHex(folder?.color ?? "#64748B");

  useEffect(() => {
    setSelectedTagIds(folder?.tags.map((tag) => tag.id) ?? []);
  }, [folder]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  };

  if (isNew) {
    return (
      <motion.div
        role="button"
        tabIndex={0}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className={compact
          ? "h-[160px] w-full bg-surface-card border border-dashed border-border flex flex-col items-center justify-center gap-2.5 group hover:border-border hover:bg-surface-high transition-colors cursor-pointer rounded-md"
          : "h-[190px] w-full bg-surface-card border border-dashed border-border flex flex-col items-center justify-center gap-3 group hover:border-border hover:bg-surface-high transition-colors cursor-pointer rounded-md"
        }
      >
        <div className={compact
          ? "w-9 h-9 bg-surface-low flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors"
          : "w-10 h-10 bg-surface-low flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors"
        }>
          <Folder size={compact ? 18 : 20} />
        </div>
        <span className={compact
          ? "text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-primary transition-colors"
          : "text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground group-hover:text-primary transition-colors"
        }>
          New Folder
        </span>
      </motion.div>
    );
  }

  if (!folder) return null;
  const filteredTags = availableTags.filter((tag) =>
    tagFilterQuery.trim()
      ? tag.name.toLowerCase().includes(tagFilterQuery.trim().toLowerCase())
      : true,
  );

  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ y: -2 }}
      whileTap={{ y: 0 }}
      transition={{ duration: 0.1 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
        className={cn(
          compact
            ? "h-[160px] w-full bg-surface-card border border-border p-3.5 flex flex-col items-start text-left group transition-colors relative overflow-hidden cursor-pointer rounded-md"
            : "h-[190px] w-full bg-surface-card border border-border p-4 flex flex-col items-start text-left group transition-colors relative overflow-hidden cursor-pointer rounded-md",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeFolderLine"
          className="absolute top-0 left-0 w-full h-0.5 bg-primary"
        />
      )}

      <div className={compact ? "mb-4 transition-colors" : "mb-6 transition-colors"}>
        <Folder
          className={compact ? "w-5 h-5" : "w-6 h-6"}
          style={{ color: folderColor }}
          fill={folderColor}
        />
      </div>

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        {onUpdateTags && availableTags.length > 0 && (
          <DropdownMenu onOpenChange={(open) => !open && setTagFilterQuery("")}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="Edit folder tags"
                className="p-2 rounded-md bg-surface-low hover:bg-surface-high text-muted-foreground hover:text-foreground transition-colors"
              >
                <Tag size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-80 p-0 overflow-hidden border-white/10 bg-[#151515] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
              onEscapeKeyDown={() => setTagFilterQuery("")}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/40">
                      Apply tags
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {selectedTagIds.length > 0
                        ? `${selectedTagIds.length} selected`
                        : "Pick one or more tags"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const previousTagIds = selectedTagIds;
                      setSelectedTagIds([]);
                      void Promise.resolve(onUpdateTags(folder, [])).catch(() => {
                        setSelectedTagIds(previousTagIds);
                      });
                    }}
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
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          setSelectedTagIds((prev) => {
                            const nextIds = prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id];

                            void Promise.resolve(onUpdateTags(folder, nextIds)).catch(() => {
                              setSelectedTagIds(prev);
                            });

                            return nextIds;
                          });
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(folder);
          }}
          aria-label="Edit folder"
          className="p-2 rounded-md bg-surface-low hover:bg-surface-high text-muted-foreground hover:text-foreground transition-colors"
        >
          <Edit2 size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(folder);
          }}
          aria-label="Delete folder"
          className="p-2 rounded-md bg-surface-low hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-2 flex-1">
        <h3 className={compact
          ? "text-sm font-semibold text-foreground leading-tight truncate"
          : "text-base font-semibold text-foreground leading-tight truncate"
        }>
          {folder.name}
        </h3>

        <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
          {folder.tags.slice(0, 4).map((tag) => {
            return (
              <TagChip
                key={tag.id}
                tag={tag}
                className="px-2 py-0.5 text-[9px]"
              />
            );
          })}
          {folder.tags.length === 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              No Tags
            </span>
          )}
          {folder.tags.length > 4 && (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase ml-1">
              +{folder.tags.length - 4} More
            </span>
          )}
        </div>
      </div>

      <div className={compact ? "pt-2 border-t border-border w-full" : "pt-2.5 border-t border-border w-full"}>
        <span className={compact
          ? "text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
          : "text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
        }>
          {documentCount ?? 0} Document{(documentCount ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
});
