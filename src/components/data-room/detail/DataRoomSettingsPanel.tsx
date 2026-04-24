interface DataRoomSettingsPanelProps {
  isPublic: boolean;
  onTogglePublic: () => void;
  onEditRoom: () => void;
  onDeleteRoom: () => void;
  shareUrlLabel: string;
}

export function DataRoomSettingsPanel({
  isPublic,
  onTogglePublic,
  onEditRoom,
  onDeleteRoom,
  shareUrlLabel,
}: DataRoomSettingsPanelProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border border-[#222] bg-surface-card p-5 space-y-4">
        <h3 className="text-base font-semibold text-white">Sharing</h3>
        <p className="text-sm text-slate-400">{shareUrlLabel}</p>
        <button
          onClick={onTogglePublic}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
        >
          {isPublic ? "Make Private" : "Make Public"}
        </button>
      </div>

      <div className="rounded-lg border border-[#222] bg-surface-card p-5 space-y-4">
        <h3 className="text-base font-semibold text-white">Room Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onEditRoom}
            className="rounded-md border border-[#333] bg-surface-low px-4 py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:border-[#444] transition-colors"
          >
            Edit Room
          </button>
          <button
            onClick={onDeleteRoom}
            className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:text-white hover:bg-red-500 transition-colors"
          >
            Delete Room
          </button>
        </div>
      </div>
    </div>
  );
}
