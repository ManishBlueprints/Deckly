import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Plus, X } from "lucide-react";
import { DataRoomTag } from "../../types";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_COLORS,
  FolderColorKey,
} from "../../constants/folderColors";
import { MAX_TAGS_PER_FOLDER } from "../../constants/folderValidation";

interface DataRoomFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    color: FolderColorKey;
    tagIds: string[];
  }) => Promise<void>;
  existingTags: DataRoomTag[];
  initialData?: {
    name: string;
    color: FolderColorKey;
    tagIds: string[];
  } | null;
}

export function DataRoomFolderModal({
  isOpen,
  onClose,
  onSubmit,
  existingTags,
  initialData,
}: DataRoomFolderModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] =
    useState<FolderColorKey>(DEFAULT_FOLDER_COLOR);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(initialData?.name ?? "");
    setSelectedColor(initialData?.color ?? DEFAULT_FOLDER_COLOR);
    setSelectedTagIds(initialData?.tagIds ?? []);
    setTagQuery("");
    setShowSuggestions(false);
    setIsSaving(false);
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const selectedTags = useMemo(
    () => existingTags.filter((tag) => selectedTagIds.includes(tag.id)),
    [existingTags, selectedTagIds],
  );

  const getColorHex = (colorKey: string) =>
    FOLDER_COLORS.find((color) => color.key === colorKey)?.hex ?? colorKey;

  const filteredSuggestions = useMemo(() => {
    const normalizedQuery = tagQuery.trim().toLowerCase();
    return existingTags
      .filter((tag) => !selectedTagIds.includes(tag.id))
      .filter((tag) =>
        normalizedQuery === ""
          ? true
          : tag.name.toLowerCase().includes(normalizedQuery),
      );
  }, [existingTags, selectedTagIds, tagQuery]);

  const addTag = (tagId: string) => {
    setSelectedTagIds((current) => {
      if (current.includes(tagId) || current.length >= MAX_TAGS_PER_FOLDER) {
        return current;
      }
      return [...current, tagId];
    });
    setTagQuery("");
    setShowSuggestions(false);
  };

  const addTagFromQuery = () => {
    const match = existingTags.find(
      (tag) => tag.name.toLowerCase() === tagQuery.trim().toLowerCase(),
    );
    if (match) addTag(match.id);
  };

  const removeTag = (tagId: string) => {
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await onSubmit({
        name: trimmed,
        color: selectedColor,
        tagIds: selectedTagIds,
      });
      onClose();
    } finally {
      setIsSaving(false);
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="pointer-events-auto w-full max-w-md bg-[#232323] border border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="space-y-3">
                  <h2 className="text-2xl font-headline font-bold text-white tracking-tight">
                    {initialData ? "Edit Folder" : "Create New Folder"}
                  </h2>
                  <p className="text-[#bbcbbb]/60 text-sm leading-relaxed font-medium">
                    {initialData
                      ? "Update your collection's name, color, and tags."
                      : "Organize your investment pipeline by creating a dedicated collection for specific sectors, stages, or research themes."}
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                      FOLDER NAME
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Q1 FinTech Research"
                      className="w-full bg-surface-card border border-white/5 px-4 py-3.5 text-sm text-[#e5e2e1] placeholder-[#bbcbbb]/20 focus:outline-none focus:ring-1 focus:ring-[#54e98a]/30 transition-all font-medium"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                      FOLDER IDENTITY
                    </label>
                    <div className="flex items-center gap-3 ml-1">
                      {FOLDER_COLORS.map((color) => (
                        <button
                          key={color.key}
                          type="button"
                          onClick={() => setSelectedColor(color.key)}
                          className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center ${
                            selectedColor === color.key
                              ? "scale-110 border-white/40"
                              : "border-white/10 hover:scale-105"
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.label}
                        >
                          {selectedColor === color.key && (
                            <Check size={14} className="text-black/50" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                        ADD TAGS
                      </label>
                      <span className="text-[10px] font-semibold text-[#bbcbbb]/40">
                        {selectedTagIds.length}/{MAX_TAGS_PER_FOLDER}
                      </span>
                    </div>
                    <p className="text-[#bbcbbb]/50 text-xs leading-relaxed font-medium">
                      Tags stay owner-only and are limited to 4 per folder.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {selectedTags.map((tag) => {
                        const baseColor = getColorHex(tag.color);
                        return (
                          <div
                            key={tag.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 group border transition-colors"
                            style={{
                              backgroundColor: `${baseColor}15`,
                              borderColor: `${baseColor}30`,
                            }}
                          >
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider"
                              style={{ color: baseColor }}
                            >
                              {tag.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeTag(tag.id)}
                              className="opacity-50 hover:opacity-100 hover:text-red-400 transition-all"
                              style={{ color: baseColor }}
                            >
                              <X size={10} strokeWidth={3} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="relative group">
                      <input
                        type="text"
                        value={tagQuery}
                        onChange={(e) => {
                          setTagQuery(e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setShowSuggestions(false)}
                        onKeyDown={(e) => e.key === "Enter" && addTagFromQuery()}
                        placeholder="Add more tags..."
                        className="w-full bg-surface-card border border-white/5 px-4 py-3.5 text-xs text-[#e5e2e1] placeholder-[#bbcbbb]/10 focus:outline-none focus:ring-1 focus:ring-[#54e98a]/20 transition-all font-medium pr-10"
                      />
                      <button
                        type="button"
                        onClick={addTagFromQuery}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbcbbb]/20 hover:text-[#54e98a] transition-colors"
                      >
                        <Plus size={16} />
                      </button>

                      <AnimatePresence>
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-white/10 shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                          >
                            {filteredSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  addTag(suggestion.id);
                                }}
                                className="w-full px-4 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2 text-left"
                              >
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: suggestion.color }}
                                />
                                <span className="text-sm font-medium text-[#e5e2e1]">
                                  {suggestion.name}
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-6 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-sm font-bold text-[#bbcbbb]/40 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSaving || !name.trim()}
                    className="px-8 py-3.5 bg-[#54e98a] text-[#003919] font-bold text-sm tracking-tight flex items-center gap-2 hover:shadow-[0_0_20px_rgba(84,233,138,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    {isSaving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : initialData ? (
                      "Save Changes"
                    ) : (
                      "Create Folder"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
