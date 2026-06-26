import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Share2,
  Pencil,
  Trash2,
  Plus,
  Settings,
  Check,
  X,
  Upload,
  RotateCcw,
  LogOut,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { deckService } from "../../services/deckService";
import { storageService } from "../../services/storageService";
import { supabase } from "../../services/supabase";
import { extractStoragePath } from "../../services/storagePaths";
import defaultBanner from "../../assets/banner.png";
import AnalyticsModal from "../dashboard/AnalyticsModal";
import DeckDetailPanel from "./DeckDetailPanel";
import { Deck, BrandingSettings } from "../../types";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { DeckLinkManagerModal } from "../dashboard/DeckLinkManagerModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { getDeckPreviewPath } from "../../utils/url";

interface DeckListProps {
  decks: Deck[];
  branding: { room_name: string; banner_url: string };
  loading: boolean;
  onDelete: (deck: Deck) => void;
  onUpdate: (deck: Deck) => void;
  onBrandingUpdate: (branding: Partial<BrandingSettings>) => void;
}

const sanitizeImageUrl = (
  value: unknown,
  fallback: string,
): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return fallback;
  }

  if (trimmed.startsWith("/")) return trimmed;

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "http:" || parsed.protocol === "https:"
        ? trimmed
        : fallback;
    } catch {
      return fallback;
    }
  }

  return trimmed;
};

