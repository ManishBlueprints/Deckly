import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  HardDrive,
  Upload,
  Eye,
  Clock,
  Trash2,
  Save,
  ExternalLink,
  Lock,
  EyeOff,
  BarChart3,
} from "lucide-react";
import { deckService } from "../../services/deckService";
import { deckStorageService } from "../../services/deckStorageService";
import { analyticsService } from "../../services/analyticsService";
import { useAuth } from "../../contexts/AuthContext";
import { Deck } from "../../types";
import { processPdfToImages } from "../../workflows/deckProcessing";
import { cn } from "../../lib/utils";
import { getDeckPreviewPath } from "../../utils/url";
import { DeckLinkManagerModal } from "../dashboard/DeckLinkManagerModal";

// UI Components
import { Button } from "../ui/button";
import { FormInput } from "../ui/form-input";
import { Switch } from "../ui/switch";
import { Card } from "../ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

interface DeckDetailPanelProps {
  deck: Deck;
  isPro: boolean;
  onClose: () => void;
  onDelete: (deck: Deck) => void;
  onShowAnalytics: (deck: Deck) => void;
  onUpdate: (deck: Deck) => void;
}

const SectionHeader = ({
  children,
  icon: Icon,
  color = "primary",
}: {
  children: React.ReactNode;
  icon?: React.ElementType;
  color?: "primary" | "secondary";
}) => (
  <div className="flex flex-col gap-1.5 px-1 mb-6">
    <h3
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2",
        color === "primary" ? "text-deckly-primary" : "text-slate-500",
      )}
    >
      {Icon && <Icon size={12} strokeWidth={3} />}
      {children}
    </h3>
  </div>
);

