import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { deckStorageService } from "../services/deckStorageService";
import { supabase } from "../services/supabase";
import { userService } from "../services/userService";
import { dataRoomService } from "../services/dataRoomService";
import { processPdfToImages } from "../workflows/deckProcessing";
import { deckQueryKeys } from "./useDecks";
import { userTotalStatsQueryKeys } from "./useUserTotalStats";
import { documentProcessingService } from "../services/documentProcessingService";
import { Deck, SlidePage, UserProfile } from "../types";
import posthog from "posthog-js";
import * as Sentry from "@sentry/react";

type SetState<T> = Dispatch<SetStateAction<T>>;

function isErrorWithMessageCode(err: unknown): err is { message: string; code?: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  );
}

interface UseManageDeckWorkflowParams {
  editId: string | null;
  setExistingDeck: SetState<Deck | null>;
  setTitle: SetState<string>;
  setSlug: SetState<string>;
  setDescription: SetState<string>;
  setRequireEmail: SetState<boolean>;
  setRequirePassword: SetState<boolean>;
  setAllowDownload: SetState<boolean>;
  setWatermarkEnabled: SetState<boolean>;
  setWatermarkText: SetState<string>;
  setFileType: SetState<string>;
  setViewPassword: SetState<string>;
  setExpiresAt: SetState<string>;
  setEnableExpiry: SetState<boolean>;
  setLoading: SetState<boolean>;
  setProgress: SetState<string>;
  setProgressPercent: SetState<number>;
  setError: SetState<string | null>;
  setUserProfile: SetState<UserProfile | null>;
}

interface SubmitDeckParams {
  file: File | null;
  title: string;
  slug: string;
  description: string;
  requireEmail: boolean;
  requirePassword: boolean;
  allowDownload: boolean;
  watermarkEnabled: boolean;
  watermarkText: string;
  viewPassword: string;
  expiresAt: string;
  conversionMode: "raw" | "interactive";
  fileType: string;
  existingDeck: Deck | null;
  returnToRoom: string | null;
  queryClient: QueryClient;
  navigate: (path: string) => void;
}

