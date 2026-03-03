import {
  GripVertical,
  Trash2,
  FileText,
  BarChart3, // Changed from BarChart2 to BarChart3
  Pencil,
} from "lucide-react";
import { DataRoomDocument } from "../../types";
import { useState, useRef } from "react";
import { Link } from "react-router-dom";

interface RoomDocumentListProps {
  documents: DataRoomDocument[];
  onRemove: (deckId: string) => void;
  onReorder: (orderedDeckIds: string[]) => void;
}

export function RoomDocumentList({
  documents,
  onRemove,
  onReorder,
}: RoomDocumentListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragItemRef.current === null || dragItemRef.current === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const items = [...documents];
    const [moved] = items.splice(dragItemRef.current, 1);
    items.splice(index, 0, moved);

    onReorder(items.map((d) => d.deck_id));
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    dragItemRef.current = null;
  };

  if (documents.length === 0) return null;

  return (
    <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
      <div className="space-y-1 min-w-[500px] md:min-w-0">
        {documents.map((doc, index) => {
          const deck = doc.deck;
          const isDragging = dragIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={doc.deck_id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all duration-300 group ${
                isDragging
                  ? "opacity-40 border-deckly-primary/50 bg-deckly-primary/10"
                  : isDragOver
                    ? "border-white/20 bg-white/5 scale-[1.02]"
                    : "glass-shiny border-white/5 hover:border-deckly-primary/30"
              }`}
            >
              {/* Drag handle */}
              <div className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-deckly-primary transition-colors">
                <GripVertical size={18} />
              </div>

              {/* Order number */}
              <span className="text-[10px] font-bold text-slate-700 w-6 text-center shrink-0 uppercase tracking-widest">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Thumbnail */}
              <div className="w-12 h-10 rounded-xl bg-white/5 border border-white/10 overflow-hidden shrink-0 shadow-inner group-hover:border-deckly-primary/30 transition-all">
                {deck?.pages?.[0]?.image_url ? (
                  <img
                    src={deck.pages[0].image_url}
                    alt=""
                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText size={16} className="text-slate-700" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white uppercase tracking-wider truncate group-hover:text-deckly-primary transition-colors">
                  {deck?.title || "Untitled Asset"}
                </p>
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5 whitespace-nowrap">
                  {deck?.pages?.length || 0} SLIDES IN BUNDLE
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  to={`/analytics/${doc.deck_id}`}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20 rounded-xl transition-all shadow-lg group/icon"
                  title="View Analytics"
                >
                  <BarChart3
                    size={20}
                    className="group-hover/icon:scale-110 transition-transform"
                  />
                </Link>
                <Link
                  to={`/upload?edit=${doc.deck_id}`}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20 rounded-xl transition-all shadow-lg group/icon"
                  title="Edit Asset"
                >
                  <Pencil
                    size={20}
                    className="group-hover/icon:scale-110 transition-transform"
                  />
                </Link>
                <button
                  onClick={() => onRemove(doc.deck_id)}
                  className="p-3 bg-white/5 border border-white/10 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all shadow-lg group/icon"
                  title="Remove from room"
                >
                  <Trash2
                    size={20}
                    className="group-hover/icon:scale-110 transition-transform"
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
