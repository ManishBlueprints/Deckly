import { useState, useEffect } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string, tags: string[]) => Promise<void>;
  existingTags?: { id: string; name: string; color: string }[];
  initialData?: { name: string; color: string; tags: string[] } | null;
}

const FOLDER_COLORS = [
  { id: "green", value: "#54e98a" },
  { id: "blue", value: "#3b82f6" },
  { id: "purple", value: "#a855f7" },
  { id: "orange", value: "#f97316" },
  { id: "red", value: "#ef4444" },
];

export function CreateFolderModal({ isOpen, onClose, onCreate, existingTags = [], initialData }: CreateFolderModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setSelectedColor(initialData.color);
        setTags(initialData.tags);
      } else {
        setName("");
        setSelectedColor(FOLDER_COLORS[0].value);
        setTags([]);
      }
      setTagInput("");
      setShowTagSuggestions(false);
    }
  }, [isOpen, initialData]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsLoading(true);
    try {
      await onCreate(name, selectedColor, tags);
      onClose();
    } catch (err) {
      console.error("Failed to create folder:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = (val: string = tagInput) => {
    const newTag = val.trim().toUpperCase();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const filteredSuggestions = existingTags
    .filter((t) => !tags.includes(t.name.toUpperCase()))
    .filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()));

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

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[#232323] border border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto"
            >
              <div className="p-8 space-y-8">
                {/* Header */}
                <div className="space-y-3">
                  <h2 className="text-2xl font-headline font-bold text-white tracking-tight">
                    {initialData ? "Edit Folder" : "Create New Folder"}
                  </h2>
                  <p className="text-[#bbcbbb]/60 text-sm leading-relaxed font-medium">
                    {initialData ? "Update your collection's name, color, and tags." : "Organize your investment pipeline by creating a dedicated collection for specific sectors, stages, or research themes."}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-6">
                  {/* Folder Name */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                      FOLDER NAME
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Q1 FinTech Research"
                      className="w-full bg-[#161616] border border-white/5 px-4 py-3.5 text-sm text-[#e5e2e1] placeholder-[#bbcbbb]/20 focus:outline-none focus:ring-1 focus:ring-[#54e98a]/30 transition-all font-medium"
                      autoFocus
                    />
                  </div>

                  {/* Folder Identity (Colors) */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                      FOLDER IDENTITY
                    </label>
                    <div className="flex items-center gap-3 ml-1">
                      {FOLDER_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => setSelectedColor(color.value)}
                          className={`w-8 h-8 transition-all relative ${
                            selectedColor === color.value 
                              ? "ring-2 ring-white/10 ring-offset-4 ring-offset-[#232323] scale-110" 
                              : "hover:scale-105 opacity-80 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: color.value }}
                        >
                          {selectedColor === color.value && (
                            <motion.div 
                              layoutId="activeColor"
                              className="absolute inset-0 border-2 border-white/20"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Add Tags */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.15em] text-[#bbcbbb]/40 block ml-1">
                      ADD TAGS
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {tags.map((tagName) => {
                        const existingTag = existingTags.find(t => t.name.toUpperCase() === tagName.toUpperCase());
                        const baseColor = existingTag ? existingTag.color : '#666666';
                        return (
                          <div 
                            key={tagName}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 group border transition-colors"
                            style={{
                              backgroundColor: `${baseColor}15`,
                              borderColor: `${baseColor}30`,
                            }}
                          >
                            <span 
                              className="text-[9px] font-black uppercase tracking-wider"
                              style={{ color: baseColor }}
                            >
                              {tagName}
                            </span>
                            <button 
                              onClick={() => removeTag(tagName)}
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
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowTagSuggestions(true);
                        }}
                        onFocus={() => setShowTagSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                        placeholder="Add more tags..."
                        className="w-full bg-[#161616] border border-white/5 px-4 py-3.5 text-xs text-[#e5e2e1] placeholder-[#bbcbbb]/10 focus:outline-none focus:ring-1 focus:ring-[#54e98a]/20 transition-all font-medium pr-10"
                      />
                      <button 
                        onClick={() => addTag()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#bbcbbb]/20 hover:text-[#54e98a] transition-colors"
                      >
                        <Plus size={16} />
                      </button>

                      {/* Tag Suggestions Dropdown */}
                      <AnimatePresence>
                        {showTagSuggestions && filteredSuggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="absolute z-50 top-full left-0 right-0 mt-2 bg-[#2a2a2a] border border-white/10 shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar"
                          >
                            {filteredSuggestions.map((suggestion) => (
                              <div
                                key={suggestion.id}
                                onClick={() => addTag(suggestion.name)}
                                className="px-4 py-2 hover:bg-white/5 cursor-pointer flex items-center gap-2"
                              >
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: suggestion.color || '#54e98a' }} 
                                />
                                <span className="text-sm font-medium text-[#e5e2e1]">{suggestion.name}</span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-6 pt-2">
                  <button
                    onClick={onClose}
                    className="text-sm font-bold text-[#bbcbbb]/40 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isLoading || !name.trim()}
                    className="px-8 py-3.5 bg-[#54e98a] text-[#003919] font-black text-sm tracking-tight flex items-center gap-2 hover:shadow-[0_0_20px_rgba(84,233,138,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
                  >
                    {isLoading ? (
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
