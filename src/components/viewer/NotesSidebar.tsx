import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import {
  useInvestorNotes,
  useSaveNoteMutation,
} from "../../hooks/useViewerQueries";

interface NotesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  deckId: string;
  onRequireAuth: () => void;
}

export function NotesSidebar({
  isOpen,
  onClose,
  deckId,
  onRequireAuth,
}: NotesSidebarProps) {
  const { session } = useAuth();
  const [content, setContent] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // TanStack Queries
  const { data: initialNote, isLoading: isInitialLoading } = useInvestorNotes(
    deckId,
    session?.user?.id,
  );
  const saveNoteMutation = useSaveNoteMutation();

  // Sync local state with initial query data
  useEffect(() => {
    if (initialNote !== undefined) {
      setContent(initialNote);
    }
  }, [initialNote]);

  // Debounced save
  const debouncedSave = useCallback(
    (newContent: string) => {
      if (!session) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveNoteMutation.mutate({ deckId, content: newContent });
      }, 1000); // 1 second debounce
    },
    [deckId, session, saveNoteMutation],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!session) {
      onRequireAuth();
      return;
    }
    const newContent = e.target.value;
    setContent(newContent);
    debouncedSave(newContent);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] lg:hidden"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0d0f14] border-l border-white/10 z-[120] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-deckly-primary/10 flex items-center justify-center">
                  <Sparkles size={20} className="text-deckly-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Private Notes
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert size={12} className="text-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                      Founder cannot see this
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 flex flex-col gap-4">
              {!session ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-slate-400">
                    <Save size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold text-white">
                      Sign in to take notes
                    </h4>
                    <p className="text-sm text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                      Your notes are private to you and auto-saved to your
                      account.
                    </p>
                  </div>
                  <Button
                    onClick={onRequireAuth}
                    className="bg-deckly-primary hover:bg-deckly-primary/90 text-slate-950 font-bold px-8"
                  >
                    Get Started
                  </Button>
                </div>
              ) : isInitialLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2
                    size={32}
                    className="text-deckly-primary animate-spin"
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col relative group">
                  <textarea
                    value={content}
                    onChange={handleChange}
                    placeholder="Write your private thoughts, questions, or analysis here..."
                    className="flex-1 w-full bg-transparent text-slate-200 placeholder:text-slate-600 resize-none outline-none text-base leading-relaxed font-medium"
                    autoFocus
                  />

                  {/* Status Indicator */}
                  <div className="absolute bottom-0 right-0 py-4 flex items-center gap-2 pointer-events-none">
                    <AnimatePresence mode="wait">
                      {saveNoteMutation.isPending ? (
                        <motion.div
                          key="saving"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-2 text-[10px] font-bold text-deckly-primary uppercase tracking-widest"
                        >
                          <Loader2 size={12} className="animate-spin" />
                          Saving...
                        </motion.div>
                      ) : content !== (initialNote || "") ? (
                        <motion.div
                          key="unsaved"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-[10px] font-bold text-slate-500 uppercase tracking-widest"
                        >
                          Unsaved changes
                        </motion.div>
                      ) : (
                        content && (
                          <motion.div
                            key="saved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[10px] font-bold text-slate-600 uppercase tracking-widest"
                          >
                            All notes saved
                          </motion.div>
                        )
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Tip */}
            {session && (
              <div className="p-6 bg-white/[0.02] border-t border-white/5">
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  Tip: Use these notes to compile your thoughts. They'll always
                  be here when you return to this room.{" "}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
