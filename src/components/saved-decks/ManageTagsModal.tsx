import { useState, useEffect } from "react";
import { X, Loader2, Edit2, Trash2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LibraryTag } from "../../types";
import { cn } from "../../utils/cn";

const TAG_COLORS = [
  { id: "green-light", value: "#8affab" },
  { id: "green", value: "#54e98a" },
  { id: "blue", value: "#3b82f6" },
  { id: "purple", value: "#a855f7" },
  { id: "orange", value: "#f97316" },
  { id: "red", value: "#ef4444" },
  { id: "pink", value: "#ec4899" },
  { id: "yellow", value: "#eab308" },
  { id: "cyan", value: "#06b6d4" },
  { id: "gray", value: "#666666" },
];

interface ManageTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tags: LibraryTag[];
  onCreate: (name: string, color: string) => Promise<void>;
  onUpdate: (id: string, name: string, color: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ManageTagsModal({ isOpen, onClose, tags, onCreate, onUpdate, onDelete }: ManageTagsModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].value);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset when opened/closed
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName("");
    setSelectedColor(TAG_COLORS[0].value);
    setEditingTagId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      if (editingTagId) {
        await onUpdate(editingTagId, name.trim(), selectedColor);
      } else {
        await onCreate(name.trim(), selectedColor);
      }
      resetForm();
    } catch (err) {
      console.error("Failed to save tag:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (tag: LibraryTag) => {
    setName(tag.name);
    // Find closest match or default
    const validColor = TAG_COLORS.find(c => c.value.toLowerCase() === tag.color.toLowerCase())?.value || tag.color;
    setSelectedColor(validColor);
    setEditingTagId(tag.id);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
      if (editingTagId === id) resetForm();
    } catch (err) {
      console.error("Failed to delete tag:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#232323] border border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]"
            >
              <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-headline font-bold text-white tracking-tight">
                      Manage Tags
                    </h2>
                    <p className="text-[#bbcbbb]/60 text-sm leading-relaxed font-medium">
                      Create and manage custom tags to categorize your folders and documents.
                    </p>
                  </div>
                  <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {/* Form to Create/Edit */}
                <div className="bg-[#161616] border border-white/5 p-6 space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 ml-1">
                      {editingTagId ? "EDIT TAG" : "NEW TAG NAME"}
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                      placeholder="e.g. SAAS, Q3 2024..."
                      className="w-full bg-[#232323] border border-white/5 px-4 py-3.5 text-sm text-white placeholder-[#bbcbbb]/20 focus:outline-none focus:ring-1 focus:ring-white/10 transition-all font-medium"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 ml-1">
                      TAG COLOR
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => setSelectedColor(color.value)}
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                            selectedColor === color.value ? "ring-2 ring-white/20 scale-110" : "hover:scale-110"
                          )}
                          style={{ backgroundColor: color.value }}
                        >
                          {selectedColor === color.value && <Check size={14} className="text-black/50" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {editingTagId && (
                      <button
                        onClick={resetForm}
                        className="px-4 py-3 bg-white/5 text-[#bbcbbb]/60 font-bold text-xs hover:text-white hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={isLoading || !name.trim()}
                      className="flex-1 px-4 py-3 bg-[#54e98a] text-[#003919] font-black text-xs tracking-wide flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100"
                    >
                      {isLoading ? <Loader2 size={16} className="animate-spin" /> : editingTagId ? "Save Tag" : "Create Tag"}
                    </button>
                  </div>
                </div>

                {/* Existing Tags List */}
                {tags.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 ml-1">
                      EXISTING TAGS
                    </label>
                    <div className="space-y-2">
                      {tags.map(tag => (
                        <div key={tag.id} className={cn(
                          "flex items-center justify-between p-3 border transition-colors",
                          editingTagId === tag.id ? "bg-[#54e98a]/5 border-[#54e98a]/20" : "bg-white/5 border-white/5 hover:border-white/10"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                            <span className="text-sm font-bold text-white uppercase tracking-wider">{tag.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(tag)}
                              className="p-2 text-[#bbcbbb]/30 hover:text-white hover:bg-white/5 transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(tag.id)}
                              disabled={deletingId === tag.id}
                              className="p-2 text-[#bbcbbb]/30 hover:text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
                            >
                              {deletingId === tag.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
