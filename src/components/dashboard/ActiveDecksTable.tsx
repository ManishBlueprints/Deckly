import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useDecks } from "../../hooks/useDecks";
import { cn } from "../../lib/utils";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const PAGE_SIZE = 8;

function formatAttention(seconds: number | undefined) {
  if (!seconds || seconds < 1) return "0s";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function formatActivity(value: string | undefined) {
  if (!value) return "No activity yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export interface ActiveDeckViewModel {
  id: string;
  title: string;
  thumbnailUrl?: string;
  activeLinkCount: number;
  status: "active" | "processing";
  lastActivity?: string;
  views: number;
  avgAttention?: number;
  saves: number;
}

interface ActiveDecksTableViewProps {
  decks: ActiveDeckViewModel[];
  loading?: boolean;
  refreshing?: boolean;
}

export function ActiveDecksTableView({
  decks,
  loading = false,
  refreshing = false,
}: ActiveDecksTableViewProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(decks.length / PAGE_SIZE));
  const visibleDecks = useMemo(
    () => decks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [decks, page],
  );

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <section className="overflow-hidden rounded-[16px] border border-ui-border bg-ui-surface shadow-[var(--ui-shadow-control)]" aria-labelledby="active-decks-title">
      <header className="flex flex-col gap-3 border-b border-ui-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <h2 id="active-decks-title" className="text-base font-semibold text-ui-text">Active decks</h2>
          <span className="rounded-full border border-ui-border bg-ui-subtle px-2.5 py-0.5 font-mono text-[11px] font-medium text-ui-muted">
            {decks.length}
          </span>
          {refreshing && !loading && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ui-primary" aria-label="Refreshing" />}
        </div>
        <Link to="/content" className="inline-flex h-9 w-fit items-center gap-2 rounded-[9px] border border-ui-border bg-ui-surface px-3.5 text-xs font-semibold text-ui-text transition-colors hover:border-ui-primary/35 hover:bg-ui-subtle">
          <FileText size={15} aria-hidden="true" />
          View all content
        </Link>
      </header>

      {loading ? (
        <div className="space-y-2 p-5" role="status" aria-label="Loading active decks">
          {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-[10px] bg-ui-subtle" />)}
        </div>
      ) : decks.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-ui-text">No active decks yet</p>
          <p className="mt-1 text-xs text-ui-muted">Upload a deck to start tracking activity.</p>
        </div>
      ) : (
        <>
          {isDesktop ? <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ui-border bg-ui-subtle/60 text-[10px] font-semibold uppercase tracking-[0.12em] text-ui-muted">
                  <th className="px-6 py-3">Deck name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last activity</th>
                  <th className="px-4 py-3 text-right">Views</th>
                  <th className="px-4 py-3 text-right">Avg. attention</th>
                  <th className="px-4 py-3 text-right">Saves</th>
                  <th className="px-6 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border">
                {visibleDecks.map((deck) => (
                    <tr key={deck.id} className="group transition-colors hover:bg-ui-subtle/70">
                      <td className="px-6 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-ui-border bg-ui-subtle text-ui-primary">
                            {deck.thumbnailUrl ? <img src={deck.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <FileText size={17} aria-hidden="true" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ui-text">{deck.title}</p>
                            <p className="mt-0.5 text-xs text-ui-muted">
                              {deck.activeLinkCount ? `${deck.activeLinkCount} active ${deck.activeLinkCount === 1 ? "link" : "links"}` : "No active links"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-2 text-xs font-medium", deck.status === "active" ? "text-ui-text" : "text-ui-warning")}>
                          <span className={cn("h-2 w-2 rounded-full", deck.status === "active" ? "bg-ui-primary" : "bg-ui-warning")} />
                          {deck.status === "active" ? "Active" : "Processing"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ui-muted">{formatActivity(deck.lastActivity)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-ui-text">{deck.views.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-ui-text">{formatAttention(deck.avgAttention)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-medium text-ui-text">{deck.saves}</td>
                      <td className="px-6 py-3 text-right">
                        <Link to={`/analytics/${deck.id}`} aria-label={`Open analytics for ${deck.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] border border-ui-border bg-ui-surface text-ui-muted shadow-[var(--ui-shadow-control)] transition-colors hover:border-ui-primary/35 hover:bg-ui-primary/10 hover:text-ui-primary">
                          <ExternalLink size={15} aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div> : <div className="divide-y divide-ui-border">
            {visibleDecks.map((deck) => (
                <article key={deck.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-ui-border bg-ui-subtle text-ui-primary">
                      {deck.thumbnailUrl ? <img src={deck.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <FileText size={17} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ui-text">{deck.title}</p>
                      <p className="mt-1 text-xs text-ui-muted">{formatActivity(deck.lastActivity)}</p>
                    </div>
                    <Link to={`/analytics/${deck.id}`} aria-label={`Open analytics for ${deck.title}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-ui-border text-ui-muted">
                      <ExternalLink size={15} aria-hidden="true" />
                    </Link>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 rounded-[10px] bg-ui-subtle p-3">
                    <div><dt className="text-[10px] text-ui-muted">Views</dt><dd className="mt-1 font-mono text-sm font-semibold text-ui-text">{deck.views}</dd></div>
                    <div><dt className="text-[10px] text-ui-muted">Attention</dt><dd className="mt-1 font-mono text-sm font-semibold text-ui-text">{formatAttention(deck.avgAttention)}</dd></div>
                    <div><dt className="text-[10px] text-ui-muted">Saves</dt><dd className="mt-1 font-mono text-sm font-semibold text-ui-text">{deck.saves}</dd></div>
                  </dl>
                </article>
            ))}
          </div>}
          {pageCount > 1 ? (
            <nav className="flex items-center justify-between border-t border-ui-border px-4 py-3 sm:px-6" aria-label="Active deck pages">
              <p className="text-xs text-ui-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, decks.length)} of {decks.length}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} aria-label="Previous active deck page" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted hover:bg-ui-subtle hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} /></button>
                <span className="min-w-12 text-center font-mono text-xs text-ui-muted">{page}/{pageCount}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Next active deck page" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-ui-border bg-ui-surface text-ui-muted hover:bg-ui-subtle hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={17} /></button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

export function ActiveDecksTable() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: decks = [], isLoading: decksLoading } = useDecks(userId);
  const activeDecks = useMemo<ActiveDeckViewModel[]>(
    () => decks
      .filter((deck) => deck.status !== "DELETED")
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
      .map((deck) => {
        return {
          id: deck.id,
          title: deck.title,
          thumbnailUrl: deck.thumbnail_url ?? undefined,
          activeLinkCount: deck.active_link_count ?? 0,
          status: deck.status === "PROCESSED" ? "active" : "processing",
          lastActivity: deck.updated_at || deck.created_at,
          views: deck.total_views ?? 0,
          avgAttention: deck.avg_attention_seconds,
          saves: deck.save_count ?? 0,
        };
      }),
    [decks],
  );

  return <ActiveDecksTableView decks={activeDecks} loading={decksLoading} />;
}
