import type { DataRoomTag } from "../../types";
import { FOLDER_PICKER_COLORS, getFolderColorHex, resolveFolderColorKey } from "../../constants/folderColors";
import { TagManagementDialog } from "../shared/TagManagementDialog";

interface DataRoomTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: DataRoomTag[];
  onCreate: (name: string, color?: string) => Promise<DataRoomTag>;
  onUpdate: (tagId: string, name: string, color?: string) => Promise<DataRoomTag>;
  onDelete: (tagId: string) => Promise<void>;
}

export function DataRoomTagsModal({
  isOpen,
  onClose,
  tags,
  onCreate,
  onUpdate,
  onDelete,
}: DataRoomTagsModalProps) {
  return (
    <TagManagementDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      tags={tags}
      colors={FOLDER_PICKER_COLORS}
      defaultColor={FOLDER_PICKER_COLORS[0].key}
      resolveColorValue={resolveFolderColorKey}
      resolveColorHex={getFolderColorHex}
      onCreate={(name, color) => onCreate(name, color)}
      onUpdate={(id, name, color) => onUpdate(id, name, color)}
      onDelete={onDelete}
      description="Create and manage tags for filtering room folders and documents."
    />
  );
}
