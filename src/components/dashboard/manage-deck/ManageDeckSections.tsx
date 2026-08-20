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
  Download,
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
import { PremiumFeatureIcon } from "../PremiumFeatureIcon";

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
        <Upload size={16} className="text-ui-primary" />
        <h3 className="text-sm font-medium text-ui-text">
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
          "group relative cursor-pointer rounded-[14px] border border-dashed border-ui-border bg-ui-subtle p-8 text-center outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ui-focus/40 md:p-12",
          file
            ? "border-ui-primary/40 bg-ui-subtle"
            : "hover:border-ui-primary/40 hover:bg-ui-elevated",
          loading || disabled ? "opacity-30 cursor-not-allowed" : "",
        )}
      >
        <div className="flex flex-col items-center gap-3">
          {file ? (
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-ui-border bg-ui-surface">
              <CheckCircle2 size={24} className="text-ui-primary" />
            </div>
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-ui-border bg-ui-surface transition-colors group-hover:border-ui-primary/40">
              <Upload
                size={24}
                className="text-ui-muted transition-colors group-hover:text-ui-primary"
              />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-ui-text">
              {file ? file.name : "Click to select a document"}
            </p>
            <p className="mt-1 text-xs text-ui-muted">
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
        <div className="mt-4 flex flex-col gap-4 rounded-[14px] border border-ui-border bg-ui-subtle p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-ui-text">
                Experience Mode
              </p>
              <p className="mt-1 text-xs text-ui-muted">
                How should visitors see this?
              </p>
            </div>
            <div className="flex w-fit rounded-[10px] border border-ui-border bg-ui-surface p-1">
              <button
                type="button"
                onClick={() => onConversionModeChange("raw")}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded transition-all",
                  conversionMode === "raw"
                    ? "bg-ui-primary text-ui-primary-text shadow-sm"
                    : "text-ui-muted hover:text-ui-text",
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
                    ? "bg-ui-primary text-ui-primary-text shadow-sm"
                    : "text-ui-muted hover:text-ui-text",
                )}
              >
                <PremiumFeatureIcon tier="PRO" />
                INTERACTIVE
              </button>
            </div>
          </div>
          <p className="text-xs italic text-ui-muted">
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
    <div className="space-y-6 border-t border-ui-border pt-6">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={16} className="text-ui-primary" />
        <h3 className="text-sm font-medium text-ui-text">Asset specifications</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label
            htmlFor="title"
            className="text-xs font-semibold text-ui-text"
          >
            Asset Title
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            required
            placeholder="e.g. Series A Pitch Deck - v2"
            className="h-11 rounded-[14px] border-ui-border bg-ui-surface text-ui-text transition-all placeholder:text-ui-muted focus-visible:ring-ui-focus"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="slug"
            className="text-xs font-semibold text-ui-text"
          >
            URL Slug
          </Label>
          <div className="relative group/slug">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-none z-10">
              <span className="whitespace-nowrap text-sm text-ui-primary">
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
                "h-11 rounded-[14px] border-ui-border bg-ui-surface text-ui-text transition-all focus-visible:ring-ui-focus disabled:opacity-50",
                "pl-8",
              )}
              style={
                authHandle || userProfile?.handle
                  ? {
                      paddingLeft: `${(authHandle || userProfile?.handle || "...").length * 7 + 32}px`,
                    }
                  : undefined
              }
            />
            {isCheckingSlug && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-ui-muted" />
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
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-ui-destructive"
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
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-ui-primary"
                >
                  <CheckCircle2 size={14} />
                  URL Available
                </motion.p>
              )}
          </AnimatePresence>
          {editId ? (
            <p className="mt-1 text-xs text-ui-muted">
              Links are permanent to prevent breaks.
            </p>
          ) : (
            <p className="mt-1 text-xs text-ui-muted">
              Your URL: deckly.com/{authHandle || userProfile?.handle || "..."}/
              {slug || "your-slug"}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="description"
          className="text-xs font-semibold text-ui-text"
        >
          Description
        </Label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Briefly explain what this document contains..."
          rows={3}
          className="flex w-full resize-none rounded-[14px] border border-ui-border bg-ui-surface px-3 py-2 text-sm text-ui-text transition-all placeholder:text-ui-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-focus/40"
        />
      </div>
    </div>
  );
}

interface AccessSectionProps {
  requireEmail: boolean;
  requirePassword: boolean;
  allowDownload: boolean;
  canUseAccessControls: boolean;
  canUseDownloadControls: boolean;
  viewPassword: string;
  showPasswordField: boolean;
  enableExpiry: boolean;
  expiresAt: string;
  onRequireEmailChange: (checked: boolean) => void;
  onRequirePasswordChange: (checked: boolean) => void;
  onAllowDownloadChange: (checked: boolean) => void;
  onAccessUpsell: () => void;
  onDownloadUpsell: () => void;
  onViewPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
  onEnableExpiryChange: (checked: boolean) => void;
  onExpiresAtChange: (value: string) => void;
  children?: React.ReactNode;
}

