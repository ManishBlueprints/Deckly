import { FolderOpen } from "lucide-react";
import { DataRoomFolderCard } from "../DataRoomFolderCard";
import { DataRoomFolderWithTags } from "../../../types";

interface DataRoomFolderStripProps {
  folders: DataRoomFolderWithTags[];
  folderDocumentCounts: Map<string, number>;
  loading: boolean;
  onCreateFolder: () => void;
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onEditFolder: (folder: DataRoomFolderWithTags) => void;
  onDeleteFolder: (folder: DataRoomFolderWithTags) => void;
  onSummarizeFolder: (folder: DataRoomFolderWithTags) => void;
}

export function DataRoomFolderStrip({
  folders,
  folderDocumentCounts,
  loading,
  onCreateFolder,
  activeFolderId,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
  onSummarizeFolder,
}: DataRoomFolderStripProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">Folders</h3>
        <span className="inline-flex items-center rounded-md border border-border bg-surface-low px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {folders.length}
        </span>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-surface-card p-4 sm:p-6 text-sm text-muted-foreground">
          Loading folders...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {folders.map((folder) => (
            <DataRoomFolderCard
              key={folder.id}
              folder={folder}
              documentCount={folderDocumentCounts.get(folder.id) || 0}
              isActive={activeFolderId === folder.id}
              compact
              onClick={() =>
                onSelectFolder(activeFolderId === folder.id ? null : folder.id)
              }
              onEdit={onEditFolder}
              onDelete={onDeleteFolder}
              onSummarize={onSummarizeFolder}
            />
          ))}
          <button
            type="button"
            aria-label="Create folder"
            onClick={onCreateFolder}
            className="h-[160px] rounded-md border border-dashed border-border bg-surface-card flex flex-col items-center justify-center gap-2.5 text-muted-foreground hover:text-foreground hover:border-border hover:bg-surface-high transition-colors"
          >
            <span className="w-9 h-9 rounded-md border border-border bg-surface-low flex items-center justify-center">
              <FolderOpen size={18} />
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.15em]">
              New Folder
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
