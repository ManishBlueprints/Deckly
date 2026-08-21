import type { LibraryTag } from "../../types";
import { cn } from "../../lib/utils";
import { TagChip } from "../saved-decks/TagChip";
import { DropdownMenuContent } from "../ui/dropdown-menu";

interface TagAssignmentMenuContentProps {
  itemLabel: string;
  tags: LibraryTag[];
  selectedTagIds: string[];
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onToggle: (tagId: string, selected: boolean) => void;
  isUpdating?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  align?: "start" | "end";
}

export function TagAssignmentMenuContent({
  itemLabel,
  tags,
  selectedTagIds,
  query,
  onQueryChange,
  onClear,
  onToggle,
  isUpdating = false,
  onClick,
  align = "end",
}: TagAssignmentMenuContentProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTags = normalizedQuery
    ? tags.filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
    : tags;

  return (
    <DropdownMenuContent
      align={align}
      sideOffset={8}
      collisionPadding={16}
      className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-md border-ui-border bg-ui-elevated p-0 text-ui-text shadow-[var(--ui-shadow-overlay)] sm:w-80"
      onEscapeKeyDown={() => onQueryChange("")}
      onClick={onClick}
    >
      <div className="border-b border-ui-border bg-ui-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ui-muted">
              Apply tags
            </p>
            <p className="mt-1 text-xs text-ui-muted">
              {selectedTagIds.length > 0
                ? `${selectedTagIds.length} selected`
                : "Pick one or more tags"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={isUpdating || selectedTagIds.length === 0}
            className="rounded-md border border-ui-border bg-ui-surface px-2.5 py-1 text-[10px] font-semibold text-ui-muted transition-colors hover:bg-ui-elevated hover:text-ui-text disabled:opacity-50"
          >
            Clear all
          </button>
        </div>

        <div className="mt-3">
          <input
            aria-label={`Filter tags for ${itemLabel}`}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search tags..."
            className="w-full rounded-md border border-ui-border bg-ui-surface px-3 py-2 text-xs text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
          />
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
        {filteredTags.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm font-medium text-ui-muted">No tags found</p>
            <p className="mt-1 text-[10px] text-ui-muted">Try a different search</p>
          </div>
        ) : (
          filteredTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(tag.id, !isSelected)}
                disabled={isUpdating}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60",
                  isSelected
                    ? "border-ui-primary/25 bg-ui-primary/10"
                    : "border-transparent hover:border-ui-border hover:bg-ui-subtle",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <TagChip tag={tag} size="md" className="shrink-0" />
                  {isSelected ? (
                    <span className="text-[10px] font-semibold text-ui-primary">Applied</span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </DropdownMenuContent>
  );
}
