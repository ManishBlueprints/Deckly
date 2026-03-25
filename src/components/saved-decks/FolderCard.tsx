import { Folder, Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { LibraryFolder } from "../../types";
import { cn } from "../../utils/cn";
import { TagChip } from "./TagChip";

interface FolderCardProps {
  folder?: LibraryFolder;
  isNew?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  onEdit?: (folder: LibraryFolder) => void;
  onDelete?: (folder: LibraryFolder) => void;
}

export function FolderCard({
  folder,
  isNew,
  onClick,
  isActive,
  onEdit,
  onDelete,
}: FolderCardProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
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
          <span className="material-symbols-outlined text-2xl">
            create_new_folder
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#bbcbbb]/30 group-hover:text-[#54e98a]/60">
          New Collection
        </span>
      </motion.div>
    );
  }

  if (!folder) return null;

  return (
    <motion.div
      role="button"
      tabIndex={0}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-[240px] w-full bg-[#161616] border border-white/5 p-8 flex flex-col items-start text-left group transition-all relative overflow-hidden cursor-pointer",
        isActive &&
          "ring-2 ring-[#54e98a]/40 border-[#54e98a]/20 shadow-[0_0_40px_rgba(84,233,138,0.1)]",
      )}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <motion.div
          layoutId="activeFolderLine"
          className="absolute top-0 left-0 w-full h-1 bg-[#54e98a]"
        />
      )}

      <div className="mb-10 transition-transform group-hover:scale-110">
        <Folder
          className="w-8 h-8"
          style={{ color: folder.color }}
          fill={folder.color}
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
          {folder.tags.slice(0, 2).map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
          {folder.tags.length > 2 && (
            <span className="text-[8px] font-black text-[#bbcbbb]/20 uppercase ml-1">
              +{folder.tags.length - 2} More
            </span>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 w-full">
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/20">
          {folder.deck_count} Document{folder.deck_count !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
}
