import type { ReactNode } from "react";
import { FileText, Folder, Users } from "lucide-react";
import { Link } from "react-router-dom";
import type { LibraryFolder, LibraryTag } from "../../types";
import { cn } from "../../lib/utils";
import { TagChip } from "./TagChip";

interface SavedLibraryItemRowProps {
  title: string;
  href: string | null;
  creator: string;
  type: "Deck" | "Room";
  folder?: LibraryFolder;
  tags: LibraryTag[];
  savedDateLabel: string;
  note: ReactNode;
  actions: ReactNode;
  matchedTagNames?: string[];
  unavailable?: boolean;
  className?: string;
}

export function SavedLibraryItemRow({
  title,
  href,
  creator,
  type,
  folder,
  tags,
  savedDateLabel,
  note,
  actions,
  matchedTagNames = [],
  unavailable = false,
  className,
}: SavedLibraryItemRowProps) {
  const TypeIcon = type === "Deck" ? FileText : Users;

  return (
    <div
      className={cn(
        "group grid gap-4 border-t border-ui-border px-4 py-4 transition-colors hover:bg-ui-subtle/65 sm:px-5 xl:grid-cols-[minmax(210px,1.6fr)_minmax(100px,.7fr)_80px_minmax(100px,.7fr)_minmax(120px,.9fr)_minmax(150px,1fr)_110px_40px] xl:items-center xl:gap-3",
        unavailable && "opacity-65",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ui-border bg-ui-subtle text-ui-primary">
            <TypeIcon size={17} />
          </span>
          <div className="min-w-0">
            {href ? (
              <Link
                to={href}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-semibold text-ui-text transition-colors hover:text-ui-primary"
              >
                {title}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold text-ui-text">{title}</p>
            )}
            {matchedTagNames.length > 0 ? (
              <p className="mt-1 truncate text-xs text-ui-primary">
                Matched: {matchedTagNames.slice(0, 3).join(", ")}
              </p>
            ) : unavailable ? (
              <p className="mt-1 text-xs text-ui-destructive">Source unavailable</p>
            ) : null}
          </div>
        </div>
      </div>

      <MetadataCell label="Created by / Owner">
        <span className="truncate text-sm text-ui-text">{creator}</span>
      </MetadataCell>

      <MetadataCell label="Type">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-ui-border bg-ui-subtle px-2.5 py-1 text-xs font-medium text-ui-text">
          <TypeIcon size={13} className="text-ui-muted" />
          {type}
        </span>
      </MetadataCell>

      <MetadataCell label="Folder">
        {folder ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-ui-text">
            <Folder size={14} className="shrink-0 text-ui-muted" />
            <span className="truncate">{folder.name}</span>
          </span>
        ) : (
          <span className="text-sm text-ui-muted">Unsorted</span>
        )}
      </MetadataCell>

      <MetadataCell label="Tags">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {tags.length > 0 ? (
            <>
              {tags.slice(0, 2).map((tag) => (
                <TagChip key={tag.id} tag={tag} />
              ))}
              {tags.length > 2 ? (
                <span className="inline-flex h-6 items-center rounded-full border border-ui-border bg-ui-subtle px-2 text-[10px] font-semibold text-ui-muted">
                  +{tags.length - 2}
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-sm text-ui-muted">No tags</span>
          )}
        </div>
      </MetadataCell>

      <MetadataCell label="Private note">{note}</MetadataCell>

      <MetadataCell label="Saved">
        <time className="font-mono text-xs text-ui-muted">{savedDateLabel}</time>
      </MetadataCell>

      <div className="flex justify-end xl:block">{actions}</div>
    </div>
  );
}

function MetadataCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ui-muted xl:hidden">
        {label}
      </p>
      {children}
    </div>
  );
}
