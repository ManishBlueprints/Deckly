import React, { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { deckService } from "../../services/deckService";
import { supabase } from "../../services/supabase";
import { Deck } from "../../types";
import { normalizeSlug } from "../../utils/slug";
import { useAuth } from "../../contexts/AuthContext";
import { processPdfToImages as processDeckPdfToImages } from "../../workflows/deckProcessing";

// Sub-components
import { ManagementSection } from "./form-sections/ManagementSection";
import { AccessProtectionSection } from "./form-sections/AccessProtectionSection";
import { DangerZoneSection } from "./form-sections/DangerZoneSection";
import { Button } from "../ui/button";
import { Save } from "lucide-react";

interface DeckSettingsFormProps {
  deck: Deck;
  onUpdate: (updatedDeck: Deck) => void;
  onDelete: (deckId: string) => void;
}

export function DeckSettingsForm({
  deck,
  onUpdate,
  onDelete,
}: DeckSettingsFormProps) {
  // State
  const [title, setTitle] = useState(deck.title);
  const [slug, setSlug] = useState(deck.slug);
  const [requireEmail, setRequireEmail] = useState(deck.require_email || false);
  const [requirePassword, setRequirePassword] = useState(
    deck.require_password || false,
  );
  const [viewPassword, setViewPassword] = useState(deck.view_password || "");
  const [expiryEnabled, setExpiryEnabled] = useState(!!deck.expires_at);
  const [expiryDate, setExpiryDate] = useState(
    deck.expires_at ? deck.expires_at.split("T")[0] : "",
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Cleanup timeout on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // PDF Processing Logic
  const processUploadedPdf = async (pdfFile: File) => {
    setIsProcessing(true);
    setError(null);
    setCompletionPercentage(0);
    setUploadProgress("Initializing PDF...");

    try {
      return await processDeckPdfToImages(pdfFile, {
        scale: 1.5,
        quality: 0.8,
        onProgress: (current: number, total: number) => {
          setUploadProgress(`Optimizing ${current}/${total}...`);
          // Guard against divide-by-zero and clamp current to valid range
          const clampedCurrent = Math.max(0, Math.min(current, total));
          const percentage = total > 0 ? Math.round((clampedCurrent / total) * 100) : 0;
          setCompletionPercentage(percentage);
        },
      });
    } catch (err) {
      console.error("PDF Processing error:", err);
      const msg = err instanceof Error ? err.message : "Failed to process PDF";
      setError(msg);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    // Track the uploaded file path so it can be cleaned up if any later step fails
    let uploadedFileName: string | null = null;

    setError(null); // Clear previous errors
    setIsSaving(true);
    setUploadProgress("Syncing changes...");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Authentication required");
      const userId = session.user.id;

        let finalFileUrl = deck.file_url;
        let finalPages = deck.pages;
        let fileSize = deck.file_size;
        const finalViewPassword = requirePassword
          ? viewPassword.trim() || null
          : null;

      if (newFile) {
        setUploadProgress("Uploading source...");
        const fileExt = newFile.name.split(".").pop();
        uploadedFileName = `${userId}/decks/${slug}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("decks")
          .upload(uploadedFileName, newFile);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("decks").getPublicUrl(uploadedFileName);
        finalFileUrl = publicUrl;
        fileSize = newFile.size;

        const imageAssets = await processUploadedPdf(newFile);
        if (!imageAssets) {
          // Clean up the orphaned uploaded source file before aborting
          await supabase.storage.from("decks").remove([uploadedFileName]).catch((err) =>
            console.error("Failed to remove orphaned upload after PDF processing failure:", err)
          );
          setUploadProgress("");
          setIsSaving(false);
          return;
        }
        setUploadProgress(`Updating ${imageAssets.length} slides...`);
        const imageUrls = await deckService.uploadSlideImages(
          userId,
          slug,
          imageAssets.map((asset) => asset.blob),
        );
        finalPages = imageUrls.map((url, idx) => ({
          image_url: url,
          page_number: idx + 1,
          links: imageAssets[idx]?.links || [],
        }));
      }

        const updates: Partial<Deck> = {
          title,
          slug,
          file_url: finalFileUrl,
          pages: finalPages,
          file_size: fileSize,
          require_email: requireEmail,
          require_password: requirePassword,
          view_password: finalViewPassword ?? undefined,
          expires_at:
            expiryEnabled && expiryDate
              ? new Date(expiryDate).toISOString()
              : null,
        };

      const updated = await deckService.updateDeck(deck.id, updates, userId);
      onUpdate(updated);
      setUploadProgress("Changes Synced!");
      timeoutRef.current = setTimeout(() => {
        setUploadProgress("");
        navigate("/content");
      }, 800);
      setNewFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Sync error:", err);
      // Clean up the uploaded source file if a post-upload step failed
      if (uploadedFileName) {
        await supabase.storage.from("decks").remove([uploadedFileName]).catch((removeErr) =>
          console.error("Failed to remove orphaned upload during error recovery:", removeErr)
        );
      }
      alert(message || "Failed to update asset settings");
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

  return (
    <div className="max-w-4xl mx-auto w-full space-y-12">
      <ManagementSection
        title={title}
        setTitle={setTitle}
        slug={slug}
        setSlug={(v) => setSlug(normalizeSlug(v))}
        originalSlug={deck.slug}
        userHandle={profile?.handle || "username"}
        onFileClick={() => fileInputRef.current?.click()}
        newFile={newFile}
      />

      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept=".pdf"
        onChange={handleFileChange}
      />

      <AccessProtectionSection
        requireEmail={requireEmail}
        setRequireEmail={setRequireEmail}
        expiryEnabled={expiryEnabled}
        setExpiryEnabled={setExpiryEnabled}
        expiryDate={expiryDate}
        setExpiryDate={setExpiryDate}
        requirePassword={requirePassword}
        setRequirePassword={setRequirePassword}
        viewPassword={viewPassword}
        setViewPassword={setViewPassword}
      />

      <div className="flex justify-end pt-6 mt-6 border-t border-white/5">
        {isProcessing && (
          <div className="flex-1 mr-6 space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-slate-500">Processing Assets</span>
              <span className="text-deckly-primary">
                {completionPercentage}%
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-deckly-primary transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        )}
        {error && !isProcessing && (
          <div className="flex-1 mr-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </div>
        )}
        <Button
          type="button"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
          }}
          disabled={isSaving}
          className="w-full sm:w-auto h-11 px-8 rounded-md font-semibold text-sm bg-deckly-primary text-slate-950 hover:bg-deckly-primary/90 transition-all disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin mr-2" />
          ) : (
            <Save size={16} className="mr-2" />
          )}
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <DangerZoneSection onDelete={() => onDelete(deck.id)} />

      {/* Progress Notification */}
      <AnimatePresence>
        {uploadProgress && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-surface-card border border-white/10 px-6 py-3 rounded-md flex items-center gap-3 shadow-2xl"
          >
            <div className="w-4 h-4 border-2 border-deckly-primary/30 border-t-deckly-primary rounded-full animate-spin" />
            <span className="text-sm font-medium text-white">
              {uploadProgress}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
