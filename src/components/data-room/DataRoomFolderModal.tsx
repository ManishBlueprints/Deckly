import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { GlobalTag } from "../../types";
import {
  DEFAULT_FOLDER_COLOR,
  FOLDER_PICKER_COLORS,
  FOLDER_COLORS,
  FolderColorKey,
} from "../../constants/folderColors";
import { MAX_TAGS_PER_FOLDER } from "../../constants/folderValidation";
import { DataRoomModalShell } from "./shared/DataRoomModalShell";
import { ColorSwatchPicker } from "./shared/ColorSwatchPicker";
import { useTheme } from "../../contexts/ThemeContext";
import { asItemColorVariables, getAccessibleColorSet } from "../../utils/accessibleColor";
import { Button } from "../ui/button";

interface DataRoomFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    color: FolderColorKey;
    tagIds: string[];
  }) => Promise<void>;
  existingTags: GlobalTag[];
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
  const { theme } = useTheme();
  const nameInputId = useId();
  const tagInputId = useId();
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
    } catch (error) {
      console.error("Failed to save data room folder", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save folder.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DataRoomModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={initialData ? "Edit folder" : "Create folder"}
      panelClassName="w-full max-w-md rounded-lg border-ui-border bg-ui-elevated text-ui-text shadow-[var(--ui-shadow-overlay)]"
    >
      <div className="space-y-6 p-6 sm:p-7">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-ui-text">
              {initialData ? "Edit Folder" : "Create New Folder"}
            </h2>
            <p className="text-sm leading-relaxed text-ui-muted">
              {initialData
                ? "Update your collection's name, color, and tags."
                : "Organize your investment pipeline by creating a dedicated collection for specific sectors, stages, or research themes."}
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2.5">
              <label
                htmlFor={nameInputId}
                className="block text-xs font-medium text-ui-muted"
              >
                FOLDER NAME
              </label>
              <input
                id={nameInputId}
                name={nameInputId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Q1 FinTech Research"
                className="h-11 w-full rounded-md border border-ui-border bg-ui-surface px-3.5 text-sm text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary/45 focus:ring-2 focus:ring-ui-primary/15"
                autoFocus
              />
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-medium text-ui-muted">
                FOLDER IDENTITY
              </div>
              <ColorSwatchPicker
                colors={FOLDER_PICKER_COLORS}
                value={selectedColor}
                onChange={(value) => setSelectedColor(value as FolderColorKey)}
                swatchClassName="border-ui-border"
              />
            </div>

            <div className="space-y-3">
              <label
                htmlFor={tagInputId}
                className="block text-xs font-medium text-ui-muted"
              >
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
                        "--tag-color": baseColor,
                      } as CSSProperties}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--tag-color)]">
                        {tag.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        className="text-[color:var(--tag-color)] opacity-50 transition-all hover:text-ui-destructive hover:opacity-100"
                      >
                        <X size={10} strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="relative group">
                <input
                  id={tagInputId}
                  name={tagInputId}
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
                  className="h-11 w-full rounded-md border border-ui-border bg-ui-surface px-3.5 pr-10 text-sm text-ui-text outline-none transition-colors placeholder:text-ui-muted focus:border-ui-primary/45 focus:ring-2 focus:ring-ui-primary/15"
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
                            className="h-2 w-2 rounded-full border border-[var(--item-color-border)] bg-[var(--item-color)]"
                            style={asItemColorVariables(getAccessibleColorSet(suggestion.color, theme))}
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

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="rounded-md text-xs normal-case tracking-normal"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSaving || !name.trim()}
              loading={isSaving}
              className="rounded-md text-xs normal-case tracking-normal"
            >
              {initialData ? (
                "Save Changes"
              ) : (
                "Create Folder"
              )}
            </Button>
          </div>
      </div>
    </DataRoomModalShell>
  );
}
