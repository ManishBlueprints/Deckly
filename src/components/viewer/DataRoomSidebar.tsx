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
  sidebarWidthClassName: string;
  toggleOffset: string;
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
  sidebarWidthClassName,
  toggleOffset,
  emptyMessage,
  footerText = "Powered by Deckly",
}: DataRoomSidebarProps) {
  const [localExpandedFolders, setLocalExpandedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalExpandedFolders({});
  }, [sections]);

  return (
    <>
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggleSidebar}
            className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <div
        className={`
          ${sidebarOpen ? sidebarWidthClassName : "w-0"}
          bg-[#111] border-r border-[#222] flex flex-col transition-all duration-500 overflow-hidden shrink-0 relative z-50 shadow-xl
          ${isMobile ? "absolute inset-y-0 left-0" : "relative"}
        `}
      >
        <div className="p-6 border-b border-[#222] bg-[#1a1a1a]/30">
          <div className="flex items-center gap-3">
            <div className="relative">
              {roomIconUrl ? (
                <img
                  src={roomIconUrl}
                  alt={roomName}
                  className="w-10 h-10 rounded-md object-cover border border-[#333]"
                />
              ) : (
                <div className="w-10 h-10 rounded-md bg-[#1a1a1a] flex items-center justify-center border border-[#333]">
                  <FileText size={18} className="text-deckly-primary" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xs font-semibold text-slate-200 truncate">
                {roomName}
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                {totalDocuments} {totalDocuments === 1 ? totalLabel.slice(0, -1) : totalLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          {sections.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-600">
                <FileText size={20} />
              </div>
              <p className="text-sm text-slate-500">{emptyMessage}</p>
            </div>
          ) : (
            sections.map((section) => {
              const isFolder = section.icon === "folder";
              const isExpanded = section.expanded ?? localExpandedFolders[section.id] ?? false;
              const handleToggle = section.onToggle ?? (() => {
                setLocalExpandedFolders((prev) => ({
                  ...prev,
                  [section.id]: !(prev[section.id] ?? false),
                }));
              });

              return (
                <section key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    {isFolder && section.collapsible ? (
                      <button
                        type="button"
                        onClick={handleToggle}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <ChevronRight
                          size={13}
                          className={`text-deckly-primary shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen size={13} className="text-deckly-primary shrink-0" />
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 truncate">
                            {section.title}
                          </h3>
                        </div>
                      </button>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText size={12} className="text-slate-500 shrink-0" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {section.title}
                        </p>
                      </div>
                    )}

                    <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-semibold text-slate-400">
                      {section.documents.length}
                    </span>
                  </div>

                  {(!isFolder || isExpanded) && (
                    <div className="space-y-1.5">
                      {section.documents.map((doc) => {
                        const deck = doc.deck;
                        const isActive = selectedDeckId === deck?.id;

                        return (
                          <button
                            key={doc.deck_id}
                            onClick={() => deck && onSelectDeck(deck)}
                            className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-md border transition-all duration-200 group ${isActive ? "bg-deckly-primary/5 border-deckly-primary/30" : "hover:bg-[#1a1a1a] border-transparent"}`}
                          >
                            <div className={`w-9 h-7 rounded-sm bg-black/40 border overflow-hidden shrink-0 transition-all duration-500 ${isActive ? "border-deckly-primary/40" : "border-[#222] grayscale group-hover:grayscale-0"}`}>
                              {deck?.pages?.[0]?.image_url ? (
                                <img src={deck.pages[0].image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <FileText size={16} className="text-slate-800" />
                                </div>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold truncate transition-colors ${isActive ? "text-deckly-primary" : "text-slate-300 group-hover:text-deckly-primary"}`}>
                                {deck?.title || "Untitled Resource"}
                              </p>
                              <p className={`text-[10px] font-medium mt-0.5 transition-colors ${isActive ? "text-deckly-primary/60" : "text-slate-600"}`}>
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
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5">
          <p className="text-[9px] text-slate-600 text-center uppercase tracking-[0.15em] font-bold">
            {footerText}
          </p>
        </div>
      </div>

      {!isMobile && (
        <button
          onClick={onToggleSidebar}
          className="absolute top-1/2 -translate-y-1/2 z-30 w-6 h-10 flex items-center justify-center bg-[#111] border border-[#222] rounded-r-md text-slate-500 hover:text-deckly-primary transition-all shadow-xl"
          style={{ left: sidebarOpen ? toggleOffset : "0" }}
        >
          <ChevronRight
            size={16}
            className={`transition-transform duration-500 ${sidebarOpen ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {isMobile && !sidebarOpen && (
        <button
          onClick={onToggleSidebar}
          className="absolute top-6 left-4 z-[100] w-9 h-9 flex items-center justify-center bg-[#111] border border-[#333] rounded-md text-white shadow-xl active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </>
  );
}
