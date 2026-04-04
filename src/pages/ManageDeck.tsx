import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCheckDeckSlug } from "../hooks/useSlugValidation";
import { useManageDeckWorkflow } from "../hooks/useManageDeckWorkflow";
import { useAuth } from "../contexts/AuthContext";
import { normalizeSlug } from "../utils/slug";
import { TIER_CONFIG } from "../constants/tiers";
import { Deck, UserProfile } from "../types";
import { TierUpsellModal } from "../components/dashboard/TierUpsellModal";
import { DashboardLayout } from "../components/layout/DashboardLayout";
import { DashboardCard } from "../components/ui/DashboardCard";
import {
  ManageDeckAccessSection,
  ManageDeckActionsSection,
  ManageDeckDetailsSection,
  ManageDeckFeedbackSection,
  ManageDeckUploadSection,
} from "../components/dashboard/manage-deck/ManageDeckSections";

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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile: authProfile } = useAuth();
  const queryClient = useQueryClient();

  const { data: isSlugAvailable, isLoading: isCheckingSlug } = useCheckDeckSlug(
    slug,
    editId || undefined,
  );

  const { submitDeck } = useManageDeckWorkflow({
    editId,
    setExistingDeck,
    setTitle,
    setSlug,
    setDescription,
    setRequireEmail,
    setRequirePassword,
    setViewPassword,
    setExpiresAt,
    setEnableExpiry,
    setLoading,
    setProgress,
    setProgressPercent,
    setError,
    setUserProfile,
  });

  // Clear uploadError when profile becomes available
  React.useEffect(() => {
    if (userProfile && uploadError) {
      setUploadError(null);
    }
  }, [userProfile, uploadError]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "pptx", "docx", "doc", "xlsx"];

    // Ensure profile is loaded before proceeding with tier-sensitive checks
    if (!userProfile) {
      setUploadError("Loading platform profile... Please wait.");
      return;
    }

    if (!ext || !validExts.includes(ext)) {
      alert("Please select a supported file (PDF, PPTX, DOCX, DOC, or XLSX).");
      return;
    }

    const currentTier = (userProfile?.tier as keyof typeof TIER_CONFIG) || "FREE";
    const config = TIER_CONFIG[currentTier];

    if (ext !== "pdf" && !config.allowOffice) {
      setUpsellFeature(`${ext.toUpperCase()} Support`);
      setShowUpsell(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);
    setFileType(ext);

    if (ext === "xlsx") {
      setConversionMode("raw");
    } else if (ext === "pptx") {
      setConversionMode(config.allowInteractive ? "interactive" : "raw");
    } else {
      setConversionMode("raw");
    }

    const baseName = selectedFile.name.includes(".")
      ? selectedFile.name.substring(0, selectedFile.name.lastIndexOf("."))
      : selectedFile.name;

    if (!slug && !editId) {
      const generatedSlug = normalizeSlug(
        `${baseName}-${Math.random().toString(36).substring(2, 6)}`,
      );
      setSlug(generatedSlug);
    }

    if (!title && !editId) {
      setTitle(baseName);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!file && !editId) || !title || !slug) return;

    if (!isSlugAvailable && !editId) {
      setError("This URL Slug is already taken. Please enter a different one.");
      return;
    }

    await submitDeck({
      file,
      title,
      slug,
      description,
      requireEmail,
      requirePassword,
      viewPassword,
      expiresAt,
      conversionMode,
      fileType,
      existingDeck,
      returnToRoom,
      queryClient,
      navigate,
    });
  };

  return (
    <DashboardLayout title={editId ? "Refine Deck" : "Add New Asset"}>
      <div className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6">
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

        <DashboardCard className="p-6 md:p-8 border-border relative overflow-hidden">
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <ManageDeckUploadSection
              editId={editId}
              file={file}
              fileType={fileType}
              loading={loading}
              conversionMode={conversionMode}
              userProfile={userProfile}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              onConversionModeChange={setConversionMode}
              onUpsellRequest={(featureName) => {
                setUpsellFeature(featureName);
                setShowUpsell(true);
              }}
              disabled={!userProfile}
              error={uploadError}
            />

            <ManageDeckDetailsSection
              editId={editId}
              title={title}
              slug={slug}
              description={description}
              isCheckingSlug={isCheckingSlug}
              isSlugAvailable={isSlugAvailable}
              authHandle={authProfile?.handle}
              userProfile={userProfile}
              onTitleChange={setTitle}
              onSlugChange={(value) => setSlug(normalizeSlug(value))}
              onDescriptionChange={setDescription}
            />

            <ManageDeckAccessSection
              requireEmail={requireEmail}
              requirePassword={requirePassword}
              viewPassword={viewPassword}
              showPasswordField={showPasswordField}
              enableExpiry={enableExpiry}
              expiresAt={expiresAt}
              onRequireEmailChange={setRequireEmail}
              onRequirePasswordChange={setRequirePassword}
              onViewPasswordChange={setViewPassword}
              onTogglePasswordVisibility={() =>
                setShowPasswordField((value) => !value)
              }
              onEnableExpiryChange={(checked) => {
                setEnableExpiry(checked);
                if (!checked) setExpiresAt("");
              }}
              onExpiresAtChange={setExpiresAt}
            />

            <ManageDeckFeedbackSection
              loading={loading}
              progress={progress}
              progressPercent={progressPercent}
              error={error}
            />

            <ManageDeckActionsSection
              editId={editId}
              loading={loading}
              returnToRoom={returnToRoom}
              onCancel={() =>
                navigate(returnToRoom ? `/rooms/${returnToRoom}` : "/content")
              }
            />
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
