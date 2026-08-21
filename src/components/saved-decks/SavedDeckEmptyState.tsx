import type { LucideIcon } from "lucide-react";
import { FolderPlus, LockKeyhole, Search, Tags } from "lucide-react";
import { Surface } from "../ui/surface";
import { cn } from "../../lib/utils";

interface SavedLibraryEmptyStateProps {
  title: string;
  description: string;
  ctaLabel: string;
  onCreateFolder: () => void;
  compact?: boolean;
}

export function SavedLibraryEmptyState({ title, description, ctaLabel, onCreateFolder, compact = false }: SavedLibraryEmptyStateProps) {
  return (
    <section className={cn("mx-auto w-full max-w-[1440px] px-4 pb-12 pt-6 sm:px-6 lg:px-10 lg:pt-8", compact && "p-0")}>
      {!compact && <div className="mb-6"><h1 className="text-3xl font-semibold tracking-[-0.04em] text-ui-text sm:text-4xl">Saved library</h1><p className="mt-2 text-sm text-ui-muted sm:text-base">Keep useful decks and rooms organized in one private place.</p></div>}
      <Surface className={cn("flex flex-col items-center justify-center rounded-[24px] px-6 text-center", compact ? "min-h-72 py-12" : "min-h-[520px] py-16")}>
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-[18px] border border-ui-border bg-ui-subtle">
          <FolderPlus size={28} className="text-ui-primary" />
        </div>
        <h2 className="text-2xl font-semibold tracking-[-0.035em] text-ui-text">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-ui-muted">{description}</p>
        <button type="button" onClick={onCreateFolder} className="mt-7 inline-flex h-11 items-center gap-2 rounded-[12px] bg-ui-primary px-5 text-sm font-semibold text-ui-primary-text"><FolderPlus size={18} />{ctaLabel}</button>
        {!compact && <div className="mt-12 grid w-full max-w-3xl gap-4 border-t border-ui-border pt-8 text-left sm:grid-cols-3">
          <Feature icon={Tags} title="Flexible curation">Group saved items with folders and accessible color tags.</Feature>
          <Feature icon={Search} title="Quick retrieval">Filter decks and rooms without changing the global command palette.</Feature>
          <Feature icon={LockKeyhole} title="Private by default">Saved items remain private to your account and workspace.</Feature>
        </div>}
      </Surface>
    </section>
  );
}

function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return <div className="rounded-[14px] bg-ui-subtle p-4"><Icon size={18} className="text-ui-primary" /><h3 className="mt-3 text-sm font-semibold text-ui-text">{title}</h3><p className="mt-1 text-xs leading-5 text-ui-muted">{children}</p></div>;
}

export const SavedDeckEmptyState = SavedLibraryEmptyState;
