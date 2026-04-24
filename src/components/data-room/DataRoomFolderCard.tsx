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
        className="h-[240px] w-full bg-transparent border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-4 group hover:border-[#54e98a]/30 transition-all cursor-pointer"
      >
        <div className="w-12 h-12 bg-white/5 flex items-center justify-center text-[#bbcbbb]/20 group-hover:text-[#54e98a] group-hover:bg-[#54e98a]/10 transition-all">
          <Folder size={20} className="text-[#54e98a]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/30 group-hover:text-[#54e98a]/60">
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
        "h-[240px] w-full bg-surface-card border border-white/5 p-8 flex flex-col items-start text-left group transition-all relative overflow-hidden cursor-pointer",
        isActive &&
          "ring-2 ring-[#54e98a]/40 border-[#54e98a]/20 shadow-[0_0_40px_rgba(84,233,138,0.1)]",
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeFolderLine"
          className="absolute top-0 left-0 w-full h-1 bg-[#54e98a]"
        />
      )}

      <div className="mb-10 transition-transform group-hover:scale-110">
        <Folder
          className="w-8 h-8"
          style={{ color: folderColor }}
          fill={folderColor}
        />
      </div>

      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(folder);
          }}
          aria-label="Edit folder"
          className="p-2 bg-white/5 hover:bg-white/10 text-[#bbcbbb]/40 hover:text-white focus-visible:text-white focus-visible:bg-white/10 transition-colors"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(folder);
          }}
          aria-label="Delete folder"
          className="p-2 bg-white/5 hover:bg-red-500/20 text-[#bbcbbb]/40 hover:text-red-400 focus-visible:text-red-400 focus-visible:bg-red-500/20 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-4 flex-1">
        <h3 className="text-xl font-headline font-bold text-white leading-tight group-hover:text-[#54e98a] transition-colors">
          {folder.name}
        </h3>

        <div className="flex flex-wrap gap-1.5 mt-auto pt-4">
          {folder.tags.slice(0, 2).map((tag) => {
            return (
              <TagChip
                key={tag.id}
                tag={tag}
                className="px-2 py-0.5 text-[9px]"
              />
            );
          })}
          {folder.tags.length === 0 && (
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#bbcbbb]/20">
              No Tags
            </span>
          )}
          {folder.tags.length > 2 && (
            <span className="text-[8px] font-bold text-[#bbcbbb]/20 uppercase ml-1">
              +{folder.tags.length - 2} More
            </span>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 w-full">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#bbcbbb]/20">
          {documentCount ?? 0} Document{(documentCount ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
});
