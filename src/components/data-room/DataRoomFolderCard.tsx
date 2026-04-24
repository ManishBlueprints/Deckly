import { memo } from "react";
import { Edit2, Folder, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { DataRoomFolderWithTags } from "../../types";
import { FOLDER_COLORS } from "../../constants/folderColors";
import { cn } from "../../utils/cn";
import { TagChip } from "../saved-decks/TagChip";

interface DataRoomFolderCardProps {
  folder?: DataRoomFolderWithTags;
  isNew?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  onEdit?: (folder: DataRoomFolderWithTags) => void;
  onDelete?: (folder: DataRoomFolderWithTags) => void;
  documentCount?: number;
}

const getColorHex = (color: string) =>
  FOLDER_COLORS.find((option) => option.key === color)?.hex ?? color;

export const DataRoomFolderCard = memo(function DataRoomFolderCard({
  folder,
  isNew,
  isActive,
  onClick,
  onEdit,
  onDelete,
  documentCount,
}: DataRoomFolderCardProps) {
  const folderColor = getColorHex(folder?.color ?? "#64748B");

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
        className="h-[190px] w-full bg-surface-card border border-dashed border-[#333] flex flex-col items-center justify-center gap-3 group hover:border-primary/30 transition-colors cursor-pointer rounded-md"
      >
        <div className="w-10 h-10 bg-surface-low flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
          <Folder size={20} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 group-hover:text-primary transition-colors">
          New Folder
        </span>
      </motion.div>
    );
  }

  if (!folder) return null;

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
        "h-[190px] w-full bg-surface-card border border-[#222] p-4 flex flex-col items-start text-left group transition-colors relative overflow-hidden cursor-pointer rounded-md",
        isActive && "border-primary/30",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeFolderLine"
          className="absolute top-0 left-0 w-full h-0.5 bg-primary"
        />
      )}

      <div className="mb-6 transition-colors">
        <Folder
          className="w-6 h-6"
          style={{ color: folderColor }}
          fill={folderColor}
        />
      </div>

      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(folder);
          }}
          aria-label="Edit folder"
          className="p-2 rounded-md bg-surface-low hover:bg-[#1a1a1a] text-slate-400 hover:text-white transition-colors"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(folder);
          }}
          aria-label="Delete folder"
          className="p-2 rounded-md bg-surface-low hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-2 flex-1">
        <h3 className="text-base font-semibold text-white leading-tight truncate">
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
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
              No Tags
            </span>
          )}
          {folder.tags.length > 4 && (
            <span className="text-[10px] font-semibold text-slate-500 uppercase ml-1">
              +{folder.tags.length - 4} More
            </span>
          )}
        </div>
      </div>

      <div className="pt-2.5 border-t border-[#222] w-full">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
          {documentCount ?? 0} Document{(documentCount ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
});
