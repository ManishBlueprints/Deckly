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
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { Deck, SlidePage, UserProfile } from "../types";
import { cn } from "@/lib/utils";
import { userService } from "../services/userService";
import { TierUpsellModal } from "../components/TierUpsellModal";
import { TIER_CONFIG } from "../constants/tiers";
import { normalizeSlug } from "../utils/slug";

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
    } catch (err: any) {
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
    const imageBlobs: Blob[] = [];

    for (let i = 1; i <= numPages; i++) {
      setProgress(`Processing page ${i} of ${numPages}...`);
      setProgressPercent(Math.round((i / numPages) * 50));
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await (page as any).render({ canvasContext: context, viewport }).promise;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.8),
      );
      if (blob) imageBlobs.push(blob);
    }

    return imageBlobs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!file && !editId) || !title || !slug) return;

    setLoading(true);
    setError(null);
    setProgressPercent(0);

    try {
      let finalFileUrl = existingDeck?.file_url;
      let finalPages: SlidePage[] = existingDeck?.pages || [];
      let finalStatus = "PROCESSED"; // Default to processed if it's raw non-pdf

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
          const imageBlobs = await processPdfToImages(file);
          setProgress(`Uploading slide 1 of ${imageBlobs.length}...`);
          const imageUrls = await deckService.uploadSlideImages(
            userId,
            slug,
            imageBlobs,
            (current, total) => {
              setProgress(`Uploading slide ${current} of ${total}...`);
              setProgressPercent(50 + Math.round((current / total) * 45));
            },
          );
          finalPages = imageUrls.map((url, idx) => ({
            image_url: url,
            page_number: idx + 1,
          }));
          finalStatus = "PROCESSED";
        } else if (conversionMode === "interactive") {
          // TODO: Trigger backend conversion for PPTX/DOCX
          // For now, mark as pending and we will handle it via Edge Function later
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
            status: finalStatus as any,
            display_mode: conversionMode,
            file_size: file ? file.size : existingDeck?.file_size,
            file_type: fileType as any,
            require_email: requireEmail,
            require_password: requirePassword,
            view_password: viewPassword,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
          .eq("id", editId);
        if (dbError) throw dbError;

        // Trigger conversion on update if file changed and mode is interactive
        if (file && fileType !== "pdf" && conversionMode === "interactive") {
          setProgress("Processing interactive slides...");
          setProgressPercent(98);
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
              view_password: viewPassword,
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
          setProgress("Processing interactive slides...");
          setProgressPercent(98);
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
        }
      }

      setProgress("Successful!");
      setProgressPercent(100);

      // Navigate back
      setTimeout(
        () => navigate(returnToRoom ? `/rooms/${returnToRoom}` : "/content"),
        1500,
      );
    } catch (err: any) {
      console.error("Upload error:", err);
      let errorMsg = err.message || "Something went wrong. Please try again.";
      if (err.code === "23505" && err.message.includes("slug")) {
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
      <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full space-y-6">
        {/* Page Header */}
        <div>
          <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight uppercase tracking-[0.05em]">
            {editId ? "Refine Deck" : "Add New Asset"}
          </h2>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-2">
            {editId
              ? "Update your pitch deck details and slides"
              : "Upload a PDF to your data room"}
          </p>
        </div>

        {/* Main Form Card */}
        <DashboardCard className="p-6 md:p-12 border-white/5 shadow-2xl glass-shiny relative overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col gap-10">
            {/* --- PDF Upload Zone (Section 1) --- */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Upload size={14} className="text-deckly-primary" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {editId ? "Replace Document" : "Upload Document"}
                </h3>
              </div>
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                className={cn(
                  "relative group cursor-pointer border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all duration-500",
                  file
                    ? "border-deckly-primary/30 bg-deckly-primary/5 shadow-[0_0_30px_rgba(34,197,94,0.05)]"
                    : "border-white/10 bg-white/[0.02] hover:border-deckly-primary/30 hover:bg-deckly-primary/[0.02]",
                  loading ? "opacity-30 cursor-not-allowed" : "",
                )}
              >
                <div className="flex flex-col items-center gap-4">
                  {file ? (
                    <div className="w-16 h-16 rounded-2xl bg-deckly-primary/10 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                      <CheckCircle2 size={32} className="text-deckly-primary" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-deckly-primary/10 group-hover:border-deckly-primary/20 transition-all duration-500">
                      <Upload
                        size={32}
                        className="text-slate-500 group-hover:text-deckly-primary transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-base font-bold text-white tracking-tight">
                      {file ? file.name : "Click to select a document"}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-2">
                      {file
                        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                        : "PPTX, DOCX, XLSX, OR PDF (MAX 50MB)"}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  hidden
                  accept=".pdf,.pptx,.docx,.doc,.xlsx"
                  onChange={handleFileChange}
                />
              </div>

              {/* Display Mode Toggle for New Formats */}
              {file && fileType !== "pdf" && (
                <div className="p-6 rounded-2xl border border-deckly-primary/20 bg-deckly-primary/[0.03] backdrop-blur-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-deckly-primary">
                        Experience Mode
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        How should visitors see this?
                      </p>
                    </div>
                    <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setConversionMode("raw")}
                        className={cn(
                          "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                          conversionMode === "raw"
                            ? "bg-deckly-primary text-slate-950 shadow-lg"
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
                          "px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center gap-2",
                          conversionMode === "interactive"
                            ? "bg-deckly-primary text-slate-950 shadow-lg"
                            : "text-slate-500 hover:text-slate-300",
                        )}
                      >
                        INTERACTIVE
                        {!TIER_CONFIG[userProfile?.tier || "FREE"]
                          .allowInteractive && (
                          <span className="bg-slate-950/20 text-[8px] px-1.5 py-0.5 rounded font-bold">
                            PRO
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed italic opacity-80">
                    {conversionMode === "interactive"
                      ? "✨ We will convert your document into a smooth, slide-based presentation."
                      : "📄 Visitors will see the original document in a high-fidelity embed viewer."}
                  </p>
                </div>
              )}
            </div>

            {/* --- Document Details Section (Section 2) --- */}
            <div className="space-y-6 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-deckly-primary" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  Asset Specifications
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80 ml-1"
                  >
                    Asset Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g. Series A Pitch Deck - v2"
                    className="h-12 rounded-xl border-white/10 bg-white/5 focus-visible:ring-deckly-primary/30 text-white placeholder:text-slate-600 transition-all focus:bg-white/[0.08]"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="slug"
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80 ml-1"
                  >
                    URL Slug
                  </Label>
                  <div className="relative group/slug">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {userProfile?.handle || "username"}/
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
                        "h-12 rounded-xl border-white/10 bg-white/5 focus-visible:ring-deckly-primary/30 text-deckly-primary font-bold uppercase tracking-wider transition-all focus:bg-white/[0.08] disabled:opacity-40",
                        userProfile?.handle ? "pl-28" : "pl-20",
                      )}
                    />
                  </div>
                  {editId ? (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-1 mt-1">
                      Links are permanent to prevent breaks.
                    </p>
                  ) : (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 px-1 mt-1">
                      Your URL: deckly.com/{userProfile?.handle || "..."}/
                      {slug || "your-slug"}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80 ml-1"
                >
                  Description
                </Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly explain what this document contains..."
                  rows={3}
                  className="flex w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus-visible:outline-none focus:bg-white/[0.08] focus:ring-1 focus:ring-deckly-primary/30 transition-all resize-none"
                />
              </div>
            </div>

            {/* --- Access Protection Section --- */}
            <div className="pt-8 border-t border-white/5 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Lock size={14} className="text-deckly-primary" />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  Security & Access
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Require Email */}
                <div
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300",
                    requireEmail
                      ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                      : "bg-white/[0.02] border-white/10",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        requireEmail
                          ? "bg-deckly-primary/20 text-deckly-primary"
                          : "bg-white/5 text-slate-500",
                      )}
                    >
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white leading-tight">
                        Email Required
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                        ID Authentication
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requireEmail}
                    onCheckedChange={setRequireEmail}
                    className="data-[state=checked]:bg-deckly-primary"
                  />
                </div>

                {/* Password Protected */}
                <div
                  className={cn(
                    "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300",
                    requirePassword
                      ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                      : "bg-white/[0.02] border-white/10",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                        requirePassword
                          ? "bg-deckly-primary/20 text-deckly-primary"
                          : "bg-white/5 text-slate-500",
                      )}
                    >
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-white leading-tight">
                        Gate Access
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                        Password Lock
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={requirePassword}
                    onCheckedChange={setRequirePassword}
                    className="data-[state=checked]:bg-deckly-primary"
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
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80 ml-1"
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
                          className="h-12 rounded-xl border-white/10 bg-white/5 focus-visible:ring-deckly-primary/30 text-white placeholder:text-slate-600 pr-12 transition-all focus:bg-white/[0.08]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowPasswordField(!showPasswordField)
                          }
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
                  "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300",
                  enableExpiry
                    ? "bg-deckly-primary/[0.08] border-deckly-primary/30 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                    : "bg-white/[0.02] border-white/10",
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      enableExpiry
                        ? "bg-deckly-primary/20 text-deckly-primary"
                        : "bg-white/5 text-slate-500",
                    )}
                  >
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-white leading-tight">
                      Expiration
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
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
                  className="data-[state=checked]:bg-deckly-primary"
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
                        className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500/80 ml-1"
                      >
                        Expiry Date
                      </Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="h-12 rounded-xl border-white/10 bg-white/5 focus-visible:ring-deckly-primary/30 text-white transition-all focus:bg-white/[0.08] [color-scheme:dark]"
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
                  className="space-y-4 pt-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-deckly-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      <span className="text-[10px] font-bold text-deckly-primary uppercase tracking-[0.2em]">
                        {progress}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      className="absolute top-0 left-0 h-full bg-deckly-primary shadow-[0_0_15px_rgba(34,197,94,0.5)]"
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
                  className="flex items-center gap-3 bg-red-500/10 p-5 rounded-2xl border border-red-500/20 text-red-400 mt-4"
                >
                  <AlertCircle size={20} className="shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                    {error}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* --- Actions --- */}
            <div className="flex flex-col gap-4 pt-6 border-t border-white/5">
              <Button
                type="submit"
                disabled={loading}
                className="h-14 rounded-2xl bg-deckly-primary hover:bg-deckly-primary/90 text-slate-950 font-bold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-deckly-primary/20 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                    Syncing Data...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} />
                    {editId ? "Update Asset" : "Finalize & Upload"}
                  </div>
                )}
              </Button>

              <Link to="/content">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full h-12 text-slate-500 hover:text-white hover:bg-white/5 font-bold text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                >
                  <ArrowLeft size={16} className="mr-3" />
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
