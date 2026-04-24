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
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onNewDeck}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
        >
          <Plus size={16} />
          New Deck
        </button>
        <button
          onClick={onAddExisting}
          className="inline-flex items-center gap-2 rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:border-[#444]"
        >
          <FolderInput size={16} />
          Add Existing
        </button>
        <button
          onClick={onNewFolder}
          className="inline-flex items-center gap-2 rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:border-[#444]"
        >
          <FolderOpen size={16} />
          New Folder
        </button>
        <button
          onClick={onEditTags}
          className="inline-flex items-center gap-2 rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:border-[#444]"
        >
          <Tag size={16} />
          Edit Tags
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search documents..."
            className="h-10 w-[280px] rounded-md border border-[#333] bg-surface-low pl-11 pr-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/40"
          />
        </label>
        <button className="inline-flex items-center gap-2 rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:border-[#444]">
          <Filter size={16} />
          Filter
        </button>
        <button className="inline-flex items-center gap-2 rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:text-white hover:border-[#444]">
          Sort
        </button>
      </div>
    </div>
  );
}
