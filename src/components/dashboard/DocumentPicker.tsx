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
      <div className="relative bg-[#090b10] border border-white/10 rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-deckly-primary/10 rounded-full blur-[80px] -mr-32 -mt-32" />

        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5 relative z-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary mb-1">
              ASSET LIBRARY
            </p>
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
              Select Assets
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-white transition-all rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:shadow-xl"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-8 py-5 border-b border-white/5 relative z-10">
          <div className="relative group">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-700 group-focus-within:text-deckly-primary transition-colors"
            />
            <input
              type="text"
              placeholder="SEARCH ASSETS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-4 text-xs font-bold uppercase tracking-widest bg-white/5 border border-white/5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-deckly-primary/20 focus:border-deckly-primary/30 text-white placeholder:text-slate-800 transition-all shadow-inner"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 relative z-10 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 size={32} className="text-deckly-primary animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                Accessing Vault
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-700">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                <FileText size={32} className="opacity-30" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
                {decks.length === 0
                  ? "NO ASSETS AVAILABLE"
                  : "NO MATCHING ASSETS"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {filtered.map((deck) => {
                const isSelected = selected.has(deck.id);
                return (
                  <button
                    key={deck.id}
                    onClick={() => toggleSelect(deck.id)}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all duration-300 group ${
                      isSelected
                        ? "bg-deckly-primary/10 border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                        : "bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isSelected
                          ? "bg-deckly-primary border-deckly-primary shadow-[0_0_10px_rgba(34,197,94,0.4)]"
                          : "border-slate-800 bg-black/20"
                      }`}
                    >
                      {isSelected && (
                        <Check size={14} className="text-slate-950 font-bold" />
                      )}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-12 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-inner group-hover:border-deckly-primary/30 transition-all">
                      {deck.pages?.[0]?.image_url ? (
                        <img
                          src={deck.pages[0].image_url}
                          alt=""
                          className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText size={16} className="text-slate-800" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[11px] font-bold uppercase tracking-wider truncate transition-colors ${isSelected ? "text-deckly-primary" : "text-white"}`}
                      >
                        {deck.title}
                      </p>
                      <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
                        {deck.pages?.length || 0} SLIDES
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-white/5 flex items-center justify-between relative z-10 bg-black/20 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {selected.size} SELECTED
            </span>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-all"
            >
              CANCEL
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0}
              className="px-8 py-3 bg-deckly-primary text-slate-950 text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-deckly-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl shadow-deckly-primary/20 active:scale-95"
            >
              CONFIRM {selected.size > 0 ? `(${selected.size})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
