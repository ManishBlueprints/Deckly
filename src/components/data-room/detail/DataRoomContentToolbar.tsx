import { Filter, FolderInput, FolderOpen, Plus, Search, Tag } from "lucide-react";

interface DataRoomContentToolbarProps {
  onNewDeck: () => void;
  onAddExisting: () => void;
  onNewFolder: () => void;
  onEditTags: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function DataRoomContentToolbar({
  onNewDeck,
  onAddExisting,
  onNewFolder,
  onEditTags,
  search,
  onSearchChange,
}: DataRoomContentToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-[280px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents..."
            className="h-10 w-full rounded-md border border-border bg-surface-low pl-11 pr-4 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40"
          />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-border hover:bg-surface-high sm:w-auto">
            <Filter size={16} />
            Filter
          </button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground hover:border-border hover:bg-surface-high sm:w-auto">
            Sort
          </button>
        </div>
      </div>
    </div>
  );
}
