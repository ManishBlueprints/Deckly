import { useEffect, useState, useRef, useCallback, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, ShieldAlert, Loader2, StickyNote } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import {
  useDataRoomNotes,
  useSaveDataRoomNoteMutation,
} from "../../hooks/useDataRoomViewerQueries";

interface RoomNotesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  dataRoomId: string;
  onRequireAuth: () => void;
}

export function RoomNotesSidebar({
  isOpen,
  onClose,
  dataRoomId,
  onRequireAuth,
}: RoomNotesSidebarProps) {
  const { session } = useAuth();
  const [content, setContent] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data: initialNote, isLoading: isInitialLoading } = useDataRoomNotes(
    dataRoomId,
    session?.user?.id,
  );
  const saveNoteMutation = useSaveDataRoomNoteMutation(session?.user?.id);

  useEffect(() => {
    if (initialNote !== undefined) {
      setContent(initialNote);
    }
  }, [initialNote]);

  const debouncedSave = useCallback(
    (newContent: string) => {
      if (!session) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveNoteMutation.mutate({ dataRoomId, content: newContent });
      }, 1000);
    },
    [dataRoomId, session, saveNoteMutation],
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/35 backdrop-blur-[2px] z-[110]"
          />

          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed top-4 right-4 z-[120] flex h-auto w-[min(22rem,calc(100vw-2rem))] max-h-[18rem] flex-col overflow-hidden border border-white/10 bg-[#101114] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
          >
            <div className="border-b border-white/5 bg-[#0f1116] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-deckly-primary/20 bg-deckly-primary/10 text-deckly-primary">
                    <StickyNote size={16} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.22em] text-slate-100">
                      Private Notes
                    </h3>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <ShieldAlert size={11} className="text-emerald-500" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-500">
                        Private to you
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                      Notes for this saved room stay private to your account
                    </p>
                  </div>
                </div>
                <div>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center border border-white/10 bg-white/[0.03] text-slate-400 transition-colors hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3">
              {!session ? (
                <div className="flex h-full flex-col items-center justify-center text-center space-y-4 px-3">
                  <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white/[0.03] text-slate-400">
                    <Save size={20} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-semibold text-white">
                      Sign in to take notes
                    </h4>
                    <p className="mx-auto max-w-[220px] text-sm leading-relaxed text-slate-400">
                      Your notes are private to you and saved to your account.
                    </p>
                  </div>
                  <Button
                    onClick={onRequireAuth}
                    className="bg-deckly-primary px-5 font-semibold text-slate-950 hover:bg-deckly-primary/90"
                  >
                    Get Started
                  </Button>
                </div>
              ) : isInitialLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 size={24} className="text-deckly-primary animate-spin" />
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="rounded-none border border-deckly-primary/15 bg-[#0d1016] p-3">
                    <textarea
                      value={content}
                      onChange={handleChange}
                      placeholder="Write a private note..."
                      className="min-h-[7.5rem] w-full resize-none border-none bg-transparent text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500"
                      autoFocus
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <AnimatePresence mode="wait">
                        {saveNoteMutation.isPending ? (
                          <motion.div
                            key="saving"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-deckly-primary"
                          >
                            <Loader2 size={11} className="animate-spin" />
                            Saving...
                          </motion.div>
                        ) : content !== (initialNote || "") ? (
                          <motion.div
                            key="unsaved"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                          >
                            Unsaved changes
                          </motion.div>
                        ) : (
                          content && (
                            <motion.div
                              key="saved"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600"
                            >
                              All notes saved
                            </motion.div>
                          )
                        )}
                      </AnimatePresence>
                      <p className="text-[9px] text-slate-500">
                        Auto-saves as you type
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