export function ManageDeckAccessSection({
  requireEmail,
  requirePassword,
  allowDownload,
  canUseAccessControls,
  canUseDownloadControls,
  viewPassword,
  showPasswordField,
  enableExpiry,
  expiresAt,
  onRequireEmailChange,
  onRequirePasswordChange,
  onAllowDownloadChange,
  onAccessUpsell,
  onDownloadUpsell,
  onViewPasswordChange,
  onTogglePasswordVisibility,
  onEnableExpiryChange,
  onExpiresAtChange,
  children,
}: AccessSectionProps) {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  return (
    <div
      id="tour-security-panel"
      className="space-y-6 border-t border-ui-border pt-6"
    >
      <div className="flex items-center gap-2 mb-2">
        <Lock size={16} className="text-ui-primary" />
        <h3 className="text-sm font-medium text-ui-text">Security & access</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className={cn(
            "flex items-center justify-between rounded-[14px] border p-4 transition-all duration-200",
            requireEmail
              ? "border-ui-primary bg-ui-subtle"
              : "border-ui-border bg-ui-surface",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                requireEmail
                  ? "rounded-[10px] bg-ui-primary/10 text-ui-primary"
                  : "text-ui-muted",
              )}
            >
              <Mail size={18} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ui-text">
                <PremiumFeatureIcon tier="PRO" />
                Email Required
              </p>
              <p className="mt-0.5 text-xs text-ui-muted">ID authentication</p>
            </div>
          </div>
          <Switch
            checked={requireEmail}
            onCheckedChange={(checked) => {
              if (checked && !canUseAccessControls) return onAccessUpsell();
              onRequireEmailChange(checked);
            }}
            aria-label={canUseAccessControls ? "Require viewer email" : "Require viewer email, available on Share"}
          />
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-[14px] border p-4 transition-all duration-200",
            requirePassword
              ? "border-ui-primary bg-ui-subtle"
              : "border-ui-border bg-ui-surface",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                requirePassword
                  ? "rounded-[10px] bg-ui-primary/10 text-ui-primary"
                  : "text-ui-muted",
              )}
            >
              <Lock size={18} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ui-text">
                <PremiumFeatureIcon tier="PRO" />
                Gate Access
              </p>
              <p className="mt-0.5 text-xs text-ui-muted">Password lock</p>
            </div>
          </div>
          <Switch
            checked={requirePassword}
            onCheckedChange={(checked) => {
              if (checked && !canUseAccessControls) return onAccessUpsell();
              onRequirePasswordChange(checked);
            }}
            aria-label={canUseAccessControls ? "Require a viewing password" : "Require a viewing password, available on Share"}
          />
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-[14px] border p-4 transition-all duration-200",
            allowDownload
              ? "border-ui-primary bg-ui-subtle"
              : "border-ui-border bg-ui-surface",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                allowDownload
                  ? "rounded-[10px] bg-ui-primary/10 text-ui-primary"
                  : "text-ui-muted",
              )}
            >
              <Download size={18} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ui-text">
                <PremiumFeatureIcon tier="PRO" />
                Downloads
              </p>
              <p className="mt-0.5 text-xs text-ui-muted">
                {allowDownload ? "Download enabled" : "Download disabled"}
              </p>
            </div>
          </div>
          <Switch
            checked={allowDownload}
            onCheckedChange={(checked) => {
              if (checked && !canUseDownloadControls) {
                onDownloadUpsell();
                return;
              }
              onAllowDownloadChange(checked);
            }}
            aria-label={
              canUseDownloadControls
                ? "Allow investors to download this deck"
                : "Allow investors to download this deck, available on Share"
            }
          />
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-[14px] border p-4 transition-all duration-200",
            enableExpiry
              ? "border-ui-primary bg-ui-subtle"
              : "border-ui-border bg-ui-surface",
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors shrink-0 aspect-square",
                enableExpiry
                  ? "rounded-[10px] bg-ui-primary/10 text-ui-primary"
                  : "text-ui-muted",
              )}
            >
              <CalendarDays size={18} />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ui-text">
                <PremiumFeatureIcon tier="PRO" />
                Expiration
              </p>
              <p className="mt-0.5 text-xs text-ui-muted">Duration control</p>
            </div>
          </div>
          <Switch
            checked={enableExpiry}
            onCheckedChange={(checked) => {
              if (checked && !canUseAccessControls) return onAccessUpsell();
              onEnableExpiryChange(checked);
            }}
            aria-label={canUseAccessControls ? "Set an expiry date" : "Set an expiry date, available on Share"}
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
                className="text-xs font-semibold text-ui-text"
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
                  className="h-11 rounded-[14px] border-ui-border bg-ui-surface pr-12 text-ui-text transition-all placeholder:text-ui-muted focus-visible:ring-ui-focus"
                />
                <button
                  type="button"
                  onClick={onTogglePasswordVisibility}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ui-muted transition-colors hover:text-ui-text"
                  aria-label={
                    showPasswordField ? "Hide password" : "Show password"
                  }
                >
                  {showPasswordField ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                className="text-xs font-semibold text-ui-text"
              >
                Expiry Date
              </Label>
              <Input
                id="expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => onExpiresAtChange(e.target.value)}
                min={today}
                className="h-11 rounded-[14px] border-ui-border bg-ui-surface text-ui-text transition-all focus-visible:ring-ui-focus"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}
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
            <span className="text-xs font-semibold text-ui-muted">
              {progressPercent}%
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-ui-border">
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
          className="mt-4 flex items-center gap-3 rounded-[14px] border border-ui-destructive/20 bg-ui-destructive/10 p-4 text-ui-destructive"
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
    <div className="flex flex-col gap-3 border-t border-ui-border pt-6">
      <Button
        id="tour-upload-finalize"
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="h-12 rounded-[14px] bg-ui-primary text-sm font-semibold text-ui-primary-text transition-opacity hover:opacity-90"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
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
        className="flex h-11 w-full items-center justify-center rounded-[14px] border border-ui-border text-sm font-medium text-ui-muted transition-all hover:border-ui-primary/30 hover:bg-ui-subtle hover:text-ui-primary"
      >
        <ArrowLeft size={16} className="mr-2" />
        {returnToRoom ? "Return to Data Room" : "Return to Assets"}
      </button>
    </div>
  );
}
