import { useState, useEffect, useCallback } from "react";
import { Search, FileText, Check, Loader2 } from "lucide-react";
import { Deck } from "../../types";
import { deckService } from "../../services/deckService";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { cn } from "../../lib/utils";

interface DocumentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (deckIds: string[]) => void;
  excludeDeckIds: string[];
}

export function DocumentPicker({
  isOpen,
  onClose,
  onAdd,
  excludeDeckIds,
}: DocumentPickerProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadDecks = useCallback(async () => {
    setLoading(true);
    try {
      const all = await deckService.getAllDecks();
      setDecks(all.filter((d) => !excludeDeckIds.includes(d.id)));
    } catch (err) {
      console.error("Failed to load decks", err);
    } finally {
      setLoading(false);
    }
  }, [excludeDeckIds]);

  useEffect(() => {
    if (isOpen) {
      loadDecks();
      setSelected(new Set());
      setSearch("");
    }
  }, [isOpen, loadDecks]);

  const filtered = decks.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    onAdd(Array.from(selected));
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md" closeOnOutsideClick={!loading}>
        <DialogHeader>
          <DialogTitle>Add existing decks</DialogTitle>
          <DialogDescription>
            Select one or more decks to add to this room.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="p-0">
          <div className="border-b border-ui-border px-5 py-4 sm:px-6">
            <div className="group relative">
            <Search
              size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ui-muted transition-colors group-focus-within:text-ui-primary"
            />
            <input
              type="text"
                placeholder="Search decks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-ui-border bg-ui-surface pl-10 pr-4 text-sm text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/15"
            />
          </div>
        </div>

          <div className="max-h-[52vh] min-h-56 overflow-y-auto p-4 custom-scrollbar sm:p-5">
          {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <Loader2 size={22} className="animate-spin text-ui-primary" />
                <p className="text-sm text-ui-muted">Loading decks...</p>
            </div>
          ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-ui-muted">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-ui-border bg-ui-subtle">
                  <FileText size={22} />
              </div>
                <p className="text-sm font-medium text-ui-text">
                {decks.length === 0
                    ? "No decks available"
                    : "No matching decks"}
              </p>
            </div>
          ) : (
              <div className="space-y-2">
              {filtered.map((deck) => {
                const isSelected = selected.has(deck.id);
                const thumbnailUrl = deck.thumbnail_url ?? deck.pages?.[0]?.image_url;
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleSelect(deck.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                        isSelected
                          ? "border-ui-primary bg-ui-primary/10"
                          : "border-ui-border bg-ui-surface hover:bg-ui-subtle",
                      )}
                  >
                    {/* Checkbox */}
                    <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                          isSelected
                            ? "border-ui-primary bg-ui-primary text-ui-primary-text"
                            : "border-ui-border bg-ui-elevated",
                        )}
                    >
                      {isSelected && <Check size={14} className="font-bold" />}
                    </div>

                    {/* Thumbnail */}
                      <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md border border-ui-border bg-ui-subtle">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover transition-all duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FileText size={14} className="text-ui-muted" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <p
                          className={cn(
                            "truncate text-sm font-semibold",
                            isSelected ? "text-ui-primary" : "text-ui-text",
                          )}
                      >
                        {deck.title}
                      </p>
                        <p className="mt-0.5 text-xs text-ui-muted">
                          {deck.pages?.length || 0} slides
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </DialogBody>

        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm text-ui-muted">
            {selected.size} selected
          </span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={selected.size === 0} className="flex-1 sm:flex-none">
              Add decks {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