function DeckDetailPanel({
  deck,
  isPro,
  onClose,
  onDelete,
  onShowAnalytics,
  onUpdate,
}: DeckDetailPanelProps) {
  const { session, profile } = useAuth();
  const userId = session?.user?.id;
  const [editValues, setEditValues] = useState({
    title: "",
    slug: "",
  });
  const [expiryEnabled, setExpiryEnabled] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [viewPassword, setViewPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ views: 0, avgTime: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isLinkManagerOpen, setIsLinkManagerOpen] = useState(false);

  useEffect(() => {
    if (deck) {
      setEditValues({
        title: deck.title,
        slug: deck.slug,
      });
      setExpiryEnabled(!!deck.expires_at);
      setExpiryDate(deck.expires_at ? deck.expires_at.split("T")[0] : "");
      setRequireEmail(deck.require_email || false);
      setRequirePassword(deck.require_password || false);
      setViewPassword(deck.view_password || "");
      loadStats(deck.id);
      setNewFile(null);
    }
    // loadStats is intentionally not in the dependency array to avoid infinite loop from function identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, isPro, userId]);

  const loadStats = async (deckId: string) => {
    try {
      // Pass isPro and userId to getDeckStats to match the new signature
      const pageStats = await analyticsService.getDeckStats(
        deckId,
        isPro,
        userId,
      );
      if (pageStats && pageStats.length > 0) {
        const totalViews = pageStats.reduce((sum, s) => sum + s.total_views, 0);
        const totalTime = pageStats.reduce(
          (sum, s) => sum + s.total_time_seconds,
          0,
        );
        const avgTime = totalViews > 0 ? totalTime / totalViews : 0;
        setSummaryStats({ views: totalViews, avgTime });
      }
    } catch (err) {
      console.error("Error loading summary stats:", err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setUploadProgress("Saving changes...");
    try {
      let finalFileUrl = deck.file_url;
      let finalPages = deck.pages;
      let fileSize = deck.file_size;
      const finalViewPassword = requirePassword
        ? viewPassword.trim() || null
        : null;

      if (!userId) throw new Error("Not authenticated");

      if (newFile) {
        setUploadProgress("Uploading new PDF...");
        const upload = await deckStorageService.uploadDeckFile(newFile, editValues.slug, userId);
        finalFileUrl = upload.publicUrl;
        fileSize = newFile.size;

        const imageAssets = await processPdfToImages(newFile, {
          scale: 1.5,
          quality: 0.8,
          onProgress: (current, total) =>
            setUploadProgress(`Processing slide ${current} of ${total}...`),
        });
        setUploadProgress(`Uploading ${imageAssets.length} new slides...`);
        const imageUrls = await deckService.uploadSlideImages(
          userId,
          editValues.slug,
          imageAssets.map((asset) => asset.blob),
        );
        finalPages = imageUrls.map((url, idx) => ({
          image_url: url,
          page_number: idx + 1,
          width: imageAssets[idx]?.width,
          height: imageAssets[idx]?.height,
          links: imageAssets[idx]?.links || [],
        }));
      }

      const updates: Partial<Deck> = {
        title: editValues.title,
        slug: editValues.slug,
        file_url: finalFileUrl,
        pages: finalPages,
        file_size: fileSize,
        ...(newFile ? { extracted_text: null } : {}),
        require_email: requireEmail,
        require_password: requirePassword,
        view_password: finalViewPassword ?? undefined,
      };

      if (expiryEnabled && expiryDate) {
        const [year, month, day] = expiryDate.split("-").map(Number);
        updates.expires_at = new Date(
          Date.UTC(year, month - 1, day),
        ).toISOString();
      } else {
        updates.expires_at = null;
      }

      const updated = await deckService.updateDeck(deck.id, updates, userId);
      let watermarkGenerationFailed = false;
      if (newFile && deck.watermark_enabled) {
        setUploadProgress("Preparing watermarked download...");
        try {
          await deckService.generateWatermarkedDeck(deck.id);
        } catch (watermarkError) {
          console.error("Watermark generation failed after replacing the deck source:", watermarkError);
          watermarkGenerationFailed = true;
        }
      }
      onUpdate({
        ...updated,
        ...(watermarkGenerationFailed ? { watermark_status: "failed" } : {}),
      });
      setUploadProgress(
        watermarkGenerationFailed
          ? "Saved, but the watermark could not be prepared. Retry from deck settings."
          : "Saved!",
      );
      setTimeout(() => {
        onClose();
        setUploadProgress("");
      }, watermarkGenerationFailed ? 2500 : 1000);
    } catch (err: unknown) {
      alert(
        "Failed to update deck: " +
          (err instanceof Error ? err.message : String(err)),
      );
      setUploadProgress("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setNewFile(file);
    } else if (file) {
      alert("Please select a valid PDF file.");
    }
  };

  if (!deck) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024 || 0).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full max-w-xl bg-slate-900 h-full shadow-2xl overflow-y-auto border-l border-white/5 flex flex-col"
      >
        <header className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur-xl p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X size={24} />
            </button>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Asset Intelligence
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={getDeckPreviewPath(deck.id)}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="ghost" size="sm" icon={ExternalLink}>
                Preview
              </Button>
            </a>
            <Button
              variant="ghost"
              size="sm"
              icon={Eye}
              onClick={() => setIsLinkManagerOpen(true)}
            >
              Manage Links
            </Button>
          </div>
        </header>

        <div className="p-8 space-y-14 pb-48 relative z-10 flex-grow">
          {/* Main Preview */}
          <section className="space-y-6">
            <div className="aspect-video w-full rounded-[32px] overflow-hidden bg-slate-800 border-4 border-white/5 shadow-2xl relative">
              {(() => {
                let firstPage =
                  deck.pages &&
                  Array.isArray(deck.pages) &&
                  deck.pages.length > 0
                    ? deck.pages[0]
                    : null;

                const pageCandidate = firstPage as unknown as
                  | Record<string, unknown>
                  | string;
                if (
                  typeof pageCandidate === "string" &&
                  (pageCandidate.startsWith("{") ||
                    pageCandidate.startsWith("["))
                ) {
                  try {
                    firstPage = JSON.parse(pageCandidate);
                  } catch (e) {
                    console.error("Detail Error:", e);
                  }
                }

                let imgSrc = "";
                if (firstPage) {
                  imgSrc =
                    typeof firstPage === "string"
                      ? firstPage
                      : (firstPage as unknown as Record<string, string>)
                          .image_url ||
                        (firstPage as unknown as Record<string, string>).url ||
                        "";
                }

                if (!imgSrc) return null;

                return (
                  <img
                    src={imgSrc}
                    alt={deck.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                );
              })()}
              <div
                className={cn(
                  "w-full h-full flex items-center justify-center font-bold text-slate-700 uppercase tracking-widest text-xs",
                  deck.pages && deck.pages.length > 0 ? "hidden" : "",
                )}
              >
                No Preview Available
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                {deck.title}
              </h1>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-deckly-primary" />{" "}
                  {formatDate(deck.created_at)}
                </div>
                <div className="flex items-center gap-1.5">
                  <HardDrive size={14} className="text-deckly-primary" />{" "}
                  {formatSize(deck.file_size)}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Edit Actions */}
          <section className="space-y-8">
            <SectionHeader>Management</SectionHeader>
            <div className="flex flex-col gap-6">
              <FormInput
                label="Asset Name"
                placeholder="Rename"
                value={editValues.title}
                onChange={(e) =>
                  setEditValues({ ...editValues, title: e.target.value })
                }
              />

              <FormInput
                label="Access Path"
                placeholder="Slug"
                value={editValues.slug}
                error={
                  editValues.slug !== deck.slug
                    ? "Breaking change: old links will no longer work."
                    : undefined
                }
                onChange={(e) =>
                  setEditValues({ ...editValues, slug: e.target.value })
                }
              />

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-400 px-1">
                  Source Control
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 cursor-pointer hover:bg-white/[0.05] transition-all",
                    newFile
                      ? "border-deckly-primary/50 bg-deckly-primary/5"
                      : "",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Upload
                      size={18}
                      className={
                        newFile ? "text-deckly-primary" : "text-slate-500"
                      }
                    />
                    <span className="text-sm font-bold text-slate-200">
                      {newFile
                        ? "Replaced: " + newFile.name
                        : "Replace PDF Source"}
                    </span>
                  </div>
                  {!newFile && (
                    <span className="text-[10px] font-bold uppercase text-slate-600">
                      Upload
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex flex-col gap-4 p-5 rounded-3xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm font-medium text-slate-300">Enable Link Expiration</span>
                  <Switch
                    checked={expiryEnabled}
                    onCheckedChange={setExpiryEnabled}
                  />
                </div>
                <AnimatePresence>
                  {expiryEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <FormInput
                        type="date"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="mt-2"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Advanced Protection */}
              <div className="flex flex-col gap-1 p-6 rounded-[32px] bg-white/[0.03] border border-white/5 shadow-inner">
                <div className="flex items-center gap-2 mb-4 px-1">
                  <Lock size={14} className="text-deckly-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Access Protection
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-medium text-slate-300">Require Email to View</span>
                    <Switch
                      checked={requireEmail}
                      onCheckedChange={setRequireEmail}
                    />
                  </div>
                  <div className="h-px bg-white/5 mx-1" />
                  <div className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-medium text-slate-300">Password Protected</span>
                    <Switch
                      checked={requirePassword}
                      onCheckedChange={setRequirePassword}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {requirePassword && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="relative">
                        <FormInput
                          label="Viewing Password"
                          type={showPasswordField ? "text" : "password"}
                          value={viewPassword}
                          onChange={(e) => setViewPassword(e.target.value)}
                          placeholder="••••••••"
                          required={requirePassword}
                          icon={Lock}
                          rightElement={
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswordField(!showPasswordField)
                              }
                              className="text-slate-500 hover:text-white transition-colors p-1"
                            >
                              {showPasswordField ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* Quick Stats Overlay */}
          <section className="space-y-8">
            <SectionHeader icon={BarChart3}>Engagement Summary</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <Card
                variant="solid"
                className="p-4 bg-white/[0.02] border-white/5 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-deckly-primary/10 text-deckly-primary rounded-xl flex items-center justify-center shrink-0">
                  <Eye size={20} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-2xl font-bold text-white leading-none">
                    {summaryStats.views}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                    Interactions
                  </span>
                </div>
              </Card>

              <Card
                variant="solid"
                className="p-4 bg-white/[0.02] border-white/5 flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-deckly-secondary/10 text-deckly-secondary rounded-xl flex items-center justify-center shrink-0">
                  <Clock size={20} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-2xl font-bold text-white leading-none">
                    {Math.round(summaryStats.avgTime)}s
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                    Retention
                  </span>
                </div>
              </Card>
            </div>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                onShowAnalytics(deck);
                onClose();
              }}
              className="bg-deckly-secondary/5 text-deckly-secondary border border-deckly-secondary/20 hover:bg-deckly-secondary hover:text-slate-950 rounded-2xl py-4 font-bold uppercase tracking-widest shadow-xl shadow-deckly-secondary/5 transition-all mt-4"
            >
              Full Analytics Report
            </Button>
          </section>
        </div>

        {/* Global Actions */}
        <div className="sticky bottom-0 left-0 right-0 p-8 bg-slate-900/60 backdrop-blur-3xl border-t border-white/10 flex gap-4 z-50 mt-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={isSaving}
                icon={Trash2}
                aria-label="Delete deck"
                title="Delete deck"
                className="px-6 rounded-none shadow-xl shadow-red-500/10"
              />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{deck.title}"? This action cannot be undone and will remove all associated analytics data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => onDelete(deck)}
                >
                  Confirm Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="default"
            fullWidth
            onClick={handleSave}
            loading={isSaving}
            icon={Save}
            className="rounded-none py-4 font-bold uppercase tracking-widest shadow-2xl shadow-deckly-primary/20"
          >
            {isSaving ? uploadProgress || "Saving" : "Sync Changes"}
          </Button>
        </div>
      </motion.div>
      <DeckLinkManagerModal
        deck={deck}
        workspaceSlug={profile?.handle}
        isOpen={isLinkManagerOpen}
        onClose={() => setIsLinkManagerOpen(false)}
      />
    </div>
  );
}

export default DeckDetailPanel;
