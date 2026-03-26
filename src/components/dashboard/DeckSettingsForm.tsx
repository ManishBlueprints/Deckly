import React, { useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import { useNavigate } from "react-router-dom";
import { deckService } from "../../services/deckService";
import { supabase } from "../../services/supabase";
import { Deck } from "../../types";
import { normalizeSlug } from "../../utils/slug";
import { useAuth } from "../../contexts/AuthContext";
import { extractPdfLinkHotspots } from "../../utils/pdfLinks";

// Sub-components
import { ManagementSection } from "./form-sections/ManagementSection";
import { AccessProtectionSection } from "./form-sections/AccessProtectionSection";
import { DangerZoneSection } from "./form-sections/DangerZoneSection";
import { Button } from "../ui/button";
import { Save } from "lucide-react";

// Set worker source for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

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

  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // PDF Processing Logic
  const processPdfToImages = async (pdfFile: File) => {
    setUploadProgress("Processing content...");
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const imageAssets: Array<{ blob: Blob; links: Deck["pages"][number]["links"] }> = [];

    for (let i = 1; i <= numPages; i++) {
      setUploadProgress(`Optimizing ${i}/${numPages}...`);
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const links = await extractPdfLinkHotspots(page).catch(() => []);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.8),
      );
      if (blob) imageAssets.push({ blob, links });
    }
    return imageAssets;
  };

  // Main Save Handler
    const handleSave = async () => {
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
        const fileName = `${userId}/decks/${slug}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("decks")
          .upload(fileName, newFile);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("decks").getPublicUrl(fileName);
        finalFileUrl = publicUrl;
        fileSize = newFile.size;

        const imageAssets = await processPdfToImages(newFile);
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
      setTimeout(() => {
        setUploadProgress("");
        navigate("/content");
      }, 800);
      setNewFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Sync error:", err);
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

      <div className="flex justify-end pt-6 mt-6 border-t border-[#222]">
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
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-[#333] px-6 py-3 rounded-md flex items-center gap-3 shadow-2xl"
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
