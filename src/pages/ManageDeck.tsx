import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { deckService } from "../services/deckService";
import { supabase } from "../services/supabase";
import { dataRoomService } from "../services/dataRoomService";
import {
  Upload,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sparkles,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { useCheckDeckSlug } from "../hooks/useSlugValidation";
import * as pdfjsLib from "pdfjs-dist";
import { Deck, SlidePage, UserProfile } from "../types";
import { cn } from "@/lib/utils";
import { userService } from "../services/userService";
import { TierUpsellModal } from "../components/TierUpsellModal";
import { TIER_CONFIG } from "../constants/tiers";
import { normalizeSlug } from "../utils/slug";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { extractPdfLinkHotspots } from "../utils/pdfLinks";

// Layout
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DashboardCard } from "../components/ui/DashboardCard";

// shadcn/ui
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
// import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";

// Set worker source for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function ManageDeck() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const returnToRoom = searchParams.get("returnToRoom");
  const [existingDeck, setExistingDeck] = useState<Deck | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePassword, setRequirePassword] = useState(false);
  const [viewPassword, setViewPassword] = useState("");
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conversionMode, setConversionMode] = useState<"raw" | "interactive">(
    "raw",
  );
  const [fileType, setFileType] = useState<string>("pdf");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [upsellFeature, setUpsellFeature] = useState("");
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile: authProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: isSlugAvailable, isLoading: isCheckingSlug } = useCheckDeckSlug(
    slug,
    editId || undefined,
  );

  useEffect(() => {
    fetchProfile();
    if (editId) {
      loadExistingDeck(editId);
    }
  }, [editId]);

  const fetchProfile = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await userService.getProfile(session.user.id);
      setUserProfile(profile);
    }
  };

  const loadExistingDeck = async (id: string) => {
    try {
      setLoading(true);
      setProgress("Loading deck data...");
      const deck = await deckService.getDeckById(id);
      if (deck) {
        setExistingDeck(deck);
        setTitle(deck.title);
        setSlug(deck.slug);
        setDescription(deck.description || "");
        setRequireEmail(deck.require_email || false);
        setRequirePassword(deck.require_password || false);
        setViewPassword(deck.view_password || "");
        setExpiresAt(deck.expires_at ? deck.expires_at.split("T")[0] : "");
        setEnableExpiry(!!deck.expires_at);
      }
    } catch (err: unknown) {
      console.error("Error loading deck:", err);
      setError("Failed to load deck for editing.");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase();
      const validExts = ["pdf", "pptx", "docx", "doc", "xlsx"];

      if (ext && validExts.includes(ext)) {
        // Check tier for non-PDF via centralized config
        const currentTier = userProfile?.tier || "FREE";
        const config = TIER_CONFIG[currentTier];

        if (ext !== "pdf" && !config.allowOffice) {
          setUpsellFeature(`${ext.toUpperCase()} Support`);
          setShowUpsell(true);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        setFile(selectedFile);
        setFileType(ext);

        // Default to raw for non-slideshow formats unless it's pptx
        if (ext === "xlsx") {
          setConversionMode("raw");
        } else if (ext === "pptx") {
          if (!config.allowInteractive) {
            setConversionMode("raw");
          } else {
            setConversionMode("interactive");
          }
        }

        if (!slug && !editId) {
          const generatedSlug = normalizeSlug(
            `${selectedFile.name.split(".")[0]}-${Math.random().toString(36).substring(2, 6)}`,
          );
          setSlug(generatedSlug);
        }
        if (!title && !editId) {
          setTitle(selectedFile.name.split(".")[0]);
        }
      } else {
        alert("Please select a supported file (PDF, PPTX, DOCX, or XLSX).");
      }
    }
  };

  const processPdfToImages = async (pdfFile: File) => {
    setProgress("Loading PDF for processing...");
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const imageAssets: Array<{ blob: Blob; links: SlidePage["links"] }> = [];

    for (let i = 1; i <= numPages; i++) {
      setProgress(`Processing page ${i} of ${numPages}...`);
      setProgressPercent(Math.round((i / numPages) * 50));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const links = await extractPdfLinkHotspots(page).catch(() => []);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page as any).render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 1),
      );
      if (blob) imageAssets.push({ blob, links });
    }

    return imageAssets;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!file && !editId) || !title || !slug) return;

    if (!isSlugAvailable && !editId) {
      setError("This URL Slug is already taken. Please enter a different one.");
      return;
    }

    setLoading(true);
    setError(null);
    setProgressPercent(0);

    try {
      let finalFileUrl = existingDeck?.file_url;
      let finalPages: SlidePage[] = existingDeck?.pages || [];
      let finalStatus = "PROCESSED"; // Default to processed if it's raw non-pdf
      const finalViewPassword = requirePassword
        ? viewPassword.trim() || null
        : null;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      if (file) {
        setProgress("Uploading document...");
        setProgressPercent(5);
        const fileExt = file.name.split(".").pop();
        const fileName = `${userId}/decks/${slug}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("decks")
          .upload(fileName, file);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("decks").getPublicUrl(fileName);
        finalFileUrl = publicUrl;

        // Cleanup old images if updating
        if (editId && existingDeck) {
          setProgress("Cleaning up old content...");
          const { data: files } = await supabase.storage
            .from("decks")
            .list(`${userId}/deck-images/${slug}`);
          if (files && files.length > 0) {
            const filesToDelete = files.map(
              (f) => `${userId}/deck-images/${slug}/${f.name}`,
            );
            await supabase.storage.from("decks").remove(filesToDelete);
          }
        }

        // Processing Logic
        if (fileType === "pdf") {
          // Keep existing PDF client-side processing
          const imageAssets = await processPdfToImages(file);
          setProgress(`Uploading slide 1 of ${imageAssets.length}...`);
          const imageUrls = await deckService.uploadSlideImages(
            userId,
            slug,
            imageAssets.map((asset) => asset.blob),
            (current, total) => {
              setProgress(`Uploading slide ${current} of ${total}...`);
              setProgressPercent(50 + Math.round((current / total) * 45));
            },
          );
          finalPages = imageUrls.map((url, idx) => ({
            image_url: url,
            page_number: idx + 1,
            links: imageAssets[idx]?.links || [],
          }));
          finalStatus = "PROCESSED";
        } else if (conversionMode === "interactive") {
          finalStatus = "PENDING";
          finalPages = [];
        } else {
          // Raw mode for non-PDF
          finalStatus = "PROCESSED";
          finalPages = [];
        }
      }

      if (editId) {
        setProgress("Updating record...");
        setProgressPercent(95);
        const { error: dbError } = await supabase
          .from("decks")
          .update({
            title,
            description,
            file_url: finalFileUrl,
            pages: finalPages,
            status: finalStatus as "PENDING" | "PROCESSED",
            display_mode: conversionMode,
            file_size: file ? file.size : existingDeck?.file_size,
            file_type: fileType,
            require_email: requireEmail,
            require_password: requirePassword,
            view_password: finalViewPassword ?? undefined,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
          .eq("id", editId);
        if (dbError) throw dbError;

        // Trigger conversion on update if file changed and mode is interactive
        if (file && fileType !== "pdf" && conversionMode === "interactive") {
          setProgress("Converting document to PDF...");
          setProgressPercent(60);
          const { data: invokeData, error: invokeError } =
            await supabase.functions.invoke("document-processor", {
              body: { deckId: editId },
            });

          if (invokeError) {
            throw new Error(
              invokeError.message ||
                "Processing failed. Check your conversion service.",
            );
          }

          if (invokeData?.error) {
            throw new Error(invokeData.message || "Backend processing failed.");
          }

          // Handle pdf_url response - download, process, upload, cleanup
          if (invokeData?.pdf_url) {
            setProgress("Downloading converted PDF...");
            setProgressPercent(65);

            // Download the PDF from signed URL
            const pdfResponse = await fetch(invokeData.pdf_url);
            if (!pdfResponse.ok) {
              throw new Error("Failed to download converted PDF");
            }
            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File([pdfBlob], "converted.pdf", {
              type: "application/pdf",
            });

            // Process PDF to images with link extraction
            setProgress("Processing slides...");
            const imageAssets = await processPdfToImages(pdfFile);

            // Upload slide images
            setProgress(`Uploading slide 1 of ${imageAssets.length}...`);
            const imageUrls = await deckService.uploadSlideImages(
              userId,
              slug,
              imageAssets.map((asset) => asset.blob),
              (current, total) => {
                setProgress(`Uploading slide ${current} of ${total}...`);
                setProgressPercent(70 + Math.round((current / total) * 20));
              },
            );

            // Build finalPages with links
            const processedPages = imageUrls.map((url, idx) => ({
              image_url: url,
              page_number: idx + 1,
              links: imageAssets[idx]?.links || [],
            }));

            // Update deck with processed pages
            setProgress("Finalizing slides...");
            setProgressPercent(92);
            await supabase
              .from("decks")
              .update({
                pages: processedPages,
                status: "PROCESSED",
              })
              .eq("id", editId);

            // Cleanup temp PDF
            setProgress("Cleaning up...");
            setProgressPercent(95);
            const tempPath = `${userId}/temp/${editId}.pdf`;
            await supabase.storage.from("decks").remove([tempPath]);
          }
        }
      } else {
        setProgress("Finalizing...");
        setProgressPercent(95);

        // Use insert directly for better control over file_type
        const { data: deckRecord, error: deckError } = await supabase
          .from("decks")
          .insert([
            {
              title,
              slug,
              description,
              file_url: finalFileUrl,
              pages: finalPages,
              status: finalStatus,
              display_mode: conversionMode,
              file_size: file?.size || 0,
              file_type: fileType,
              user_id: userId,
              require_email: requireEmail,
              require_password: requirePassword,
              view_password: finalViewPassword ?? undefined,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            },
          ])
          .select()
          .single();

        if (deckError) throw deckError;

        // Automatically link to Data Room if returnToRoom is set
        if (returnToRoom && deckRecord) {
          setProgress("Linking to Data Room...");
          await dataRoomService.addDocuments(returnToRoom, [deckRecord.id]);
        }

        // If it was an interactive non-PDF, trigger and WAIT for the edge function here
        if (
          fileType !== "pdf" &&
          conversionMode === "interactive" &&
          deckRecord
        ) {
          setProgress("Converting document to PDF...");
          setProgressPercent(60);
          const { data: invokeData, error: invokeError } =
            await supabase.functions.invoke("document-processor", {
              body: { deckId: deckRecord.id },
            });

          if (invokeError) {
            throw new Error(
              invokeError.message ||
                "Processing failed. Check your conversion service.",
            );
          }

          if (invokeData?.error) {
            throw new Error(invokeData.message || "Backend processing failed.");
          }

          // Handle pdf_url response - download, process, upload, cleanup
          if (invokeData?.pdf_url) {
            setProgress("Downloading converted PDF...");
            setProgressPercent(65);

            // Download the PDF from signed URL
            const pdfResponse = await fetch(invokeData.pdf_url);
            if (!pdfResponse.ok) {
              throw new Error("Failed to download converted PDF");
            }
            const pdfBlob = await pdfResponse.blob();
            const pdfFile = new File([pdfBlob], "converted.pdf", {
              type: "application/pdf",
            });

            // Process PDF to images with link extraction
            setProgress("Processing slides...");
            const imageAssets = await processPdfToImages(pdfFile);

            // Upload slide images
            setProgress(`Uploading slide 1 of ${imageAssets.length}...`);
            const imageUrls = await deckService.uploadSlideImages(
              userId,
              slug,
              imageAssets.map((asset) => asset.blob),
              (current, total) => {
                setProgress(`Uploading slide ${current} of ${total}...`);
                setProgressPercent(70 + Math.round((current / total) * 20));
              },
            );

            // Build finalPages with links
            const processedPages = imageUrls.map((url, idx) => ({
              image_url: url,
              page_number: idx + 1,
              links: imageAssets[idx]?.links || [],
            }));

            // Update deck with processed pages
            setProgress("Finalizing slides...");
            setProgressPercent(92);
            await supabase
              .from("decks")
              .update({
                pages: processedPages,
                status: "PROCESSED",
              })
              .eq("id", deckRecord.id);

            // Cleanup temp PDF
            setProgress("Cleaning up...");
            setProgressPercent(95);
            const tempPath = `${userId}/temp/${deckRecord.id}.pdf`;
            await supabase.storage.from("decks").remove([tempPath]);
          }
        }
      }

      setProgress("Successful!");
      setProgressPercent(100);

      // Invalidate queries to refresh dashboard/content
      queryClient.invalidateQueries({ queryKey: ["decks", session?.user?.id] });
      queryClient.invalidateQueries({
        queryKey: ["user-total-stats", session?.user?.id],
      });

      // Navigate back
      setTimeout(
        () => navigate(returnToRoom ? `/rooms/${returnToRoom}` : "/content"),
        1500,
      );
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const e = err as { message?: string; code?: string };
      let errorMsg = e.message || "Something went wrong. Please try again.";
      if (e.code === "23505" && e.message?.includes("slug")) {
        errorMsg =
          "This URL Slug is already taken. Please enter a different one.";
      }
      setError(errorMsg);
      setProgress("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title={editId ? "Refine Deck" : "Add New Asset"}>
      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <h2 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
            {editId ? "Refine Deck" : "Add New Asset"}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {editId
              ? "Update your pitch deck details and slides."
              : "Upload a document to your data room."}
          </p>
        </div>

        {/* Main Form Card */}
        <DashboardCard className="p-6 md:p-8 border-[#222] bg-[#0f0f0f] relative overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            {/* --- PDF Upload Zone (Section 1) --- */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Upload size={16} className="text-deckly-primary" />
                <h3 className="text-sm font-medium text-white">
                  {editId ? "Replace Document" : "Upload Document"}
                </h3>
              </div>
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                className={cn(
                  "relative group cursor-pointer border border-[#333] border-dashed rounded-lg p-8 md:p-12 text-center transition-all duration-200",
                  file
                    ? "border-deckly-primary/30 bg-[#141414]"
                    : "bg-[#111] hover:bg-[#141414] hover:border-[#444]",
                  loading ? "opacity-30 cursor-not-allowed" : "",
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  {file ? (
                    <div className="w-12 h-12 rounded-lg bg-[#0f0f0f] border border-[#222] flex items-center justify-center">
                      <CheckCircle2 size={24} className="text-deckly-primary" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-[#0f0f0f] border border-[#222] flex items-center justify-center group-hover:border-[#333] transition-colors">
                      <Upload
                        size={24}
                        className="text-slate-500 group-hover:text-deckly-primary transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-white">
                      {file ? file.name : "Click to select a document"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                        : "PPTX, DOCX, XLSX, OR PDF (MAX 50MB)"}
                    </p>
                  </div>
                </div>
                {/* DO NOT MOVE: Hidden file input MUST stay here for functionality */}
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".pdf,.pptx,.docx,.doc,.xlsx"
                  onChange={handleFileChange}
                />
              </div>

              {/* Display Mode Toggle for New Formats or Pro Formats */}
              {file && fileType !== "pdf" && (
                <div className="p-4 md:p-6 rounded-lg border border-[#222] bg-[#141414] flex flex-col gap-4 mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Experience Mode
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        How should visitors see this?
                      </p>
                    </div>
                    <div className="flex bg-[#0a0a0a] border border-[#222] p-1 rounded-md w-fit">
                      <button
                        type="button"
                        onClick={() => setConversionMode("raw")}
                        className={cn(
                          "px-4 py-1.5 text-xs font-medium rounded transition-all",
                          conversionMode === "raw"
                            ? "bg-[#222] text-white"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        RAW
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const config =
                            TIER_CONFIG[userProfile?.tier || "FREE"];
                          if (!config.allowInteractive) {
                            setUpsellFeature("Interactive Mode");
                            setShowUpsell(true);
                          } else {
                            setConversionMode("interactive");
                          }
                        }}
                        className={cn(
                          "px-4 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-2",
                          conversionMode === "interactive"
                            ? "bg-[#222] text-white"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        INTERACTIVE
                        {!TIER_CONFIG[userProfile?.tier || "FREE"]
                          .allowInteractive && (
                          <span className="bg-[#111] text-[#999] border border-[#333] text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            PRO
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    {conversionMode === "interactive"
                      ? "✨ We will convert your document into a smooth, slide-based presentation."
                      : "📄 Visitors will see the original document in a high-fidelity embed viewer."}
                  </p>
                </div>
              )}
            </div>

            {/* --- Document Details Section (Section 2) --- */}
            <div className="space-y-6 pt-6 border-t border-[#222]">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-deckly-primary" />
                <h3 className="text-sm font-medium text-white">
                  Asset Specifications
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Asset Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Series A Pitch Deck - v2"
                    className="h-11 rounded-md border-[#333] bg-[#141414] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 transition-all focus:bg-[#1a1a1a]"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="slug"
                    className="text-xs font-semibold text-slate-300"
                  >
                    URL Slug
                  </Label>
                  <div className="relative group/slug">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10">
                      <span className="text-sm text-slate-500">
                        {authProfile?.handle || userProfile?.handle || "..."}/
                      </span>
                    </div>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => {
                        if (!editId) {
                          setSlug(normalizeSlug(e.target.value));
                        }
                      }}
                      required
                      placeholder="my-pitch"
                      disabled={!!editId}
                      className={cn(
                        "h-11 rounded-md border-[#333] bg-[#141414] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-[#1a1a1a] disabled:opacity-50",
                        userProfile?.handle || authProfile?.handle
                          ? "pl-[100px]" // Approximation based on handle length, could be dynamic but sticking to fixed for now.
                          : "pl-12",
                      )}
                    />
                    {isCheckingSlug && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2
                          size={16}
                          className="text-slate-500 animate-spin"
                        />
                      </div>
                    )}
                  </div>
                  <AnimatePresence>
                    {!editId &&
                      slug.length > 2 &&
                      isSlugAvailable === false &&
                      !isCheckingSlug && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="mt-1.5 text-xs text-red-500 flex items-center gap-1.5"
                        >
                          <AlertCircle size={14} />
                          This slug is already taken
                        </motion.p>
                      )}
                    {!editId &&
                      slug.length > 2 &&
                      isSlugAvailable === true &&
                      !isCheckingSlug && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-1.5 text-xs text-emerald-500 flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={14} />
                          URL Available
                        </motion.p>
                      )}
                  </AnimatePresence>
                  {editId ? (
                    <p className="text-xs text-slate-500 mt-1">
                      Links are permanent to prevent breaks.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      Your URL: deckly.com/
                      {authProfile?.handle || userProfile?.handle || "..."}/
                      {slug || "your-slug"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-semibold text-slate-300"
                >
                  Description
                </Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly explain what this document contains..."
                  rows={3}
                  className="flex w-full rounded-md border border-[#333] bg-[#141414] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-deckly-primary focus:bg-[#1a1a1a] transition-all resize-none"
                />
              </div>
            </div>

            {/* --- Access Protection Section --- */}
            <div className="pt-6 border-t border-[#222] space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={16} className="text-deckly-primary" />
                <h3 className="text-sm font-medium text-white">
                  Security & Access
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Require Email */}
                <div
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
                    requireEmail
                      ? "bg-[#1a1a1a] border-deckly-primary"
                      : "bg-[#141414] border-[#333]",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-md flex items-center justify-center transition-colors",
                        requireEmail
                          ? "bg-deckly-primary/10 text-deckly-primary"
                          : "bg-[#0f0f0f] border border-[#222] text-slate-500",
                      )}
                    >
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Email Required
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID Authentication
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requireEmail}
                    onCheckedChange={setRequireEmail}
                  />
                </div>

                {/* Password Protected */}
                <div
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
                    requirePassword
                      ? "bg-[#1a1a1a] border-deckly-primary"
                      : "bg-[#141414] border-[#333]",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-md flex items-center justify-center transition-colors",
                        requirePassword
                          ? "bg-deckly-primary/10 text-deckly-primary"
                          : "bg-[#0f0f0f] border border-[#222] text-slate-500",
                      )}
                    >
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Gate Access
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Password Lock
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requirePassword}
                    onCheckedChange={setRequirePassword}
                  />
                </div>
              </div>

              <AnimatePresence>
                {requirePassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 mt-4">
                      <Label
                        htmlFor="password"
                        className="text-xs font-semibold text-slate-300"
                      >
                        Viewing Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPasswordField ? "text" : "password"}
                          value={viewPassword}
                          onChange={(e) => setViewPassword(e.target.value)}
                          placeholder="Create a strong password"
                          required={requirePassword}
                          className="h-11 rounded-md border-[#333] bg-[#141414] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 pr-12 transition-all focus:bg-[#1a1a1a]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordField(!showPasswordField)
                          }
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        >
                          {showPasswordField ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Expiry Date Toggle */}
              <div
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
                  enableExpiry
                    ? "bg-[#1a1a1a] border-deckly-primary"
                    : "bg-[#141414] border-[#333]",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-md flex items-center justify-center transition-colors",
                      enableExpiry
                        ? "bg-deckly-primary/10 text-deckly-primary"
                        : "bg-[#0f0f0f] border border-[#222] text-slate-500",
                    )}
                  >
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Expiration
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Duration Control
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableExpiry}
                  onCheckedChange={(checked) => {
                    setEnableExpiry(checked);
                    if (!checked) setExpiresAt("");
                  }}
                />
              </div>

              <AnimatePresence>
                {enableExpiry && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 mt-4">
                      <Label
                        htmlFor="expiry"
                        className="text-xs font-semibold text-slate-300"
                      >
                        Expiry Date
                      </Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="h-11 rounded-md border-[#333] bg-[#141414] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-[#1a1a1a] [color-scheme:dark]"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* --- Progress & Error --- */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3 pt-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2
                        size={14}
                        className="text-deckly-primary animate-spin"
                      />
                      <span className="text-xs font-medium text-deckly-primary">
                        {progress}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                    <motion.div
                      className="absolute top-0 left-0 h-full bg-deckly-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex items-center gap-3 bg-red-500/10 p-4 rounded-md border border-red-500/20 text-red-500 mt-4"
                >
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* --- Actions --- */}
            <div className="flex flex-col gap-3 pt-6 border-t border-[#222]">
              <Button
                type="submit"
                disabled={loading}
                className="h-12 rounded-md bg-deckly-primary hover:bg-deckly-primary/90 text-slate-950 font-semibold text-sm transition-all"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin text-slate-950"
                    />
                    Syncing Data...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} />
                    {editId ? "Update Asset" : "Finalize & Upload"}
                  </div>
                )}
              </Button>

              <Link to="/content">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-11 text-slate-400 hover:text-white hover:bg-white/5 font-medium text-sm rounded-md transition-all"
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Back to Assets
                </Button>
              </Link>
            </div>
          </form>
        </DashboardCard>
      </div>
      <TierUpsellModal
        isOpen={showUpsell}
        onClose={() => setShowUpsell(false)}
        featureName={upsellFeature}
      />
    </DashboardLayout>
  );
}

export default ManageDeck;
