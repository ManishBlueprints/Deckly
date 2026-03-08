import { useState, useEffect, useCallback } from "react";
import { X, Search, FileText, Check, Loader2 } from "lucide-react";
import { Deck } from "../../types";
import { deckService } from "../../services/deckService";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#111] border border-[#333] rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#222]">
          <div>
            <h2 className="text-lg font-semibold text-white">Select Assets</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white transition-all rounded-md bg-[#141414] border border-[#333] hover:bg-[#1a1a1a]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-[#222]">
          <div className="relative group">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-deckly-primary transition-colors"
            />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 text-sm bg-[#141414] border border-[#333] rounded-md focus:outline-none focus:ring-1 focus:ring-deckly-primary text-white placeholder:text-slate-500 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 relative z-10 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={24} className="text-deckly-primary animate-spin" />
              <p className="text-xs text-slate-500">Accessing Vault</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <div className="w-12 h-12 rounded-lg bg-[#141414] border border-[#333] flex items-center justify-center mb-4">
                <FileText size={24} className="opacity-50" />
              </div>
              <p className="text-sm">
                {decks.length === 0
                  ? "No assets available"
                  : "No matching assets"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filtered.map((deck) => {
                const isSelected = selected.has(deck.id);
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleSelect(deck.id)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 group ${
                      isSelected
                        ? "bg-deckly-primary/10 border-deckly-primary"
                        : "bg-[#141414] border-[#333] hover:border-[#444] hover:bg-[#1a1a1a]"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isSelected
                          ? "bg-deckly-primary text-[#111]"
                          : "border border-[#444] bg-[#0f0f0f]"
                      }`}
                    >
                      {isSelected && <Check size={14} className="font-bold" />}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-12 h-8 rounded-md bg-[#0f0f0f] border border-[#222] overflow-hidden shrink-0 group-hover:border-[#444] transition-all">
                      {deck.pages?.[0]?.image_url ? (
                        <img
                          src={deck.pages[0].image_url}
                          alt=""
                          className="w-full h-full object-cover transition-all duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText size={14} className="text-slate-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <p
                        className={`text-sm font-semibold truncate transition-colors ${isSelected ? "text-deckly-primary" : "text-white"}`}
                      >
                        {deck.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {deck.pages?.length || 0} Slides
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222] flex items-center justify-between bg-[#111]">
          <div className="flex flex-col">
            <span className="text-sm text-slate-400">
              {selected.size} selected
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-6 py-2 h-10 bg-deckly-primary text-slate-950 text-sm font-semibold rounded-md hover:bg-deckly-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
