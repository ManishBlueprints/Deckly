import type { LibraryTag } from "../../types";
import { TAG_COLOR_OPTIONS } from "../../constants/itemColors";
import { TagManagementDialog } from "../shared/TagManagementDialog";

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: LibraryTag[];
  onCreate: (name: string, color: string) => Promise<LibraryTag>;
  onUpdate: (id: string, name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ManageTagsModal({
  isOpen,
  onClose,
  tags,
  onCreate,
  onUpdate,
  onDelete,
}: ManageTagsModalProps) {
  const resolveColor = (value: string) =>
    TAG_COLOR_OPTIONS.find((color) => color.key.toLowerCase() === value.toLowerCase())?.key ??
    TAG_COLOR_OPTIONS[0].key;

  return (
    <TagManagementDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      tags={tags}
      colors={TAG_COLOR_OPTIONS}
      defaultColor={TAG_COLOR_OPTIONS[0].key}
      resolveColorValue={resolveColor}
      resolveColorHex={(value) => value}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onDelete={onDelete}
      description="Create and manage custom tags for folders, decks, and saved items."
    />
  );
}
