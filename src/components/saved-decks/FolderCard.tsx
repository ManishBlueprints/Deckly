import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Folder, FolderPlus, Edit2, Tag, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { LibraryFolder, LibraryTag } from "../../types";
import { cn } from "../../lib/utils";
import { TagChip } from "./TagChip";
import { getFolderColorHex } from "../../constants/folderColors";
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { TagAssignmentMenuContent } from "../shared/TagAssignmentMenuContent";

interface FolderCardProps {
  folder?: LibraryFolder;
  isNew?: boolean;
  onClick?: () => void;
  isActive?: boolean;
  onEdit?: (folder: LibraryFolder) => void;
  availableTags?: LibraryTag[];
  onUpdateTags?: (folder: LibraryFolder, tagIds: string[]) => Promise<void> | void;
  onDelete?: (folder: LibraryFolder) => void;
  documentCount?: number;
}

export const FolderCard = memo(function FolderCard({
  folder,
  isNew,
  onClick,
  isActive,
  onEdit,
  availableTags = [],
  onUpdateTags,
  onDelete,
  documentCount,
}: FolderCardProps) {
  const [tagFilterQuery, setTagFilterQuery] = useState("");
  const { theme } = useTheme();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const isUpdatingTagsRef = useRef(false);
  const pendingTagIdsRef = useRef<string[] | null>(null);
  const lastCommittedTagIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const nextTagIds = folder?.tags.map((tag) => tag.id) ?? [];
    lastCommittedTagIdsRef.current = nextTagIds;
    if (!isUpdatingTagsRef.current) {
      setSelectedTagIds(nextTagIds);
    }
  }, [folder]);

  const queueTagSelection = useCallback(
    (nextTagIds: string[]) => {
      pendingTagIdsRef.current = nextTagIds;
      if (isUpdatingTagsRef.current || !folder || !onUpdateTags) return;

      isUpdatingTagsRef.current = true;
      setIsUpdatingTags(true);

      void (async () => {
        try {
          while (pendingTagIdsRef.current) {
            const targetTagIds = pendingTagIdsRef.current;
            pendingTagIdsRef.current = null;
            await onUpdateTags(folder, targetTagIds);
            lastCommittedTagIdsRef.current = targetTagIds;
          }
        } catch (err) {
          pendingTagIdsRef.current = null;
          setSelectedTagIds(lastCommittedTagIdsRef.current);
          console.error("Failed to update saved library folder tags", err);
          toast.error(
            err instanceof Error ? err.message : "Failed to update folder tags.",
          );
        } finally {
          isUpdatingTagsRef.current = false;
          setIsUpdatingTags(false);
        }
      })();
    },
    [folder, onUpdateTags],
  );

  if (isNew) {
    return (
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-ui-border bg-ui-surface transition-colors hover:border-ui-primary/40"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-ui-subtle text-ui-primary">
          <FolderPlus size={20} />
        </div>
        <span className="text-xs font-medium text-ui-muted">
          Add folder
        </span>
      </motion.button>
    );
  }

  if (!folder) return null;
  const folderColor = getFolderColorHex(folder.color);
  const colorVariables = asItemColorVariables(getAccessibleColorSet(folderColor, theme));
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ y: 0 }}
      transition={{ duration: 0.1 }}
      className={cn(
        "group relative flex min-h-36 w-full cursor-pointer flex-col items-start overflow-hidden rounded-[14px] border border-ui-border bg-ui-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[var(--ui-shadow-surface)]",
        isActive &&
          "border-ui-primary/40 ring-2 ring-ui-primary/20",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open folder ${folder.name}`}
        className="absolute inset-0 z-0 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-focus"
      />

      {/* Active Indicator Line */}
      {isActive && (
        <motion.div
          layoutId="activeFolderLine"
          className="absolute left-0 top-0 h-1 w-full bg-ui-primary"
        />
      )}

      <div className="mb-5 transition-transform group-hover:scale-105" style={colorVariables}>
        <Folder
          className="w-8 h-8"
          style={{ color: "var(--item-color-foreground)", fill: "var(--item-color)" }}
        />
      </div>

      <div className="absolute right-3 top-3 z-10 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {onUpdateTags && availableTags.length > 0 && (
          <DropdownMenu onOpenChange={(open) => !open && setTagFilterQuery("")}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="Edit folder tags"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-primary/30 hover:bg-ui-subtle hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
              >
                <Tag size={14} />
              </button>
            </DropdownMenuTrigger>
            <TagAssignmentMenuContent
              itemLabel={folder.name}
              tags={availableTags}
              selectedTagIds={selectedTagIds}
              query={tagFilterQuery}
              onQueryChange={setTagFilterQuery}
              onClear={() => {
                setSelectedTagIds([]);
                queueTagSelection([]);
              }}
              onToggle={(tagId, selected) => {
                setSelectedTagIds((previous) => {
                  const nextIds = selected
                    ? Array.from(new Set([...previous, tagId]))
                    : previous.filter((id) => id !== tagId);
                  queueTagSelection(nextIds);
                  return nextIds;
                });
              }}
              isUpdating={isUpdatingTags && pendingTagIdsRef.current === null}
              onClick={(event) => event.stopPropagation()}
              align="start"
            />
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit?.(folder);
          }}
          aria-label="Edit folder"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-warning/40 hover:bg-ui-warning/10 hover:text-ui-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
        >
          <Edit2 size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(folder);
          }}
          aria-label="Delete folder"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-destructive/40 hover:bg-ui-destructive/10 hover:text-ui-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-4 flex-1">
        <h3 className="text-base font-semibold leading-tight text-ui-text transition-colors group-hover:text-ui-primary">
          {folder.name}
        </h3>

        <div className="flex flex-wrap gap-1.5 mt-auto pt-4">
          {folder.tags.slice(0, 2).map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
          {folder.tags.length > 2 && (
            <span className="ml-1 text-[10px] font-medium text-ui-muted">
              +{folder.tags.length - 2} More
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 w-full border-t border-ui-border pt-3">
        <span className="text-xs text-ui-muted">
          {(documentCount ?? folder.deck_count)} Document{(documentCount ?? folder.deck_count) !== 1 ? "s" : ""}
        </span>
      </div>
    </motion.div>
  );
});
