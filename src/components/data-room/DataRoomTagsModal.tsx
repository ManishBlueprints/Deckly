import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Edit2, Loader2, Trash2, X } from "lucide-react";
import { DataRoomTag } from "../../types";
import { FOLDER_COLORS } from "../../constants/folderColors";
import { cn } from "../../utils/cn";

interface DataRoomTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: DataRoomTag[];
  onCreate: (name: string, color?: string) => Promise<DataRoomTag>;
  onUpdate: (tagId: string, name: string, color?: string) => Promise<DataRoomTag>;
  onDelete: (tagId: string) => Promise<void>;
}

export function DataRoomTagsModal({
  isOpen,
  onClose,
  tags,
  onCreate,
  onUpdate,
  onDelete,
}: DataRoomTagsModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].key);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getColorHex = (colorKey: string) =>
    FOLDER_COLORS.find((color) => color.key === colorKey)?.hex ?? colorKey;

  const resolveColorKey = (value: string) =>
    FOLDER_COLORS.find((color) => color.key === value)?.key ||
    FOLDER_COLORS.find((color) => color.hex.toLowerCase() === value.toLowerCase())
      ?.key ||
    FOLDER_COLORS[0].key;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    setName("");
    setSelectedColor(FOLDER_COLORS[0].key);
    setEditingTagId(null);
    setIsSaving(false);
    setDeletingId(null);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      if (editingTagId) {
        await onUpdate(editingTagId, trimmed, selectedColor);
      } else {
        await onCreate(trimmed, selectedColor);
      }
      setName("");
      setSelectedColor(FOLDER_COLORS[0].key);
      setEditingTagId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (tag: DataRoomTag) => {
    setEditingTagId(tag.id);
    setName(tag.name);
    setSelectedColor(resolveColorKey(tag.color));
  };

  const handleDelete = async (tagId: string) => {
    setDeletingId(tagId);
    try {
      await onDelete(tagId);
      if (editingTagId === tagId) {
        setEditingTagId(null);
        setName("");
        setSelectedColor(FOLDER_COLORS[0].key);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="pointer-events-auto w-full max-w-2xl rounded-xl border border-white/10 bg-[#1a1a1a] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="p-6 md:p-8 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-headline font-bold text-white">
                      Manage Tags
                    </h2>
                    <p className="text-sm text-slate-400">
                      Create owner-only folder tags for filtering and grouping.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-md border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#111] p-5 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Tag Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void handleSave()}
                      placeholder="Q1"
                      className="w-full h-11 rounded-md border border-white/10 bg-[#0d0d0d] px-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-deckly-primary/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                      Tag Color
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {FOLDER_COLORS.map((color) => {
                        const isSelected = selectedColor === color.key;
                        return (
                          <button
                            key={color.key}
                            type="button"
                            onClick={() => setSelectedColor(color.key)}
                            className={cn(
                              "w-8 h-8 rounded-full border transition-all flex items-center justify-center",
                              isSelected
                                ? "scale-110 border-white/40"
                                : "border-white/10 hover:scale-105",
                            )}
                            style={{ backgroundColor: color.hex }}
                          >
                            {isSelected && (
                              <Check size={14} className="text-black/50" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    {editingTagId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagId(null);
                          setName("");
                          setSelectedColor(FOLDER_COLORS[0].key);
                        }}
                        className="h-10 px-4 rounded-md border border-white/10 bg-white/5 text-xs font-semibold text-slate-300 hover:text-white"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleSave()}
                      disabled={isSaving || !name.trim()}
                      className="h-10 px-4 rounded-md bg-deckly-primary text-slate-950 text-xs font-semibold hover:bg-deckly-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : null}
                      {editingTagId ? "Save Tag" : "Create Tag"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="h-1 w-8 rounded-full bg-deckly-primary" />
                    <h3 className="text-sm font-semibold text-white">
                      Existing Tags
                    </h3>
                  </div>

                  {tags.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-white/10 p-6 text-sm text-slate-500">
                      No tags yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tags.map((tag) => (
                        <div
                          key={tag.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-4 py-3",
                            editingTagId === tag.id
                              ? "border-deckly-primary/30 bg-deckly-primary/5"
                              : "border-white/10 bg-white/5",
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: getColorHex(tag.color) }}
                            />
                            <span className="text-sm font-semibold text-white uppercase tracking-wide truncate">
                              {tag.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(tag)}
                              className="w-9 h-9 rounded-md border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                              title="Edit tag"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(tag.id)}
                              disabled={deletingId === tag.id}
                              className="w-9 h-9 rounded-md border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center disabled:opacity-50"
                              title="Delete tag"
                            >
                              {deletingId === tag.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
