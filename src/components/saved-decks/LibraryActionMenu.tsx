import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuCheckboxItem,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Bookmark, BookmarkMinus, Check, FolderInput, MoreHorizontal, Sparkles, Tags } from "lucide-react";
import { LibraryFolder, LibraryTag } from "../../types";
import { cn } from "../../lib/utils";
import { getFolderColorHex } from "../../constants/folderColors";
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";

export interface LibraryActionMenuItem {
  title: string;
  folder_id: string | null;
  tags: LibraryTag[];
}

interface LibraryActionMenuProps {
  item: LibraryActionMenuItem;
  folders: LibraryFolder[];
  tags: LibraryTag[];
  openLabel: string;
  openAction: () => void;
  summarizeLabel?: string;
  onSummarize?: () => void;
  unsaveLabel: string;
  unsaveDescription: string;
  onMoveToFolder: (folderId: string | null) => void;
  onUpdateTags?: (tagIds: string[]) => void;
  onUnsave: () => void;
}

export function LibraryActionMenu({
  item,
  folders,
  tags,
  openLabel,
  openAction,
  summarizeLabel,
  onSummarize,
  unsaveLabel,
  unsaveDescription,
  onMoveToFolder,
  onUpdateTags,
  onUnsave,
}: LibraryActionMenuProps) {
  const { theme } = useTheme();
  const [showUnsaveConfirm, setShowUnsaveConfirm] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${item.title} actions`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted transition-colors hover:bg-ui-subtle hover:text-ui-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus"
        >
          <MoreHorizontal size={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-60 rounded-md border-ui-border bg-ui-elevated p-1.5 text-ui-text shadow-[var(--ui-shadow-overlay)]"
        >
          <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-ui-muted">
            Saved item actions
          </DropdownMenuLabel>

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              openAction();
            }}
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary"
          >
            <Bookmark size={17} className="text-ui-muted" />
            <span>{openLabel}</span>
          </DropdownMenuItem>

          {onSummarize ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onSummarize();
              }}
              className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ui-primary transition-colors data-[highlighted]:bg-ui-subtle"
            >
              <Sparkles size={16} />
              <span>
                {summarizeLabel ?? "Summarize with AI"}
              </span>
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary data-[state=open]:bg-ui-subtle">
              <FolderInput size={17} className="text-ui-muted" />
              <span>Move to folder</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="min-w-[210px] rounded-md border-ui-border bg-ui-elevated p-1.5 text-ui-text shadow-[var(--ui-shadow-overlay)]">
                <DropdownMenuItem
                  onClick={() => onMoveToFolder(null)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2.5 text-sm text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary",
                    !item.folder_id &&
                      "bg-ui-subtle font-semibold text-ui-primary",
                  )}
                >
                  <span>Unsorted</span>
                  {!item.folder_id && (
                    <Check size={15} />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-ui-border" />
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => onMoveToFolder(folder.id)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-sm px-3 py-2.5 text-sm text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary",
                      item.folder_id === folder.id &&
                        "bg-ui-subtle font-semibold text-ui-primary",
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="h-2 w-2 shrink-0 rounded-full bg-[var(--item-color-border)]" style={asItemColorVariables(getAccessibleColorSet(getFolderColorHex(folder.color), theme))} />
                      <span className="truncate">
                        {folder.name}
                      </span>
                    </div>
                    {item.folder_id === folder.id && (
                      <Check size={15} />
                    )}
                  </DropdownMenuItem>
                ))}
                {folders.length === 0 && (
                  <div className="px-3 py-2.5 text-xs text-ui-muted">
                    No folders available
                  </div>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {onUpdateTags && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary data-[state=open]:bg-ui-subtle">
                <Tags size={17} className="text-ui-muted" />
                <span>Edit tags</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="min-w-[210px] rounded-md border-ui-border bg-ui-elevated p-1.5 text-ui-text shadow-[var(--ui-shadow-overlay)]">
                  {tags.map((tag) => {
                    const isSelected = item.tags.some((t) => t.id === tag.id);
                    return (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={isSelected}
                        onCheckedChange={(checked: boolean) => {
                          const newTagIds = checked
                            ? Array.from(
                                new Set([...item.tags.map((t) => t.id), tag.id]),
                              )
                            : item.tags.filter((t) => t.id !== tag.id).map((t) => t.id);
                          onUpdateTags(newTagIds);
                        }}
                        onSelect={(e: Event) => e.preventDefault()}
                        className="cursor-pointer rounded-sm px-3 py-2.5 text-ui-text transition-colors data-[highlighted]:bg-ui-subtle data-[highlighted]:text-ui-primary"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-[var(--item-color-border)]" style={asItemColorVariables(getAccessibleColorSet(tag.color, theme))} />
                          <span className="text-sm font-medium">{tag.name}</span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                  {tags.length === 0 && (
                    <div className="px-3 py-2.5 text-xs text-ui-muted">
                      No tags created
                    </div>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}

          <DropdownMenuSeparator className="my-1 bg-ui-border" />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setShowUnsaveConfirm(true);
            }}
            className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-ui-destructive transition-colors data-[highlighted]:bg-ui-destructive/10 data-[highlighted]:text-ui-destructive"
          >
            <BookmarkMinus size={17} />
            <span>{unsaveLabel}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showUnsaveConfirm} onOpenChange={setShowUnsaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{unsaveLabel}</AlertDialogTitle>
            <AlertDialogDescription>{unsaveDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-ui-destructive text-ui-primary-text hover:opacity-90"
              onClick={() => {
                onUnsave();
                setShowUnsaveConfirm(false);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
