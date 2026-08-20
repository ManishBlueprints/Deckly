import { FolderOpen } from "lucide-react";
import { DataRoomFolderCard } from "../DataRoomFolderCard";
import { DataRoomFolderWithTags, DataRoomTag } from "../../../types";

interface DataRoomFolderStripProps {
  folders: DataRoomFolderWithTags[];
  tags: DataRoomTag[];
  folderDocumentCounts: Map<string, number>;
  loading: boolean;
  onCreateFolder: () => void;
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onEditFolder: (folder: DataRoomFolderWithTags) => void;
  onUpdateFolderTags: (folder: DataRoomFolderWithTags, tagIds: string[]) => Promise<void> | void;
  onDeleteFolder: (folder: DataRoomFolderWithTags) => void;
}

export function DataRoomFolderStrip({
  folders,
  tags,
  folderDocumentCounts,
  loading,
  onCreateFolder,
  activeFolderId,
  onSelectFolder,
  onEditFolder,
  onUpdateFolderTags,
  onDeleteFolder,
}: DataRoomFolderStripProps) {
  return (
    <div className="space-y-3">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(220px,280px))]">
          {folders.map((folder) => (
            <DataRoomFolderCard
              key={folder.id}
              folder={folder}
              availableTags={tags}
              onUpdateTags={onUpdateFolderTags}
              documentCount={folderDocumentCounts.get(folder.id) || 0}
              isActive={activeFolderId === folder.id}
              compact
              onClick={() =>
                onSelectFolder(activeFolderId === folder.id ? null : folder.id)
              }
              onEdit={onEditFolder}
              onDelete={onDeleteFolder}
            />
          ))}
          <button
            type="button"
            aria-label="Create folder"
            onClick={onCreateFolder}
            className="flex h-[128px] flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-ui-border bg-ui-surface text-ui-muted transition-colors hover:border-ui-primary/40 hover:bg-ui-subtle hover:text-ui-text"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-ui-border bg-ui-subtle">
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
