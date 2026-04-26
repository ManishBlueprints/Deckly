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
      <div className="rounded-lg border border-border bg-surface-card p-4 sm:p-5 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Sharing</h3>
        <p className="text-sm text-muted-foreground">{shareUrlLabel}</p>
        <button
          onClick={onTogglePublic}
          className="w-full sm:w-auto rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {isPublic ? "Make Private" : "Make Public"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface-card p-4 sm:p-5 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Room Actions</h3>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
          <button
            onClick={onEditRoom}
            className="w-full sm:w-auto rounded-md border border-border bg-surface-low px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-border hover:bg-surface-high transition-colors"
          >
            Edit Room
          </button>
          <button
            onClick={onDeleteRoom}
            className="w-full sm:w-auto rounded-md border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:text-destructive-foreground hover:bg-destructive transition-colors"
          >
            Delete Room
          </button>
        </div>
      </div>
    </div>
  );
}
