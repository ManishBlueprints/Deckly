import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { DataRoomTag } from "../../types";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_PICKER_COLORS,
  FOLDER_COLORS,
  FolderColorKey,
} from "../../constants/folderColors";
import { MAX_TAGS_PER_FOLDER } from "../../constants/folderValidation";
import { DataRoomModalShell } from "./shared/DataRoomModalShell";
import { ColorSwatchPicker } from "./shared/ColorSwatchPicker";

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
    const normalizedQuery = tagQuery.trim().toLowerCase();
    if (!normalizedQuery) return;

    const exactMatch = existingTags.find(
      (tag) => tag.name.toLowerCase() === normalizedQuery,
    );
    if (exactMatch) {
      addTag(exactMatch.id);
      return;
    }

    const fallbackMatch = filteredSuggestions[0];
    if (fallbackMatch) {
      addTag(fallbackMatch.id);
    }
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
    <DataRoomModalShell
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="pointer-events-auto w-full max-w-md rounded-none border border-border bg-surface-card shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden"
    >
      <div className="p-8 space-y-8">
          <div className="space-y-3">
            <h2 className="text-2xl font-headline font-bold text-foreground tracking-tight">
              {initialData ? "Edit Folder" : "Create New Folder"}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed font-medium">
              {initialData
                ? "Update your collection's name, color, and tags."
                : "Organize your investment pipeline by creating a dedicated collection for specific sectors, stages, or research themes."}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground block ml-1">
                FOLDER NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 FinTech Research"
                className="w-full bg-surface-low border border-border px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground block ml-1">
                FOLDER IDENTITY
              </label>
              <ColorSwatchPicker
                colors={FOLDER_PICKER_COLORS}
                value={selectedColor}
                onChange={(value) => setSelectedColor(value as FolderColorKey)}
                className="ml-1"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground block ml-1">
                ADD TAGS
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map((tag) => {
                  const baseColor = getColorHex(tag.color);
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 group border border-border transition-colors"
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
                        className="opacity-50 hover:opacity-100 hover:text-destructive transition-all"
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
                  className="w-full bg-surface-low border border-border px-4 py-3.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium pr-10"
                />
                <button
                  type="button"
                  onClick={addTagFromQuery}
                  disabled={filteredSuggestions.length === 0 && !existingTags.some((tag) => tag.name.toLowerCase() === tagQuery.trim().toLowerCase())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-primary transition-colors"
                >
                  <Plus size={16} />
                </button>

                <AnimatePresence>
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute z-50 top-full left-0 right-0 mt-2 bg-surface-high border border-border shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                    >
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            addTag(suggestion.id);
                          }}
                          className="w-full px-4 py-2 hover:bg-surface-highest cursor-pointer flex items-center gap-2 text-left"
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: suggestion.color }}
                          />
                          <span className="text-sm font-medium text-foreground">
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
              className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSaving || !name.trim()}
              className="px-8 py-3.5 bg-primary text-primary-foreground font-bold text-sm tracking-tight flex items-center gap-2 hover:bg-primary/90 hover:shadow-[0_0_20px_hsla(142,76%,62%,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
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
    </DataRoomModalShell>
  );
}
