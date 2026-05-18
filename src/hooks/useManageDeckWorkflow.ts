import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { deckService } from "../services/deckService";
import { deckStorageService } from "../services/deckStorageService";
import { supabase } from "../services/supabase";
import { userService } from "../services/userService";
import { dataRoomService } from "../services/dataRoomService";
import { processPdfToImages } from "../workflows/deckProcessing";
import { extractStoragePath } from "../services/deckService.shared";
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
      setLoading,
      setProgress,
      setRequireEmail,
      setRequirePassword,
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
      return processPdfToImages(pdfFile, {
        scale: 2,
        quality: 1,
        onProgress: (current, total) => {
          setProgress(`Processing page ${current} of ${total}...`);
          setProgressPercent(
            Math.round(baseOffset + (current / total) * range),
          );
        },
      });
    },
    [setProgress, setProgressPercent],
  );

  const processConvertedPdf = useCallback(
    async (pdfUrl: string, targetDeckId: string, deckSlug: string, stagingVersion?: string) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const userId = session.user.id;

      setProgress("Downloading converted PDF...");
      setProgressPercent(65);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const pdfResponse = await fetch(pdfUrl, { signal: controller.signal });
        if (!pdfResponse.ok) {
          throw new Error(
            `Failed to download converted PDF (${pdfResponse.status})`,
          );
        }

        const pdfBlob = await pdfResponse.blob();
        clearTimeout(timeoutId);

        const pdfFile = new File([pdfBlob], "converted.pdf", {
          type: "application/pdf",
        });

        setProgress("Processing slides...");
        const imageAssets = await processPdfFile(pdfFile, 65, 5);

        setProgress(`Uploading slide 1 of ${imageAssets.length}...`);
        const imageUrls = await deckStorageService.uploadSlideImages(
          userId,
          deckSlug,
          imageAssets.map((asset) => asset.blob),
          (current, total) => {
            setProgress(`Uploading slide ${current} of ${total}...`);
            setProgressPercent(70 + Math.round((current / total) * 20));
          },
          stagingVersion
        );

        const processedPages = imageUrls.map((url, idx) => ({
          image_url: url,
          page_number: idx + 1,
          links: imageAssets[idx]?.links || [],
        }));

        setProgress("Finalizing slides...");
        setProgressPercent(92);
        const { error: updateError } = await supabase
          .from("decks")
          .update({
            pages: processedPages,
            status: "PROCESSED",
          })
          .eq("id", targetDeckId);

        if (updateError) throw updateError;

        setProgress("Cleaning up...");
        setProgressPercent(95);
        const tempPath = `${userId}/temp/${targetDeckId}.pdf`;
        try {
          const { error: cleanupError } = await supabase.storage
            .from("decks")
            .remove([tempPath]);
          if (cleanupError) {
            console.warn(
              `[WARNING] Cleanup failed for ${tempPath}:`,
              cleanupError.message,
            );
          }
        } catch (cleanupErr) {
          console.warn(
            `[WARNING] Cleanup failed silently for ${tempPath}`,
            cleanupErr,
          );
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error(
            "Download timed out after 60s. Your document might be too large or the network is slow.",
          );
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    [processPdfFile, setProgress, setProgressPercent],
  );

  const triggerAndProcessConversion = useCallback(
    async (deckId: string, deckSlug: string, stagingVersion?: string) => {
      setProgress("Converting document to PDF...");
      setProgressPercent(60);
      const { data: invokeData, error: invokeError } = await supabase.functions
        .invoke("document-processor", {
          body: { deckId },
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

      if (!invokeData?.pdf_url) {
        console.error("Missing pdf_url in invocation response:", invokeData);
        const { error: resetError } = await supabase
          .from("decks")
          .update({ status: "PENDING" })
          .eq("id", deckId);

        if (resetError) {
          console.error("Failed to reset deck status after missing URL:", {
            deckId,
            resetError,
          });
        }
        throw new Error(
          "Conversion succeeded but returned no PDF URL. Please try again.",
        );
      }

      await processConvertedPdf(invokeData.pdf_url, deckId, deckSlug, stagingVersion);
    },
    [processConvertedPdf, setProgress, setProgressPercent],
  );

  const submitDeck = useCallback(
    async ({
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
    }: SubmitDeckParams) => {
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

        if (file) {
          setProgress("Uploading document...");
          setProgressPercent(5);
          const fileExt = file.name.includes(".")
            ? file.name.split(".").pop()
            : "";
          const fileName = `${userId}/decks/${slug}-${Date.now()}${
            fileExt ? "." + fileExt : ""
          }`;
          const { error: uploadError } = await supabase.storage
            .from("decks")
            .upload(fileName, file);
          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("decks").getPublicUrl(fileName);
          finalFileUrl = publicUrl;

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
              links: imageAssets[idx]?.links || [],
            }));
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

          const previousValues = {
            title: existingDeck?.title,
            description: existingDeck?.description,
            pages: existingDeck?.pages || [],
            status: existingDeck?.status || "PENDING",
            file_url: existingDeck?.file_url,
            display_mode: existingDeck?.display_mode,
            file_size: existingDeck?.file_size,
            file_type: existingDeck?.file_type,
            require_email: existingDeck?.require_email,
            require_password: existingDeck?.require_password,
            view_password: existingDeck?.view_password,
            expires_at: existingDeck?.expires_at,
          };

          const { error: dbError } = await supabase
            .from("decks")
            .update({
              title,
              description,
              file_url: finalFileUrl,
              pages: finalPages,
              status: finalStatus as "PENDING" | "CONVERTING" | "PROCESSED",
              display_mode: conversionMode,
              file_size: file ? file.size : existingDeck?.file_size,
              file_type: finalFileType,
              require_email: requireEmail,
              require_password: requirePassword,
              view_password: finalViewPassword,
              expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            })
            .eq("id", editId);
          if (dbError) throw dbError;

          if (
            oldSlidePathsToDelete.length > 0 &&
            !(file && finalFileType !== "pdf" && finalConversionMode === "interactive")
          ) {
            const newUrls = new Set(finalPages.map(p => p.image_url));
            const actuallyDelete = oldSlidePathsToDelete.filter(url => !newUrls.has(url));
            await deckStorageService.deleteSlideImages(actuallyDelete);
          }

          if (file && finalFileType !== "pdf" && finalConversionMode === "interactive") {
            try {
              await triggerAndProcessConversion(editId, slug, stagingVersion);

              if (oldSlidePathsToDelete.length > 0) {
                // Not diffing here, interactive mode wipes the existing deck rendering entirely. But diffing may still be safer.
                const actuallyDelete = oldSlidePathsToDelete;
                await deckStorageService.deleteSlideImages(actuallyDelete);
              }
            } catch (conversionErr) {
              const { data: currentDeck } = await supabase
                .from("decks")
                .select("pages")
                .eq("id", editId)
                .single();

              const currentPages = (currentDeck?.pages as SlidePage[]) || [];
              const previousPages = (previousValues.pages as SlidePage[]) || [];
              const newAssetUrls = currentPages
                .filter((currentPage) =>
                  !previousPages.some(
                    (previousPage) =>
                      previousPage.image_url === currentPage.image_url,
                  )
                )
                .map((page) => page.image_url);

              if (newAssetUrls.length > 0) {
                const paths = newAssetUrls
                  .map((url) => extractStoragePath(url, "decks"))
                  .filter((path): path is string => !!path);

                if (paths.length > 0) {
                  await supabase.storage.from("decks").remove(paths).catch(
                    (err) =>
                      console.error(
                        "Storage cleanup failed during rollback:",
                        err,
                      ),
                  );
                }
              }

              if (finalFileUrl && finalFileUrl !== previousValues.file_url) {
                const newDocPath = extractStoragePath(finalFileUrl, "decks");
                if (newDocPath) {
                  await supabase.storage.from("decks").remove([newDocPath])
                    .catch(
                      (err) =>
                        console.error(
                          "Source document cleanup failed during rollback:",
                          err,
                        ),
                    );
                }
              }

              const { error: rollbackError } = await supabase
                .from("decks")
                .update({
                  title: previousValues.title,
                  description: previousValues.description,
                  pages: previousValues.pages,
                  status: previousValues.status,
                  file_url: previousValues.file_url,
                  display_mode: previousValues.display_mode,
                  file_size: previousValues.file_size,
                  file_type: previousValues.file_type,
                  require_email: previousValues.require_email,
                  require_password: previousValues.require_password,
                  view_password: previousValues.view_password,
                  expires_at: previousValues.expires_at,
                })
                .eq("id", editId);

              if (rollbackError) {
                console.error("Failed to rollback deck update:", {
                  editId,
                  rollbackError,
                  originalError: conversionErr,
                });
              }

              throw conversionErr;
            }
          }
        } else {
          setProgress("Finalizing...");
          setProgressPercent(95);

          const { data: deckRecord, error: deckError } = await supabase
            .from("decks")
            .insert([
              {
                title,
                slug,
                description,
                file_url: finalFileUrl,
                pages: finalPages,
                status: finalStatus as "PENDING" | "CONVERTING" | "PROCESSED",
                display_mode: conversionMode,
                file_size: file?.size || 0,
                file_type: fileType,
                user_id: userId,
                require_email: requireEmail,
                require_password: requirePassword,
                view_password: finalViewPassword,
                expires_at: expiresAt
                  ? new Date(expiresAt).toISOString()
                  : null,
              },
            ])
            .select()
            .single();

          if (deckError) throw deckError;

          const { error: deckLinkError } = await supabase
            .from("deck_links")
            .insert({
              deck_id: deckRecord.id,
              link_name: "Default Link",
              link_alias: slug,
              is_enabled: true,
              is_primary: true,
            });

          if (deckLinkError) {
            try {
              await deckService.deleteDeck(
                deckRecord.id,
                finalFileUrl || "",
                slug,
                userId,
              );
            } catch (cleanupErr) {
              console.error(
                "Failed to rollback deck after primary link creation failure:",
                {
                  deckId: deckRecord.id,
                  slug,
                  cleanupErr,
                },
              );
            }

            throw deckLinkError;
          }

          if (returnToRoom && deckRecord) {
            setProgress("Linking to Data Room...");
            await dataRoomService.addDocuments(returnToRoom, [deckRecord.id]);
          }

          if (
            fileType !== "pdf" &&
            conversionMode === "interactive" &&
            deckRecord
          ) {
            try {
              await triggerAndProcessConversion(deckRecord.id, slug);
            } catch (conversionErr) {
              console.error(
                "Interactive conversion failed for newly created deck:",
                {
                  deckId: deckRecord.id,
                  slug,
                  fileUrl: finalFileUrl,
                  error: conversionErr,
                },
              );

              if (finalFileUrl) {
                try {
                  const { dbDeleted, assetsDeleted, cleanupError } = await deckService.deleteDeck(
                    deckRecord.id,
                    finalFileUrl,
                    slug,
                    userId,
                  );

                  if (!dbDeleted) {
                    throw new Error("Failed to delete deck from database");
                  }

                  if (!assetsDeleted) {
                    console.warn(`Deck removed from UI but storage cleanup failed for deck [${deckRecord.id}].`, cleanupError);
                  }
                } catch (cleanupErr) {
                  console.error(
                    "Failed to rollback newly created deck after conversion failure:",
                    {
                      deckId: deckRecord.id,
                      slug,
                      fileUrl: finalFileUrl,
                      cleanupErr,
                    },
                  );
                }
              }

              throw conversionErr;
            }
          }
        }

        setProgress("Successful!");
        setProgressPercent(100);

        queryClient.invalidateQueries({
          queryKey: ["decks", session?.user?.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["user-total-stats", session?.user?.id],
        });

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
      triggerAndProcessConversion,
    ],
  );

  return {
    processPdfFile,
    triggerAndProcessConversion,
    submitDeck,
  };
}
