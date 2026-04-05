import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CalendarDays,
  Loader2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_CONFIG } from "../../../constants/tiers";
import { UserProfile } from "../../../types";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Switch } from "../../ui/switch";
import { Button } from "../../ui/button";

interface UploadSectionProps {
  editId: string | null;
  file: File | null;
  fileType: string;
  loading: boolean;
  conversionMode: "raw" | "interactive";
  userProfile: UserProfile | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onConversionModeChange: (mode: "raw" | "interactive") => void;
  onUpsellRequest: (featureName: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function ManageDeckUploadSection({
  editId,
  file,
  fileType,
  loading,
  conversionMode,
  userProfile,
  fileInputRef,
  onFileChange,
  onConversionModeChange,
  onUpsellRequest,
  disabled = false,
  error,
}: UploadSectionProps) {
  const config = useMemo(
    () => TIER_CONFIG[userProfile?.tier || "FREE"],
    [userProfile?.tier],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Upload size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">
          {editId ? "Replace Document" : "Upload Document"}
        </h3>
      </div>
      <div
        onClick={() => !loading && !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (loading || disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        id="tour-upload-dropzone"
        aria-label="Upload document"
        className={cn(
          "relative group cursor-pointer border border-border border-dashed rounded-lg p-8 md:p-12 text-center transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-deckly-primary/50",
          file
            ? "border-deckly-primary/30 bg-surface-container"
            : "bg-surface-low hover:bg-surface-container hover:border-border",
          (loading || disabled) ? "opacity-30 cursor-not-allowed" : "",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <div className="w-12 h-12 rounded-lg bg-[#2B2B2B] border border-border flex items-center justify-center">
              <CheckCircle2 size={24} className="text-deckly-primary" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-[#2B2B2B] border border-border flex items-center justify-center group-hover:border-border transition-colors">
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
                : "PPTX, DOCX, DOC, XLSX, OR PDF (MAX 50MB)"}
            </p>
          </div>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          hidden
          accept=".pdf,.pptx,.docx,.doc,.xlsx"
          onChange={onFileChange}
        />
      </div>

      {error && !file && (
        <div className="flex items-center gap-2 text-destructive text-xs font-semibold animate-in fade-in slide-in-from-top-1 px-1">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {file && fileType !== "pdf" && (
        <div className="p-4 md:p-6 rounded-lg border border-white/5 bg-surface-lowest flex flex-col gap-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Experience Mode</p>
              <p className="text-xs text-slate-400 mt-1">
                How should visitors see this?
              </p>
            </div>
            <div className="flex bg-background border border-white/5 p-1 rounded-md w-fit">
              <button
                type="button"
                onClick={() => onConversionModeChange("raw")}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded transition-all",
                  conversionMode === "raw"
                    ? "bg-surface-card text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                RAW
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!config.allowInteractive) {
                    onUpsellRequest("Interactive Mode");
                  } else {
                    onConversionModeChange("interactive");
                  }
                }}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-2",
                  conversionMode === "interactive"
                    ? "bg-surface-card text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-300",
                )}
              >
                INTERACTIVE
                {!config.allowInteractive && (
                  <span className="bg-background text-slate-400 border border-white/5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    PRO
                  </span>
                )}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 italic">
            {conversionMode === "interactive"
              ? "We will convert your document into a smooth, slide-based presentation."
              : "Visitors will see the original document in a high-fidelity embed viewer."}
          </p>
        </div>
      )}
    </div>
  );
}

interface DetailsSectionProps {
  editId: string | null;
  title: string;
  slug: string;
  description: string;
  isCheckingSlug: boolean;
  isSlugAvailable: boolean | undefined;
  authHandle?: string | null;
  userProfile: UserProfile | null;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function ManageDeckDetailsSection({
  editId,
  title,
  slug,
  description,
  isCheckingSlug,
  isSlugAvailable,
  authHandle,
  userProfile,
  onTitleChange,
  onSlugChange,
  onDescriptionChange,
}: DetailsSectionProps) {
  return (
    <div className="space-y-6 pt-6 border-t border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">Asset Specifications</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-xs font-semibold text-slate-300">
            Asset Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            placeholder="e.g. Series A Pitch Deck - v2"
            className="h-11 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 transition-all focus:bg-[#2B2B2B]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug" className="text-xs font-semibold text-slate-300">
            URL Slug
          </Label>
          <div className="relative group/slug">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none z-10">
              <span className="text-sm text-slate-500">
                {authHandle || userProfile?.handle || "..."}/
              </span>
            </div>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              required
              placeholder="my-pitch"
              disabled={!!editId}
              className={cn(
                "h-11 rounded-md border-white/10 bg-[#2B2B2B] focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-[#2B2B2B] disabled:opacity-50",
                "pl-12"
              )}
              style={
                (authHandle || userProfile?.handle)
                  ? { paddingLeft: `${((authHandle || userProfile?.handle || "...").length * 8) + 48}px` }
                  : undefined
              }
            />
            {isCheckingSlug && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="text-slate-500 animate-spin" />
              </div>
            )}
          </div>
          <AnimatePresence>
            {!editId &&
              slug.length > 2 &&
              isSlugAvailable === false &&
              !isCheckingSlug && (
                <motion.p
                  key="slug-taken"
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
                  key="slug-available"
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
              Your URL: deckly.com/{authHandle || userProfile?.handle || "..."}/
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
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Briefly explain what this document contains..."
          rows={3}
          className="flex w-full rounded-md border border-white/10 bg-[#2B2B2B] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-deckly-primary focus:bg-[#2B2B2B] transition-all resize-none"
        />
      </div>
    </div>
  );
}

interface AccessSectionProps {
  requireEmail: boolean;
  requirePassword: boolean;
  viewPassword: string;
  showPasswordField: boolean;
  enableExpiry: boolean;
  expiresAt: string;
  onRequireEmailChange: (checked: boolean) => void;
  onRequirePasswordChange: (checked: boolean) => void;
  onViewPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onEnableExpiryChange: (checked: boolean) => void;
  onExpiresAtChange: (value: string) => void;
}

export function ManageDeckAccessSection({
  requireEmail,
  requirePassword,
  viewPassword,
  showPasswordField,
  enableExpiry,
  expiresAt,
  onRequireEmailChange,
  onRequirePasswordChange,
  onViewPasswordChange,
  onTogglePasswordVisibility,
  onEnableExpiryChange,
  onExpiresAtChange,
}: AccessSectionProps) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  return (
    <div id="tour-security-panel" className="pt-6 border-t border-white/5 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Lock size={16} className="text-deckly-primary" />
        <h3 className="text-sm font-medium text-white">Security & Access</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={cn(
            "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
            requireEmail
              ? "bg-background border-deckly-primary"
              : "bg-[#2B2B2B] border-white/10",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                requireEmail
                  ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                  : "text-slate-500",
              )}
            >
              <Mail size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Email Required</p>
              <p className="text-xs text-slate-500 mt-0.5">ID Authentication</p>
            </div>
          </div>
          <Switch checked={requireEmail} onCheckedChange={onRequireEmailChange} />
        </div>

        <div
          className={cn(
            "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
            requirePassword
              ? "bg-background border-deckly-primary"
              : "bg-[#2B2B2B] border-white/10",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                requirePassword
                  ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                  : "text-slate-500",
              )}
            >
              <Lock size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Gate Access</p>
              <p className="text-xs text-slate-500 mt-0.5">Password Lock</p>
            </div>
          </div>
          <Switch
            checked={requirePassword}
            onCheckedChange={onRequirePasswordChange}
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
                  onChange={(e) => onViewPasswordChange(e.target.value)}
                  placeholder="Create a strong password"
                  required={requirePassword}
                  className="h-11 rounded-md border-white/10 bg-surface-lowest focus-visible:ring-1 focus-visible:ring-deckly-primary text-white placeholder:text-slate-500 pr-12 transition-all focus:bg-background"
                />
                <button
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  aria-label={showPasswordField ? "Hide password" : "Show password"}
                >
                  {showPasswordField ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-all duration-200",
          enableExpiry
            ? "bg-background border-deckly-primary"
            : "bg-[#2B2B2B] border-white/10",
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
              enableExpiry
                ? "bg-deckly-primary/10 text-deckly-primary rounded-md"
                : "text-slate-500",
            )}
          >
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Expiration</p>
            <p className="text-xs text-slate-500 mt-0.5">Duration Control</p>
          </div>
        </div>
        <Switch checked={enableExpiry} onCheckedChange={onEnableExpiryChange} />
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
                onChange={(e) => onExpiresAtChange(e.target.value)}
                min={today}
                className="h-11 rounded-md border-white/10 bg-surface-lowest focus-visible:ring-1 focus-visible:ring-deckly-primary text-white transition-all focus:bg-background [color-scheme:dark]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FeedbackSectionProps {
  loading: boolean;
  progress: string;
  progressPercent: number;
  error: string | null;
}

export function ManageDeckFeedbackSection({
  loading,
  progress,
  progressPercent,
  error,
}: FeedbackSectionProps) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3 pt-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="text-deckly-primary animate-spin" />
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
              exit={{ width: 0 }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-3 bg-red-500/10 p-4 rounded-md border border-red-500/20 text-red-500 mt-4"
        >
          <AlertCircle size={18} className="shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ActionsSectionProps {
  editId: string | null;
  loading: boolean;
  returnToRoom: string | null;
  onCancel: () => void;
}

export function ManageDeckActionsSection({
  editId,
  loading,
  returnToRoom,
  onCancel,
}: ActionsSectionProps) {
  return (
    <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
      <Button
        id="tour-upload-finalize"
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="h-12 rounded-md bg-deckly-primary hover:bg-deckly-primary/90 text-slate-950 font-semibold text-sm transition-all"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-slate-950" />
            Syncing Data...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Sparkles size={16} />
            {editId ? "Update Asset" : "Finalize & Upload"}
          </div>
        )}
      </Button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full h-11 text-slate-400 hover:text-deckly-primary hover:bg-deckly-primary/5 hover:border-deckly-primary/20 font-medium text-sm rounded-md transition-all flex items-center justify-center border border-white/5"
      >
        <ArrowLeft size={16} className="mr-2" />
        {returnToRoom ? "Return to Data Room" : "Return to Assets"}
      </button>
    </div>
  );
}
