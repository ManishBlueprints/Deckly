import type { ReactNode } from "react";
import { FolderInput, FolderOpen, Plus, Tag } from "lucide-react";

interface DataRoomContentToolbarProps {
  onNewDeck: () => void;
  onAddExisting: () => void;
  onNewFolder: () => void;
  onEditTags: () => void;
  searchControl: ReactNode;
}

export function DataRoomContentToolbar({
  onNewDeck,
  onAddExisting,
  onNewFolder,
  onEditTags,
  searchControl,
}: DataRoomContentToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
        <button
          onClick={onNewDeck}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <Plus size={16} />
          New Deck
        </button>
        <button
          onClick={onAddExisting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-border hover:bg-surface-high sm:w-auto"
        >
          <FolderInput size={16} />
          Add Existing
        </button>
        <button
          onClick={onNewFolder}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-border hover:bg-surface-high sm:w-auto"
        >
          <FolderOpen size={16} />
          New Folder
        </button>
        <button
          onClick={onEditTags}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-border hover:bg-surface-high sm:w-auto"
        >
          <Tag size={16} />
          Edit Tags
        </button>
      </div>

        <div className="flex w-full justify-end xl:w-auto">{searchControl}</div>
      </div>
    </div>
  );
}
