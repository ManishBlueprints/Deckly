
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuCheckboxItem,
} from "../ui/dropdown-menu";
import { LibraryFolder, LibraryTag, SavedDeckOrganized } from "../../types";
import { cn } from "../../utils/cn";

interface DeckActionMenuProps {
  deck: SavedDeckOrganized;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  onMoveToFolder: (folderId: string | null) => void;
  onUpdateTags: (tagIds: string[]) => void;
  onUnsave: () => void;
}

export function DeckActionMenu({
  deck,
  folders,
  tags,
  onMoveToFolder,
  onUpdateTags,
  onUnsave,
}: DeckActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="p-2.5 bg-[#1c1b1b] border border-[#3d4a3e]/10 text-[#bbcbbb]/40 hover:text-[#54e98a] rounded-xl transition-all shadow-xl outline-none group-focus-within:border-[#54e98a]/30">
        <span className="material-symbols-outlined text-lg">more_vert</span>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64 bg-[#0e0e0e] border-[#1c1b1b] rounded-2xl p-2 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] font-headline">
        <DropdownMenuLabel className="text-[#bbcbbb]/20 text-[10px] uppercase font-black tracking-[0.2em] px-4 py-3">
          Document Control
        </DropdownMenuLabel>
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-[#e5e2e1] data-[highlighted]:bg-[#54e98a]/10 data-[highlighted]:text-[#54e98a] data-[state=open]:bg-[#54e98a]/10 cursor-pointer rounded-xl px-4 py-3 transition-colors flex items-center gap-3">
            <span className="material-symbols-outlined text-lg opacity-40">drive_file_move</span>
            <span className="font-bold text-sm">Transfer to Collection</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-[#0e0e0e] border-[#1c1b1b] min-w-[200px] rounded-2xl p-2 shadow-2xl font-headline">
              <DropdownMenuItem 
                onClick={() => onMoveToFolder(null)}
                className={cn(
                  "text-[#bbcbbb]/60 data-[highlighted]:bg-[#54e98a]/10 data-[highlighted]:text-[#54e98a] cursor-pointer flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
                  !deck.folder_id && "text-[#54e98a] bg-[#54e98a]/5 font-bold"
                )}
              >
                <span className="text-sm font-bold">Standalone</span>
                {!deck.folder_id && <span className="material-symbols-outlined text-sm">check</span>}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#1c1b1b] my-2" />
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onClick={() => onMoveToFolder(folder.id)}
                  className={cn(
                    "text-[#bbcbbb]/60 data-[highlighted]:bg-[#54e98a]/10 data-[highlighted]:text-[#54e98a] cursor-pointer flex items-center justify-between rounded-xl px-4 py-3 transition-colors",
                    deck.folder_id === folder.id && "text-[#54e98a] bg-[#54e98a]/5 font-bold"
                  )}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div 
                      className="w-2 h-2 rounded-full shrink-0" 
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="truncate text-sm font-bold">{folder.name}</span>
                  </div>
                  {deck.folder_id === folder.id && <span className="material-symbols-outlined text-sm">check</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="text-[#e5e2e1] data-[highlighted]:bg-[#54e98a]/10 data-[highlighted]:text-[#54e98a] data-[state=open]:bg-[#54e98a]/10 cursor-pointer rounded-xl px-4 py-3 transition-colors flex items-center gap-3">
            <span className="material-symbols-outlined text-lg opacity-40">sell</span>
            <span className="font-bold text-sm">Manage Categorization</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-[#0e0e0e] border-[#1c1b1b] min-w-[200px] rounded-2xl p-2 shadow-2xl font-headline">
              {tags.map((tag) => {
                const isSelected = deck.tags.some(t => t.id === tag.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={isSelected}
                    onCheckedChange={(checked: boolean) => {
                      const newTagIds = checked 
                        ? [...deck.tags.map(t => t.id), tag.id]
                        : deck.tags.filter(t => t.id !== tag.id).map(t => t.id);
                      onUpdateTags(newTagIds);
                    }}
                    onSelect={(e: Event) => e.preventDefault()}
                    className="text-[#bbcbbb]/60 data-[highlighted]:bg-[#1c1b1b] data-[highlighted]:text-white cursor-pointer rounded-xl px-4 py-3 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                       <span 
                         className="w-2 h-2 rounded-full" 
                         style={{ backgroundColor: tag.color }}
                       />
                       <span className="text-sm font-bold">{tag.name}</span>
                    </div>
                  </DropdownMenuCheckboxItem>
                );
              })}
              {tags.length === 0 && (
                 <div className="px-4 py-3 text-xs text-[#bbcbbb]/20 italic font-medium">
                   No labels established
                 </div>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator className="bg-[#1c1b1b] my-2" />
        
        <DropdownMenuItem 
          onClick={onUnsave}
          className="text-[#ff4d4d]/60 data-[highlighted]:bg-[#ff4d4d]/10 data-[highlighted]:text-[#ff4d4d] cursor-pointer rounded-xl px-4 py-3 transition-colors flex items-center gap-3"
        >
          <span className="material-symbols-outlined text-lg">bookmark_remove</span>
          <span className="font-bold text-sm">Remove from Saved</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