function DeckList({
  decks,
  branding: initialBranding,
  loading,
  onDelete,
  onUpdate,
  onBrandingUpdate,
}: DeckListProps) {
  const [branding, setBranding] = useState(initialBranding);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [showBrandingMenu, setShowBrandingMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAnalyticsDeck, setSelectedAnalyticsDeck] =
    useState<Deck | null>(null);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [selectedDeckForLinks, setSelectedDeckForLinks] = useState<Deck | null>(null);
  const [resetTarget, setResetTarget] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile, isPro } = useAuth();
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [signedBanner, setSignedBanner] = useState<string | null>(null);
  const bannerBackground =
    signedBanner || (branding.banner_url?.startsWith("http") ? branding.banner_url : defaultBanner);

  useEffect(() => {
    setBranding(initialBranding);

    // Batch sign thumbnails and banner when decks or branding changes
    const signAssets = async () => {
      const isEmpty = !decks || decks.length === 0;

      try {
        // 1. Sign thumbnails — clear state when deck list is empty
        if (isEmpty) {
          setThumbnails({});
        } else {
          const urlMap = await deckService.signOwnerThumbnails();
          setThumbnails(urlMap);
        }

        // 2. Sign banner if it's in the private decks bucket.
        //    Run this regardless of whether decks is empty — the banner
        //    belongs to the owner's branding and should always be resolved.
        //    Handle all supported storage URL variants: /public/, /sign/, /authenticated/
        const bannerPath = extractStoragePath(initialBranding.banner_url, "decks");
        if (bannerPath) {
          // Pass the current session token so the Edge Function can exercise
          // owner-mode auth and sign private-bucket paths.
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const { data: fnData } = await supabase.functions.invoke(
            "sign-deck-url",
            {
              body: { image_paths: [bannerPath] },
              headers: session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : undefined,
            },
          );
          if (fnData?.signed_pages?.[0]?.signedUrl) {
            setSignedBanner(fnData.signed_pages[0].signedUrl);
          } else {
            setSignedBanner(null);
          }
        } else {
          // No private banner — clear any stale signed value
          setSignedBanner(null);
        }
      } catch (err) {
        console.warn("Failed to sign dashboard assets:", err);
      }
    };

    signAssets();
  }, [initialBranding, decks]);


  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to log out.";
      console.error("Logout failed:", errorMessage);
      toast.error("Failed to log out. Please try again.");
    }
  };

  const handleStartEdit = () => {
    setEditValue(branding.room_name);
    setIsEditingTitle(true);
    setShowBrandingMenu(false);
  };

  const handleSaveTitle = async () => {
    if (!editValue.trim() || editValue === branding.room_name) {
      setIsEditingTitle(false);
      return;
    }

    if (!profile?.id) {
      setError("You must be logged in to update branding.");
      return;
    }

    setSaving(true);
    try {
      await deckService.updateBrandingSettings(
        { room_name: editValue },
        profile?.id,
      );
      setBranding((prev) => ({ ...prev, room_name: editValue }));
      onBrandingUpdate({ room_name: editValue });
      setIsEditingTitle(false);
    } catch (err: unknown) {
      setError(
        "Failed to update room name: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    setUploading(true);
    setShowBrandingMenu(false);

    try {
      const lastDotIndex = file.name.lastIndexOf(".");
      const fileExt =
        lastDotIndex !== -1 ? file.name.slice(lastDotIndex + 1) : "";
      const fileName = `${userId}/branding/banner-${Date.now()}${fileExt ? `.${fileExt}` : ""}`;

      const { error: uploadError } = await storageService.upload("decks", fileName, file, {
        upsert: true,
      });

      if (uploadError) throw uploadError;

      const bannerUrl = sanitizeImageUrl(
        storageService.getPublicUrl("decks", fileName),
        defaultBanner,
      );
      await deckService.updateBrandingSettings(
        { banner_url: bannerUrl },
        profile?.id,
      );
      setBranding((prev) => ({ ...prev, banner_url: bannerUrl }));
      onBrandingUpdate({ banner_url: bannerUrl });
    } catch (err: unknown) {
      setError(
        "Failed to upload banner: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setUploading(false);
    }
  };
  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const defaults = { room_name: "Deckly Data Room", banner_url: "" };
      await deckService.updateBrandingSettings(
        {
          room_name: defaults.room_name,
          banner_url: defaults.banner_url, // Match persisted value to local default
        },
        profile?.id,
      );
      setBranding(defaults);
      onBrandingUpdate(defaults); // Keep parent in sync
      setShowBrandingMenu(false);
      setResetTarget(false);
    } catch (err: unknown) {
      setError(
        "Failed to reset branding: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <header
        className="relative w-full h-[300px] flex items-center justify-center text-center border-b border-white/5"
        style={{
          backgroundImage: `url(${bannerBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[1px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-deckly-background"></div>

        <div className="absolute top-8 right-8 z-20 flex flex-col items-end gap-2">
          <button
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border border-white/20",
              showBrandingMenu
                ? "bg-deckly-secondary border-deckly-secondary shadow-lg shadow-deckly-secondary/40 text-slate-950"
                : "bg-white/10 hover:bg-white/20 text-white",
            )}
            onClick={() => setShowBrandingMenu(!showBrandingMenu)}
            disabled={uploading}
          >
            {uploading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
            ) : (
              <Settings size={22} strokeWidth={3} className="flex-shrink-0" />
            )}
          </button>

          <AnimatePresence>
            {showBrandingMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="bg-slate-900 border border-white/10 rounded-2xl p-4 w-56 shadow-2xl flex flex-col gap-1.5"
              >
                <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1 px-2">
                  Branding
                </h3>
                <button
                  onClick={isPro ? handleStartEdit : undefined}
                  className={cn(
                    "flex items-center justify-between w-full p-2.5 rounded-xl text-sm transition-all group/item",
                    isPro
                      ? "hover:bg-deckly-primary/10 hover:text-deckly-primary text-slate-300"
                      : "opacity-50 cursor-not-allowed text-slate-500",
                  )}
                  title={isPro ? "Edit Room Name" : "Pro Feature"}
                >
                  <div className="flex items-center gap-3">
                    <Pencil
                      size={14}
                      strokeWidth={2.5}
                      className={cn(
                        isPro &&
                          "group-hover/item:scale-110 transition-transform flex-shrink-0",
                      )}
                    />
                    <span>Edit Room Name</span>
                  </div>
                  {!isPro && (
                    <span className="text-[8px] font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-400">
                      PRO
                    </span>
                  )}
                </button>
                <button
                  onClick={
                    isPro ? () => fileInputRef.current?.click() : undefined
                  }
                  className={cn(
                    "flex items-center justify-between w-full p-2.5 rounded-xl text-sm transition-all group/item",
                    isPro
                      ? "hover:bg-deckly-primary/10 hover:text-deckly-primary text-slate-300"
                      : "opacity-50 cursor-not-allowed text-slate-500",
                  )}
                  title={isPro ? "Change Banner" : "Pro Feature"}
                >
                  <div className="flex items-center gap-3">
                    <Upload
                      size={14}
                      strokeWidth={2.5}
                      className={cn(
                        isPro &&
                          "group-hover/item:scale-110 transition-transform flex-shrink-0",
                      )}
                    />
                    <span>Change Banner</span>
                  </div>
                  {!isPro && (
                    <span className="text-[8px] font-bold bg-white/10 px-1.5 py-0.5 rounded text-slate-400">
                      PRO
                    </span>
                  )}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-deckly-primary/10 hover:text-deckly-primary text-sm transition-all text-slate-300 group/item"
                >
                  <LogOut
                    size={14}
                    strokeWidth={2.5}
                    className="group-hover/item:scale-110 transition-transform flex-shrink-0"
                  />
                  Sign Out
                </button>
                <div className="h-px bg-white/5 my-1" />
                <button
                  onClick={() => setResetTarget(true)}
                  className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-red-500/10 text-sm transition-all text-red-400 group/item"
                >
                  <RotateCcw
                    size={14}
                    className="group-hover/item:rotate-[-45deg] transition-transform"
                  />{" "}
                  Reset Defaults
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative z-10 w-full max-w-4xl px-4">
          <AnimatePresence mode="wait">
            {isEditingTitle ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-2 pl-6 rounded-full flex items-center gap-4 shadow-2xl mx-auto max-w-2xl"
              >
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  autoFocus
                  className="bg-transparent border-none outline-none text-2xl font-bold text-white w-full placeholder-slate-400"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    disabled={saving}
                    className={cn(
                      "w-10 h-10 rounded-full bg-deckly-primary flex items-center justify-center text-slate-950 transition-all shadow-lg shadow-deckly-primary/20 flex-shrink-0",
                      saving
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-opacity-90",
                    )}
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    ) : (
                      <Check
                        size={20}
                        strokeWidth={3}
                        className="flex-shrink-0"
                      />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => !saving && setIsEditingTitle(false)}
                    disabled={saving}
                    className={cn(
                      "w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white transition-all shadow-lg shadow-red-500/20 flex-shrink-0",
                      saving
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-red-600",
                    )}
                  >
                    <X size={20} strokeWidth={3} className="flex-shrink-0" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="display"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter drop-shadow-2xl">
                  {branding.room_name}
                </h1>
                {profile && (
                  <div className="flex items-center gap-2 mt-2 px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                      Welcome, {profile.full_name || "User"}
                    </span>
                    <div className="w-px h-3 bg-white/10 mx-1" />
                    {isPro ? (
                      <span className="text-[10px] font-bold text-deckly-primary bg-deckly-primary/10 px-2 py-0.5 rounded-md border border-deckly-primary/20 tracking-tighter uppercase">
                        PRO
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 tracking-tighter uppercase">
                        FREE
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept="image/*"
        onChange={handleBannerUpload}
      />

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-6 pt-12 pb-24 relative z-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <div className="w-10 h-10 border-2 border-deckly-primary/20 border-t-deckly-primary rounded-full animate-spin" />
            <p>Gathering your decks...</p>
          </div>
        ) : !decks || decks.length === 0 ? (
          <div className="bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center gap-4 shadow-xl max-w-lg mx-auto">
            <div className="w-16 h-16 bg-deckly-secondary/20 rounded-full flex items-center justify-center text-deckly-secondary mb-2">
              <Plus size={32} />
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Your data room is empty
            </h2>
            <p className="text-slate-400 max-w-sm">
              Start by uploading your first pitch deck. We'll handle the
              processing and analytics for you.
            </p>
            <Link to="/upload">
              <Button size="lg" className="group flex items-center gap-2">
                Upload First Deck
                <Plus
                  size={20}
                  strokeWidth={3}
                  className="group-hover:rotate-90 transition-transform"
                />
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.1 },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {decks.map((deck) => (
              <motion.div
                key={deck.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Link
                  to={getDeckPreviewPath(deck.id)}
                  onClick={(e) => {
                    if (!profile?.handle) {
                      e.preventDefault();
                      alert(
                        "Please set a handle in your profile to view decks.",
                      );
                    }
                  }}
                  className="group relative flex flex-col bg-slate-900 border border-white/5 rounded-2xl overflow-hidden hover:border-deckly-primary/30 transition-all duration-300 shadow-xl hover:shadow-2xl"
                >
                  {/* Thumbnail area */}
                  <div className="h-44 relative overflow-hidden bg-slate-900 shadow-inner w-full flex-shrink-0">
                    {(() => {
                      let firstPage =
                        deck.pages &&
                        Array.isArray(deck.pages) &&
                        deck.pages.length > 0
                          ? deck.pages[0]
                          : null;

                      // Handle stringified JSON (common in Supabase responses sometimes)
                      // DeckPage may arrive as a plain string or an object with image_url/url keys
                      type DeckPage =
                        | { image_url?: string; url?: string }
                        | string;
                      const pageCandidate = firstPage as DeckPage;
                      if (
                        typeof pageCandidate === "string" &&
                        (pageCandidate.startsWith("{") ||
                          pageCandidate.startsWith("["))
                      ) {
                        try {
                          firstPage = JSON.parse(pageCandidate);
                        } catch {
                          console.error(
                            "Failed to parse page JSON:",
                            firstPage,
                          );
                        }
                      }

                      // Extremely defensive resolution: handle signed thumb, handle string, handle object with multiple keys, handle fallback
                      let imgSrc = thumbnails[deck.id] || "";

                      if (!imgSrc) {
                        if (!firstPage) {
                          imgSrc =
                            signedBanner ||
                            branding.banner_url ||
                            defaultBanner;
                        } else if (typeof firstPage === "string") {
                          imgSrc = firstPage;
                        } else {
                          imgSrc =
                            (typeof firstPage === "object" && firstPage !== null
                              ? (
                                  firstPage as {
                                    image_url?: string;
                                    url?: string;
                                  }
                                ).image_url ||
                                (
                                  firstPage as {
                                    image_url?: string;
                                    url?: string;
                                  }
                                ).url
                              : undefined) ||
                            signedBanner ||
                            branding.banner_url ||
                            defaultBanner;
                        }
                      }

                      // One more safety check for placeholder
                      if (!imgSrc || imgSrc === "") {
                        imgSrc = branding.banner_url || defaultBanner;
                      }

                      const safeImgSrc = sanitizeImageUrl(imgSrc, defaultBanner);

                      return (
                        <img
                          src={safeImgSrc}
                          alt={deck.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(
                            e: React.SyntheticEvent<HTMLImageElement>,
                          ) => {
                            const target = e.currentTarget;
                            if (!target.dataset.triedFallback) {
                              target.dataset.triedFallback = "true";
                              const fallbackUrl = branding.banner_url || defaultBanner;
                              target.src = sanitizeImageUrl(fallbackUrl, defaultBanner);
                            }
                          }}
                        />
                      );
                    })()}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent pointer-events-none"></div>
                  </div>

                  {/* Content area */}
                  <div className="flex-1 p-6 flex flex-col min-w-0">
                    <div className="flex justify-between items-center mb-4 gap-4">
                      <h2 className="text-xl font-bold text-white leading-tight line-clamp-2 truncate flex-1 min-w-0">
                        {deck.title}
                      </h2>
                      <div className="flex flex-shrink-0 gap-2 items-center ml-auto">
                        <ActionButton
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDeckForLinks(deck);
                          }}
                          title="Manage Links"
                        >
                          <Share2
                            size={18}
                            strokeWidth={3}
                            className="text-white flex-shrink-0"
                          />
                        </ActionButton>
                        <ActionButton
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(
                              `${getDeckPreviewPath(deck.id)}?ai=summary`,
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }}
                          title="Summarize with AI"
                          color="secondary"
                        >
                          <Sparkles
                            size={18}
                            strokeWidth={3}
                            className="text-white flex-shrink-0"
                          />
                        </ActionButton>
                        <ActionButton
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedAnalyticsDeck(deck);
                          }}
                          title="Analytics"
                          color="secondary"
                        >
                          <BarChart3
                            size={18}
                            strokeWidth={3}
                            className="text-white flex-shrink-0"
                          />
                        </ActionButton>
                        <ActionButton
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDeck(deck);
                          }}
                          title="Edit"
                        >
                          <Pencil
                            size={18}
                            strokeWidth={3}
                            className="text-white flex-shrink-0"
                          />
                        </ActionButton>
                        <ActionButton
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(deck);
                          }}
                          title="Delete"
                          color="red"
                        >
                          <Trash2
                            size={18}
                            strokeWidth={3}
                            className="text-white flex-shrink-0"
                          />
                        </ActionButton>
                      </div>
                    </div>

                    <p className="text-sm text-slate-400 line-clamp-3 mb-6 flex-1">
                      {deck.description ||
                        "No description provided for this data room asset."}
                    </p>

                    <div className="flex items-center gap-2 text-deckly-primary text-sm font-bold group-hover:gap-3 transition-all pt-4 border-t border-white/5">
                      Open Data Room <span>→</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Floating Action Button */}
      {!loading && decks && decks.length > 0 && (
        <Link
          to="/upload"
          className="fixed bottom-10 right-10 w-16 h-16 bg-deckly-primary rounded-full flex items-center justify-center text-white shadow-2xl shadow-deckly-primary/40 hover:scale-110 active:scale-95 transition-all z-[100] group"
        >
          <Plus
            size={32}
            className="group-hover:rotate-90 transition-transform duration-300"
          />
        </Link>
      )}

      {/* Modals & Panels */}
      <AnimatePresence>
        {selectedDeck && (
          <DeckDetailPanel
            deck={selectedDeck}
            isPro={!!isPro}
            onClose={() => setSelectedDeck(null)}
            onDelete={onDelete}
            onShowAnalytics={(deck) => {
              setSelectedAnalyticsDeck(deck);
            }}
            onUpdate={(updatedDeck) => {
              onUpdate(updatedDeck);
              setSelectedDeck(updatedDeck);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAnalyticsDeck && (
          <AnalyticsModal
            key="analytics-modal"
            deck={selectedAnalyticsDeck}
            onClose={() => setSelectedAnalyticsDeck(null)}
          />
        )}
      </AnimatePresence>

      <DeckLinkManagerModal
        deck={selectedDeckForLinks}
        workspaceSlug={profile?.handle}
        isOpen={!!selectedDeckForLinks}
        onClose={() => setSelectedDeckForLinks(null)}
      />

      <AlertDialog open={resetTarget} onOpenChange={setResetTarget}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Branding</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset your room name and banner to
              defaults? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmReset();
              }}
              disabled={isResetting}
            >
              {isResetting ? "Resetting..." : "Reset Branding"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-[200] flex items-center gap-3 border border-red-400/20"
          >
            <span className="text-xs font-bold uppercase tracking-widest">
              {error}
            </span>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Internal Helper Component for Action Buttons
interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
  color?: "default" | "secondary" | "red";
  active?: boolean;
  className?: string;
}

function ActionButton({
  children,
  onClick,
  title,
  color = "default",
  active = false,
  className = "",
}: ActionButtonProps) {
  const colors: Record<string, string> = {
    default: "hover:bg-deckly-primary hover:text-white",
    secondary: "hover:bg-deckly-secondary hover:text-white",
    red: "hover:bg-red-500 hover:text-white",
  };

  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "relative w-10 h-10 rounded-xl flex items-center justify-center bg-white/10 border border-white/10 text-white transition-all flex-shrink-0",
        colors[color],
        active
          ? "bg-deckly-primary text-slate-950 border-deckly-primary scale-110"
          : "hover:-translate-y-1",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default DeckList;
