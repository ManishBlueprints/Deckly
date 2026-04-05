import { supabase } from "./supabase";
import { extractStoragePath, getRequiredDeckUserId } from "./deckService.shared";
import { withRetry } from "../utils/resilience";

/**
 * Sanitizes a deck slug for storage paths.
 */
function sanitizeStorageSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "_");
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
    const fileName = `${userId}/decks/${safeSlug}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("decks")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("decks").getPublicUrl(fileName);

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
          const { error } = await supabase.storage
            .from("decks")
            .upload(fileName, imageBlobs[index], {
              contentType: "image/webp",
              upsert: true,
            });

          if (error) throw error;

          const {
            data: { publicUrl },
          } = supabase.storage.from("decks").getPublicUrl(fileName);
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
      const { error } = await supabase.storage.from("decks").remove([storagePath]);
      if (
        error &&
        !error.message?.toLowerCase().includes("not found")
      ) {
        throw error;
      }
    });

    await withRetry(async () => {
      const safeSlug = sanitizeStorageSlug(slug);
      const listAllFilesRecursively = async (bucket: string, prefix: string): Promise<string[]> => {
        const files: string[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(prefix, { limit, offset });

          if (error) {
            if (!error.message?.toLowerCase().includes("not found")) {
              throw error;
            }
            break;
          }

          if (data && data.length > 0) {
            for (const item of data) {
              const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
              // Folders typically lack metadata, while files have it.
              if (item.metadata) {
                files.push(fullPath);
              } else {
                const nestedFiles = await listAllFilesRecursively(bucket, fullPath);
                files.push(...nestedFiles);
              }
            }
            offset += data.length;
            hasMore = data.length === limit;
          } else {
            hasMore = false;
          }
        }
        return files;
      };

      const allFilesToDelete = await listAllFilesRecursively("decks", `${userId}/deck-images/${safeSlug}`);

      if (allFilesToDelete.length > 0) {
        // supabase remove has a limit depending on the payload length, but usually accepts a lot. Let's chunk if necessary, or pass all.
        // Doing simple chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < allFilesToDelete.length; i += chunkSize) {
          const chunk = allFilesToDelete.slice(i, i + chunkSize);
          const { error: removeError } = await supabase.storage
            .from("decks")
            .remove(chunk);

          if (removeError && !removeError.message?.toLowerCase().includes("not found")) {
            throw removeError;
          }
        }
      }
    });
  },

  async deleteSlideImages(fileUrls: string[]): Promise<void> {
    const paths = fileUrls.map(url => extractStoragePath(url, "decks")).filter(Boolean) as string[];
    if (paths.length === 0) return;

    await withRetry(async () => {
      const { error } = await supabase.storage.from("decks").remove(paths);
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
