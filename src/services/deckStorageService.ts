import { extractStoragePath, getRequiredDeckUserId } from "./deckService.shared.ts";
import { withRetry } from "../utils/resilience.ts";
import { storageService } from "./storageService.ts";

/**
 * Sanitizes a deck slug for storage paths.
 */
function sanitizeStorageSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "_");
}

async function deleteAssetsUnderPrefix(prefix: string): Promise<void> {
  await withRetry(async () => {
    const allFilesToDelete: string[] = [];
    let continuationToken: string | null = null;

    while (true) {
      const { data, error } = await storageService.list(
        "decks",
        prefix,
        { continuationToken },
      );

      if (error) {
        if (!error.message?.toLowerCase().includes("not found")) {
          throw error;
        }
        return;
      }

      allFilesToDelete.push(
        ...((data?.items || [])
          .map((item) => item.name)
          .filter((name) => name.startsWith(prefix))),
      );

      continuationToken = data?.nextToken ?? null;
      if (!continuationToken) break;
    }

    for (let i = 0; i < allFilesToDelete.length; i += 100) {
      const { error } = await storageService.remove("decks", allFilesToDelete.slice(i, i + 100));
      if (error && !error.message?.toLowerCase().includes("not found")) {
        throw error;
      }
    }
  });
}

export const deckStorageService = {
  async uploadDeckFile(
    file: File,
    slug: string,
    providedUserId?: string,
  ): Promise<{ userId: string; publicUrl: string; fileName: string }> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const fileExt = file.name.includes(".") 
      ? file.name.split(".").pop()?.toLowerCase() || "bin"
      : "bin";
    const safeSlug = sanitizeStorageSlug(slug);
    const fileName = `${userId}/uploads/decks/${safeSlug}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await storageService.upload("decks", fileName, file);

    if (uploadError) throw uploadError;

    const publicUrl = storageService.getPublicUrl("decks", fileName);

    return { userId, publicUrl, fileName };
  },

  async uploadSlideImages(
    userId: string,
    deckSlug: string,
    imageBlobs: Blob[],
    onProgress?: (current: number, total: number) => void,
    version?: string,
  ): Promise<string[]> {
    const imageUrls: string[] = new Array(imageBlobs.length);
    const concurrencyLimit = 3;
    let uploadedCount = 0;

    const uploadSingle = async (index: number) => {
      const safeSlug = sanitizeStorageSlug(deckSlug);
      const fileName = version 
        ? `${userId}/deck-images/${safeSlug}/staging/${version}/page-${index + 1}.webp` 
        : `${userId}/deck-images/${safeSlug}/page-${index + 1}.webp`;


      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const { error } = await storageService.upload("decks", fileName, imageBlobs[index], {
            contentType: "image/webp",
            upsert: true,
          });

          if (error) throw error;

          const publicUrl = storageService.getPublicUrl("decks", fileName);
          imageUrls[index] = publicUrl;
          uploadedCount++;

          if (onProgress) {
            onProgress(uploadedCount, imageBlobs.length);
          }
          return;
        } catch (err) {
          attempts++;
          if (attempts === maxAttempts) throw err;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        }
      }
    };

    for (let i = 0; i < imageBlobs.length; i += concurrencyLimit) {
      const chunk = imageBlobs.slice(i, i + concurrencyLimit).map((_, idx) =>
        uploadSingle(i + idx)
      );
      await Promise.all(chunk);
    }

    return imageUrls;
  },

  async deleteDeckAssets(fileUrl: string, slug: string, providedUserId?: string): Promise<void> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const storagePath = extractStoragePath(fileUrl, "decks");

    if (!storagePath) {
      throw new Error(
        `[deckStorageService.deleteDeckAssets] Unexpected fileUrl format; aborting delete. fileUrl: ${fileUrl}`,
      );
    }

    await withRetry(async () => {
      const { error } = await storageService.remove("decks", [storagePath]);
      if (
        error &&
        !error.message?.toLowerCase().includes("not found")
      ) {
        throw error;
      }
    });

    const safeSlug = sanitizeStorageSlug(slug);
    await deleteAssetsUnderPrefix(`${userId}/deck-images/${safeSlug}/`);
  },

  async deleteDeckWatermarkAssets(deckId: string, providedUserId?: string): Promise<void> {
    const userId = await getRequiredDeckUserId(providedUserId);
    await deleteAssetsUnderPrefix(`${userId}/watermarks/${deckId}/`);
  },

  async deleteDeckRevisionAssets(deckId: string, providedUserId?: string): Promise<void> {
    const userId = await getRequiredDeckUserId(providedUserId);
    await deleteAssetsUnderPrefix(`${userId}/decks/${deckId}/`);
  },

  async deleteSlideImages(fileUrls: string[]): Promise<void> {
    const paths = fileUrls.map(url => extractStoragePath(url, "decks")).filter(Boolean) as string[];
    if (paths.length === 0) return;

    await withRetry(async () => {
      const { error } = await storageService.remove("decks", paths);
      if (error && !error.message?.toLowerCase().includes("not found")) {
        throw error;
      }
    });
  },

  /**
   * Returns a bucket path for slide-level storage assets.
   */
  async getStoragePath(
    slug: string,
    filename: string,
    providedUserId?: string,
  ): Promise<string> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const safeSlug = sanitizeStorageSlug(slug);
    return `${userId}/deck-images/${safeSlug}/${filename}`;
  },
};
