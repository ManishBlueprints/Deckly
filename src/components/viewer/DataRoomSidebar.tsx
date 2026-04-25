import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  FileText,
  FolderOpen,
} from "lucide-react";
import { DataRoomDocument, Deck } from "../../types";

export type DataRoomSidebarSection = {
  id: string;
  title: string;
  documents: DataRoomDocument[];
  icon: "documents" | "folder";
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
};

export function buildDataRoomSidebarSections(
  documents: DataRoomDocument[],
  folders: Array<{ id: string; name: string }>,
) {
  const docsByFolder = new Map<string, DataRoomDocument[]>();
  const folderOrder = folders.map((folder) => folder.id);
  const discoveredFolderOrder: string[] = [];

  documents.forEach((doc) => {
    const folderId = doc.folder_id || "unorganized";
    if (folderId !== "unorganized" && !discoveredFolderOrder.includes(folderId)) {
      discoveredFolderOrder.push(folderId);
    }

    const current = docsByFolder.get(folderId) || [];
    current.push(doc);
    docsByFolder.set(folderId, current);
  });

  const orderedFolderIds = [
    ...folderOrder.filter((folderId) => docsByFolder.has(folderId)),
    ...discoveredFolderOrder.filter((folderId) => !folderOrder.includes(folderId)),
  ];

  const sections: DataRoomSidebarSection[] = [];

  const unorganized = docsByFolder.get("unorganized");
  if (unorganized && unorganized.length > 0) {
    sections.push({
      id: "unorganized",
      title: "Documents",
      documents: unorganized,
      icon: "documents",
    });
  }

  orderedFolderIds.forEach((folderId) => {
    sections.push({
      id: folderId,
      title:
        folders.find((folder) => folder.id === folderId)?.name ||
        docsByFolder.get(folderId)?.[0]?.folder_name ||
        "Folder",
      documents: docsByFolder.get(folderId) || [],
      icon: "folder",
      collapsible: true,
    });
  });

  return sections;
}

interface DataRoomSidebarProps {
  roomName: string;
  roomIconUrl?: string | null;
  totalDocuments: number;
  totalLabel: string;
  sections: DataRoomSidebarSection[];
  selectedDeckId: string | null;
  onSelectDeck: (deck: Deck) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isMobile: boolean;
  emptyMessage: string;
  footerText?: string;
}

