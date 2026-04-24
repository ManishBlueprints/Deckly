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
}: DataRoomFolderStripProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold text-white">Folders</h3>
        <span className="inline-flex items-center rounded-md border border-[#333] bg-surface-low px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          {folders.length}
        </span>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#222] bg-surface-card p-6 text-sm text-slate-500">
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
            className="h-[190px] rounded-md border border-dashed border-[#333] bg-surface-card flex flex-col items-center justify-center gap-3 text-slate-500 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors"
          >
            <span className="w-10 h-10 rounded-md border border-[#333] bg-surface-low flex items-center justify-center">
              <FolderOpen size={20} />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em]">
              New Folder
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