export function useManageDeckWorkflow({
  editId,
  setExistingDeck,
  setTitle,
  setSlug,
  setDescription,
  setRequireEmail,
  setRequirePassword,
  setAllowDownload,
  setWatermarkEnabled,
  setWatermarkText,
  setFileType,
  setViewPassword,
  setExpiresAt,
  setEnableExpiry,
  setLoading,
  setProgress,
  setProgressPercent,
  setError,
  setUserProfile,
}: UseManageDeckWorkflowParams) {
  const fetchProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) return;

    try {
      const profile = await userService.getProfile(session.user.id);
      setUserProfile(profile);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      setUserProfile(null);
      setError("Failed to load your profile. Some features may be limited.");
    }
  }, [setUserProfile, setError]);

  const loadExistingDeck = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setProgress("Loading deck data...");
        const deck = await deckService.getDeckById(id);
        if (!deck) {
          setError("Deck not found or has been deleted.");
          return;
        }

        setExistingDeck(deck);
        setTitle(deck.title);
        setSlug(deck.slug);
        setDescription(deck.description || "");
        setRequireEmail(deck.require_email || false);
        setRequirePassword(deck.require_password || false);
        setAllowDownload(deck.allow_download || false);
        setWatermarkEnabled(deck.watermark_enabled || false);
        setWatermarkText(deck.watermark_text || "");
        setFileType((deck.file_type || "pdf").toLowerCase());
        setViewPassword(deck.view_password || "");
        setExpiresAt(deck.expires_at ? deck.expires_at.split("T")[0] : "");
        setEnableExpiry(!!deck.expires_at);
      } catch (err: unknown) {
        console.error("Error loading deck:", err);
        setError("Failed to load deck for editing.");
      } finally {
        setLoading(false);
        setProgress("");
      }
    },
    [
      setDescription,
      setEnableExpiry,
      setError,
      setExistingDeck,
      setExpiresAt,
      setFileType,
      setLoading,
      setProgress,
      setRequireEmail,
      setRequirePassword,
      setAllowDownload,
      setWatermarkEnabled,
      setWatermarkText,
      setSlug,
      setTitle,
      setViewPassword,
    ],
  );

  useEffect(() => {
    fetchProfile();
    if (editId) {
      loadExistingDeck(editId);
    }
  }, [editId, fetchProfile, loadExistingDeck]);

  const processPdfFile = useCallback(
    async (pdfFile: File, baseOffset = 0, range = 50) => {
      setProgress("Loading PDF for processing...");
      const processed = await processPdfToImages(pdfFile, {
        scale: 2,
        quality: 1,
        onProgress: (current, total) => {
          setProgress(`Processing page ${current} of ${total}...`);
          setProgressPercent(
            Math.round(baseOffset + (current / total) * range),
          );
        },
      });
      if (processed.length > 500) {
        throw new Error("Viewable documents are limited to 500 pages.");
      }
      return processed;
    },
    [setProgress, setProgressPercent],
  );

  const submitDeck = useCallback(
    async ({
      file,
      title,
      slug,
      description,
      requireEmail,
      requirePassword,
      allowDownload,
      watermarkEnabled,
      watermarkText,
      viewPassword,
      expiresAt,
      conversionMode,
      fileType,
      existingDeck,
      returnToRoom,
      queryClient,
      navigate,
    }: SubmitDeckParams) => {
      const normalizedWatermarkText = watermarkText.trim();
      if (watermarkEnabled && !normalizedWatermarkText) {
        setError("Enter watermark text before saving with watermarking enabled.");
        return;
      }

      setLoading(true);
      setError(null);
      setProgressPercent(0);

      posthog.capture("deck_upload_initiated", {
        title,
        is_edit: !!editId,
        file_type: fileType,
        conversion_mode: conversionMode,
      });

      try {
        let finalFileUrl = existingDeck?.file_url;
        let finalFileSize = existingDeck?.file_size ?? 0;
        let finalPageCount = existingDeck?.page_count ?? null;
        let finalPages: SlidePage[] = existingDeck?.pages || [];
        let finalStatus = existingDeck?.status || "PROCESSED";
        let finalConversionMode = existingDeck?.display_mode || conversionMode;
        let finalFileType = existingDeck?.file_type || fileType;
        let oldSlidePathsToDelete: string[] = [];
        let stagingVersion = "";
        const finalViewPassword = requirePassword
          ? viewPassword.trim() || null
          : null;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");
        const userId = session.user.id;
        const invalidateDeckDashboardQueries = () => {
          queryClient.invalidateQueries({
            queryKey: deckQueryKeys.list(userId),
          });
          queryClient.invalidateQueries({
            queryKey: userTotalStatsQueryKeys.allForUser(userId),
          });
        };

        // Office files are always converted asynchronously.  The backend
        // creates a durable draft/outbox row before accepting bytes, so a tab
        // closing cannot strand conversion or expose an unfinished document.
        if (file && fileType !== "pdf") {
          setProgress("Preparing secure document conversion...");
          setProgressPercent(5);
          const prepared = await documentProcessingService.prepareOfficeUpload({
            replacementDeckId: editId ?? undefined,
            title,
            slug,
            description,
            sourceFilename: file.name,
            sourceFileType: fileType,
            sourceSizeBytes: file.size,
            requireEmail,
            requirePassword,
            viewPassword: finalViewPassword,
            expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
            allowDownload,
            watermarkEnabled,
            watermarkText: watermarkEnabled ? normalizedWatermarkText : null,
          });

          // For replacements, metadata travels with the job and is committed
          // only with the validated output bundle.  The live revision is
          // therefore completely unchanged if conversion fails or is cancelled.

          setProgress("Uploading document for conversion...");
          setProgressPercent(20);
          await documentProcessingService.uploadPreparedOfficeSource(prepared.uploadUrl, file);
          setProgress("Conversion queued. You can safely leave this page.");
          setProgressPercent(30);
          await documentProcessingService.completeUpload(prepared.jobId);

          if (returnToRoom && prepared.deckId) {
            await dataRoomService.addDocuments(returnToRoom, [prepared.deckId]);
          }
          invalidateDeckDashboardQueries();
          posthog.capture("deck_upload_queued", {
            deck_id: prepared.deckId ?? editId ?? "new",
            job_id: prepared.jobId,
            file_type: fileType,
            is_edit: Boolean(editId),
          });
          navigate(returnToRoom ? `/rooms/${returnToRoom}` : "/content");
          return;
        }

        if (file) {
          setProgress("Uploading document...");
          setProgressPercent(5);
          const upload = await deckStorageService.uploadDeckFile(file, slug, userId);
          finalFileUrl = upload.publicUrl;

          if (editId && existingDeck) {
             const previousPages = existingDeck.pages || [];
             oldSlidePathsToDelete = previousPages.map(page => page.image_url);
          }
          finalConversionMode = conversionMode;
          finalFileType = fileType;
          stagingVersion = `v-${Date.now()}`;

          if (fileType === "pdf") {
            const imageAssets = await processPdfFile(file);
            setProgress(`Uploading slide 1 of ${imageAssets.length}...`);
            const imageUrls = await deckStorageService.uploadSlideImages(
              userId,
              slug,
              imageAssets.map((asset) => asset.blob),
              (current, total) => {
                setProgress(`Uploading slide ${current} of ${total}...`);
                setProgressPercent(50 + Math.round((current / total) * 45));
              },
              stagingVersion
            );
            finalPages = imageUrls.map((url, idx) => ({
              image_url: url,
              page_number: idx + 1,
              width: imageAssets[idx]?.width,
              height: imageAssets[idx]?.height,
              links: imageAssets[idx]?.links || [],
            }));
            const verifiedPdf = await documentProcessingService.verifyDirectPdf(upload.fileName);
            if (verifiedPdf.pageCount !== finalPages.length) {
              throw new Error("PDF pages changed during verification. Please upload the file again.");
            }
            finalFileUrl = verifiedPdf.storagePath;
            finalFileSize = verifiedPdf.fileSize;
            finalPageCount = verifiedPdf.pageCount;
            finalStatus = "PROCESSED";
          } else if (finalConversionMode === "interactive") {
            finalStatus = "CONVERTING";
            finalPages = [];
          } else {
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
              status: finalStatus as "PENDING" | "CONVERTING" | "PROCESSED",
              display_mode: conversionMode,
              file_size: finalFileSize,
              page_count: finalPageCount,
              file_type: finalFileType,
              ...(file ? { extracted_text: null } : {}),
              require_email: requireEmail,
              require_password: requirePassword,
              allow_download: allowDownload,
              watermark_enabled: watermarkEnabled,
              watermark_text: watermarkEnabled ? normalizedWatermarkText : null,
              view_password: finalViewPassword,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            })
            .eq("id", editId);
          if (dbError) throw dbError;

          const shouldCleanupDisabledWatermark = !watermarkEnabled && existingDeck?.watermark_enabled;
          if (shouldCleanupDisabledWatermark) {
            await deckService.cleanupWatermarkedDeck(editId).catch((cleanupError) => {
              console.error("Watermark cleanup failed after disabling:", cleanupError);
            });
          }

          if (oldSlidePathsToDelete.length > 0) {
            const newUrls = new Set(finalPages.map(p => p.image_url));
            const actuallyDelete = oldSlidePathsToDelete.filter(url => !newUrls.has(url));
            await deckStorageService.deleteSlideImages(actuallyDelete).catch((cleanupError) => {
              console.error("Failed to clean up replaced slide images:", cleanupError);
            });
          }

        } else {
          setProgress("Finalizing...");
          setProgressPercent(95);

          const { data: deckRecord, error: deckCreateError } = await supabase.rpc(
            "create_deck_with_primary_link",
            {
              p_user_id: userId,
              p_title: title,
              p_slug: slug,
              p_description: description,
              p_file_url: finalFileUrl,
              p_pages: finalPages,
              p_status: finalStatus as "PENDING" | "CONVERTING" | "PROCESSED",
              p_display_mode: conversionMode,
              p_file_size: finalFileSize,
              p_file_type: fileType,
              p_require_email: requireEmail,
              p_require_password: requirePassword,
              p_allow_download: allowDownload,
              p_watermark_enabled: watermarkEnabled,
              p_watermark_text: watermarkEnabled ? normalizedWatermarkText : null,
              p_view_password: finalViewPassword,
              p_expires_at: expiresAt
                ? new Date(expiresAt).toISOString()
                : null,
            },
          );

          if (deckCreateError) throw deckCreateError;

          if (returnToRoom && deckRecord) {
            setProgress("Linking to Data Room...");
            await dataRoomService.addDocuments(returnToRoom, [deckRecord.id]);
          }

          if (watermarkEnabled && fileType === "pdf" && deckRecord) {
            // The database trigger queued a durable watermark job together
            // with the deck record. Saving remains non-blocking.
            setProgress("Preparing protected download in the background...");
          }
        }

        const shouldQueueUpdatedWatermark = Boolean(
          editId &&
          watermarkEnabled &&
          finalFileType === "pdf" &&
          (
            file ||
            !existingDeck?.watermark_enabled ||
            watermarkText.trim() !== (existingDeck?.watermark_text || "").trim() ||
            existingDeck.watermark_status !== "ready"
          ),
        );
        if (shouldQueueUpdatedWatermark && editId) {
          setProgress("Preparing protected download in the background...");
        }

        setProgress("Successful!");
        setProgressPercent(100);

        invalidateDeckDashboardQueries();

        navigate(returnToRoom ? `/rooms/${returnToRoom}` : "/content");
        
        posthog.capture("deck_upload_completed", {
          deck_id: editId || "new",
          title,
          file_type: fileType,
          is_edit: !!editId,
        });
      } catch (err: unknown) {
        console.error("Upload error:", err);
        Sentry.captureException(err);
        let errorMsg = "Something went wrong. Please try again.";

        if (isErrorWithMessageCode(err)) {
          errorMsg = err.message;
          if (err.code === "23505" && err.message.includes("slug")) {
            errorMsg = "This URL Slug is already taken. Please enter a different one.";
          }
        }
        setError(errorMsg);
        setProgress("");
        setProgressPercent(0);
        posthog.capture("deck_upload_failed", {
          error: errorMsg,
          is_edit: !!editId,
        });
      } finally {
        setLoading(false);
      }
    },
    [
      editId,
      processPdfFile,
      setError,
      setLoading,
      setProgress,
      setProgressPercent,
    ],
  );

  return {
    processPdfFile,
    submitDeck,
  };
}
