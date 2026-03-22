import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GripVertical, FolderPlus } from "lucide-react";
import { SavedDeckOrganized, LibraryFolder, LibraryTag } from "../../types";
import { TagChip } from "./TagChip";
import { DeckActionMenu } from "./DeckActionMenu";
import { cn } from "../../utils/cn";

interface DocumentRowProps {
  deck: SavedDeckOrganized;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onMoveToFolder: (folderId: string | null) => void;
  onUpdateTags: (tagIds: string[]) => void;
  onUnsave: () => void;
  isUnsaving?: boolean;
}

export function DocumentRow({ 
  deck, 
  folders, 
  tags, 
  onMoveToFolder, 
  onUpdateTags, 
  onUnsave,
  isUnsaving 
}: DocumentRowProps) {
  const savedDate = new Date(deck.saved_at);
  const timeAgo = formatTimeAgo(savedDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "bg-[#161616] border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 group hover:border-[#54e98a]/20 transition-all",
        isUnsaving && "opacity-50 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-4 w-full flex-1">
        {/* Drag Handle */}
        <div className="text-[#bbcbbb]/10 group-hover:text-[#bbcbbb]/30 transition-colors pointer-events-none hidden md:block">
          <GripVertical size={20} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <Link
                to={`/${deck.user_handle}/${deck.slug}`}
                target="_blank"
                className="text-lg font-headline font-bold text-[#e5e2e1] hover:text-[#54e98a] transition-colors truncate"
              >
                {deck.title}
              </Link>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black uppercase text-[#bbcbbb]/30 tracking-widest">
              {deck.user_handle}
            </span>
            <span className="w-1 h-1 bg-[#bbcbbb]/10 rounded-full" />
            <span className="text-[10px] font-black uppercase text-[#bbcbbb]/30 tracking-widest">
              Interactive Deck
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="hidden lg:flex flex-wrap gap-2 max-w-[200px]">
          {deck.tags.map(tag => (
            <TagChip key={tag.id} tag={tag} />
          ))}
        </div>

        {/* Note Snippet */}
        <div className="hidden xl:block flex-1 max-w-[300px]">
          <p className="text-xs text-[#bbcbbb]/40 font-medium italic line-clamp-1 leading-relaxed">
            {deck.investor_note || "No analysis committed yet..."}
          </p>
          <p className="text-[9px] font-black uppercase text-[#bbcbbb]/20 tracking-[0.1em] mt-1">
            SAVED {timeAgo}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <button
            onClick={() => onMoveToFolder(null)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#bbcbbb]/60 hover:text-[#54e98a] hover:bg-[#54e98a]/10 hover:border-[#54e98a]/20 transition-all"
          >
            <FolderPlus size={14} />
            MOVE
          </button>
          
          <DeckActionMenu
            deck={deck}
            folders={folders}
            tags={tags}
            onMoveToFolder={onMoveToFolder}
            onUpdateTags={onUpdateTags}
            onUnsave={onUnsave}
          />
        </div>
      </div>
    </motion.div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = seconds / 31536000;

  if (interval > 1) return Math.floor(interval) + " YEARS AGO";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " MONTHS AGO";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " DAYS AGO";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " HOURS AGO";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " MINUTES AGO";
  return "JUST NOW";
}