export function DataRoomSidebar({
  roomName,
  roomIconUrl,
  totalDocuments,
  totalLabel,
  sections,
  selectedDeckId,
  onSelectDeck,
  sidebarOpen,
  onToggleSidebar,
  isMobile,
  emptyMessage,
  footerText = "Powered by Deckly",
}: DataRoomSidebarProps) {
  const [localExpandedFolders, setLocalExpandedFolders] = useState<Record<string, boolean>>({});
  const activeSelection = (() => {
    for (const section of sections) {
      for (const doc of section.documents) {
        if (doc.deck?.id === selectedDeckId) {
          return {
            deck: doc.deck,
            sectionTitle: section.title,
            isFolder: section.icon === "folder",
          };
        }
      }
    }

    return null;
  })();

  useEffect(() => {
    setLocalExpandedFolders({});
  }, [sections]);

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggleSidebar}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-2 z-50 flex justify-center px-2 sm:px-4">
        <div className={`relative pointer-events-none w-full ${isMobile ? "" : "max-w-2xl"}`}>
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="flex w-full items-center gap-1.5 border border-[#242424] bg-[#101010]/95 px-2 py-1.5 text-left shadow-[0_14px_36px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors hover:border-[#2f2f2f]"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-[#2a2a2a] bg-[#161616]">
                {roomIconUrl ? (
                  <img src={roomIconUrl} alt={roomName} className="h-full w-full object-cover" />
                ) : (
                  <FileText size={12} className="text-deckly-primary" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  <span className="truncate">{roomName}</span>
                  <span className="hidden border border-white/10 bg-white/5 px-1.5 py-0.5 text-[6px] tracking-[0.12em] text-slate-400 sm:inline-flex">
                    {totalDocuments} {totalDocuments === 1 ? totalLabel.slice(0, -1) : totalLabel}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-100">
                  {activeSelection?.deck?.title || "Browse documents"}
                </p>
                <p className="mt-0.5 truncate text-[8px] font-medium text-slate-500">
                  {activeSelection
                    ? activeSelection.isFolder
                      ? `In ${activeSelection.sectionTitle}`
                      : "Tap to switch documents"
                    : emptyMessage}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="hidden border border-white/10 bg-black/25 px-1.5 py-0.5 text-[7px] font-semibold text-slate-300 md:inline-flex">
                  {sidebarOpen ? "Close" : "Documents"}
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-white/10 bg-white/5 text-slate-300">
                  <ChevronRight
                    size={12}
                    className={`transition-transform duration-300 ${sidebarOpen ? "rotate-90" : ""}`}
                  />
                </span>
              </div>
            </button>

            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.985 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden border border-[#242424] bg-[#101010]/96 shadow-[0_24px_72px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        {roomName}
                      </p>
                      <p className="truncate text-[10px] font-medium text-slate-400">
                        {totalDocuments} {totalDocuments === 1 ? totalLabel.slice(0, -1) : totalLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleSidebar}
                      className="flex h-7 w-7 items-center justify-center border border-white/10 bg-white/5 text-slate-300 transition-colors hover:text-white"
                    >
                      <ChevronRight size={12} className="rotate-90" />
                    </button>
                  </div>

                  <div className="max-h-[min(55vh,30rem)] overflow-y-auto px-3 py-2.5 custom-scrollbar">
                    {sections.length === 0 ? (
                      <div className="py-10 text-center">
                        <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-slate-600">
                          <FileText size={16} />
                        </div>
                        <p className="px-2 text-[11px] leading-relaxed text-slate-500">{emptyMessage}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {sections.map((section) => {
                            const isFolder = section.icon === "folder";
                            const isExpanded = section.expanded ?? localExpandedFolders[section.id] ?? false;
                            const handleToggle = section.onToggle ?? (() => {
                              setLocalExpandedFolders((prev) => ({
                                ...prev,
                                [section.id]: !(prev[section.id] ?? false),
                              }));
                            });

                            return (
                              <button
                                key={`${section.id}-quick`}
                                type="button"
                                onClick={() => {
                                  if (isFolder && section.collapsible) {
                                    handleToggle();
                                    return;
                                  }

                                  const firstDeck = section.documents[0]?.deck;
                                  if (firstDeck) {
                                    onSelectDeck(firstDeck);
                                  }
                                }}
                                className={`flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-[10px] font-semibold transition-colors ${isFolder ? "border-deckly-primary/20 bg-deckly-primary/8 text-deckly-primary" : "border-white/10 bg-white/5 text-slate-300"} ${selectedDeckId && section.documents.some((doc) => doc.deck?.id === selectedDeckId) ? "ring-1 ring-deckly-primary/30" : ""}`}
                              >
                                {isFolder ? <FolderOpen size={11} /> : <FileText size={11} />}
                                <span className="max-w-28 truncate">{section.title}</span>
                                <span className="bg-black/30 px-1.5 py-0.5 text-[8px] text-slate-400">
                                  {section.documents.length}
                                </span>
                                {isFolder && section.collapsible ? (
                                  <ChevronRight size={11} className={`transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        {sections.map((section) => {
                          const isFolder = section.icon === "folder";
                          const isExpanded = section.expanded ?? localExpandedFolders[section.id] ?? false;
                          const handleToggle = section.onToggle ?? (() => {
                            setLocalExpandedFolders((prev) => ({
                              ...prev,
                              [section.id]: !(prev[section.id] ?? false),
                            }));
                          });

                          return (
                            <section key={section.id} className="border border-white/5 bg-black/20 p-2">
                              <div className="flex items-center justify-between gap-2 px-0.5">
                                {isFolder && section.collapsible ? (
                                  <button
                                    type="button"
                                    onClick={handleToggle}
                                    className="flex min-w-0 items-center gap-1.5 text-left"
                                  >
                                    <ChevronRight
                                      size={12}
                                      className={`shrink-0 text-deckly-primary transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    />
                                    <div className="flex min-w-0 items-center gap-1.5">
                                      <FolderOpen size={12} className="shrink-0 text-deckly-primary" />
                                      <h3 className="truncate text-[9px] font-bold uppercase tracking-[0.18em] text-slate-300">
                                        {section.title}
                                      </h3>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <FileText size={11} className="shrink-0 text-slate-500" />
                                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                      {section.title}
                                    </p>
                                  </div>
                                )}

                                <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[9px] font-semibold text-slate-400">
                                  {section.documents.length}
                                </span>
                              </div>

                              {(!isFolder || isExpanded) && (
                                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                  {section.documents.map((doc) => {
                                    const deck = doc.deck;
                                    const isActive = selectedDeckId === deck?.id;

                                    return (
                                      <button
                                        key={doc.deck_id}
                                        onClick={() => deck && onSelectDeck(deck)}
                                        className={`flex w-44 shrink-0 items-center gap-2.5 border px-2.5 py-2 text-left transition-all duration-200 group ${isActive ? "border-deckly-primary/25 bg-deckly-primary/8" : "border-transparent hover:bg-white/5"}`}
                                      >
                                        <div className={`h-7 w-10 shrink-0 overflow-hidden border bg-black/40 transition-all duration-300 ${isActive ? "border-deckly-primary/35" : "border-[#222] grayscale group-hover:grayscale-0"}`}>
                                          {deck?.pages?.[0]?.image_url ? (
                                            <img src={deck.pages[0].image_url} alt="" className="h-full w-full object-cover" />
                                          ) : (
                                            <div className="flex h-full w-full items-center justify-center">
                                              <FileText size={14} className="text-slate-800" />
                                            </div>
                                          )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                          <p className={`truncate text-[11px] font-semibold leading-tight transition-colors ${isActive ? "text-deckly-primary" : "text-slate-300 group-hover:text-deckly-primary"}`}>
                                            {deck?.title || "Untitled Resource"}
                                          </p>
                                          <p className={`mt-0.5 text-[9px] font-medium leading-tight transition-colors ${isActive ? "text-deckly-primary/60" : "text-slate-600"}`}>
                                            {deck?.pages?.length || 0} Slides
                                          </p>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 px-3.5 py-2">
                    <p className="text-center text-[8px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      {footerText}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
