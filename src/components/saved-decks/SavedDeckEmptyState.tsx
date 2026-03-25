import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface SavedDeckEmptyStateProps {
  onCreateFolder: () => void;
}

export function SavedDeckEmptyState({
  onCreateFolder,
}: SavedDeckEmptyStateProps) {
  const [showTip, setShowTip] = useState(true);

  return (
    <section className="flex-1 flex items-center justify-center px-6 py-12 md:px-12 md:py-24 bg-deckly-background min-h-[700px] font-body w-full">
      <div className="max-w-xl w-full text-center">
        {/* Artistic Empty State Representation */}
        <div className="relative mb-12 inline-block">
          {/* Background Layers */}
          <div className="absolute inset-0 bg-[#54e98a]/5 blur-[80px] rounded-full scale-150"></div>

          {/* Asymmetric Graphic Elements */}
          <div className="relative flex items-center justify-center">
            {/* Back Card */}
            <motion.div
              initial={{ opacity: 0, rotate: -10, x: 20 }}
              animate={{ opacity: 1, rotate: -3, x: 16 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="w-48 h-48 md:w-64 md:h-64 border border-[#3d4a3e]/20 rounded-lg flex items-center justify-center bg-[#0e0e0e] shadow-2xl"
            >
              <span className="material-symbols-outlined text-[#54e98a]/10 text-6xl md:text-8xl">
                folder_open
              </span>
            </motion.div>

            {/* Front Card */}
            <motion.div
              initial={{ opacity: 0, rotate: 10, x: -20 }}
              animate={{ opacity: 1, rotate: 6, x: -16 }}
              transition={{ duration: 0.8 }}
              className="absolute w-48 h-48 md:w-64 md:h-64 border border-[#54e98a]/30 rounded-lg flex items-center justify-center bg-[#1c1b1b] shadow-2xl backdrop-blur-sm"
            >
              <div className="flex flex-col items-center">
                <span className="material-symbols-outlined text-[#54e98a] text-4xl md:text-6xl mb-4">
                  auto_awesome
                </span>
                <div className="w-24 md:w-32 h-1 bg-[#54e98a]/20 rounded-full mb-2"></div>
                <div className="w-16 md:w-20 h-1 bg-[#54e98a]/10 rounded-full"></div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="relative z-10"
        >
          <h2 className="text-3xl md:text-4xl font-headline font-extrabold tracking-tighter text-[#e5e2e1] mb-4">
            No documents yet
          </h2>
          <p className="text-[#bbcbbb]/80 text-base md:text-lg font-light leading-relaxed mb-10 max-w-md mx-auto">
            Your investment pipeline is clear. Start by saving your first deck
            or dragging documents anywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onCreateFolder}
              className="px-8 py-4 bg-[#54e98a] text-[#003919] rounded-lg font-bold text-sm tracking-tight flex items-center space-x-3 hover:shadow-[0_0_30px_rgba(84,233,138,0.3)] transition-all duration-300 active:scale-95 group"
            >
              <span className="material-symbols-outlined">
                create_new_folder
              </span>
              <span>Create Folder</span>
            </button>
          </div>
        </motion.div>

        {/* Curation Metadata */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-16 md:mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-left border-t border-[#3d4a3e]/10 pt-12"
        >
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#54e98a]">
              Curation
            </span>
            <h4 className="text-sm font-bold text-[#e5e2e1]">Auto-Sorting</h4>
            <p className="text-xs text-[#bbcbbb] font-medium leading-relaxed">
              Decks are automatically grouped by sector and funding stage once
              uploaded.
            </p>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#54e98a]">
              Intelligence
            </span>
            <h4 className="text-sm font-bold text-[#e5e2e1]">
              Data Enrichment
            </h4>
            <p className="text-xs text-[#bbcbbb] font-medium leading-relaxed">
              Every folder generates a unique executive summary of its contents.
            </p>
          </div>
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#54e98a]">
              Security
            </span>
            <h4 className="text-sm font-bold text-[#e5e2e1]">Vault Privacy</h4>
            <p className="text-xs text-[#bbcbbb] font-medium leading-relaxed">
              Folders utilize military-grade encryption for sensitive deck data.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Dismissible Contextual Help */}
      <AnimatePresence>
        {showTip && (
          <div className="fixed bottom-10 right-10 flex flex-col items-end space-y-4 z-50">
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: 0,
                x: 20,
                scale: 0.9,
                transition: { duration: 0.2 },
              }}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="hidden md:block bg-[#1c1b1b]/95 backdrop-blur-2xl border border-[#3d4a3e]/20 p-5 rounded-2xl shadow-2xl max-w-xs relative group"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowTip(false)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-[#0e0e0e] border border-[#3d4a3e]/20 rounded-full flex items-center justify-center text-[#bbcbbb]/40 hover:text-[#54e98a] transition-colors shadow-lg opacity-0 group-hover:opacity-100"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>

              <div className="flex items-start space-x-3">
                <span className="material-symbols-outlined text-[#54e98a]">
                  tips_and_updates
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#e5e2e1]/40 mb-1">
                    Quick Tip
                  </p>
                  <p className="text-[11px] text-[#bbcbbb] leading-tight font-medium">
                    Drag and drop PDF files anywhere on the screen to instantly
                    create an <span className="text-[#54e98a]">Unsorted</span>{" "}
                    collection.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
