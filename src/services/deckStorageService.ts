import { supabase } from "./supabase";
import { getDeckPublicStoragePath, getRequiredDeckUserId } from "./deckService.shared";
import { withRetry } from "../utils/resilience";

export const deckStorageService = {
  async uploadDeckFile(
    file: File,
    slug: string,
    providedUserId?: string,
  ): Promise<{ userId: string; publicUrl: string; fileName: string }> {
    const userId = await getRequiredDeckUserId(providedUserId);
    const fileExt = file.name.split(".").pop();
    const fileName = `${userId}/decks/${slug}-${Date.now()}.${fileExt}`;

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
  ): Promise<string[]> {
    const imageUrls: string[] = new Array(imageBlobs.length);
    const timestamp = Date.now();
    const concurrencyLimit = 3;

    const uploadSingle = async (index: number) => {
      const fileName = `${userId}/deck-images/${deckSlug}/page-${
        index + 1
      }-${timestamp}.webp`;

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

          if (onProgress) {
            onProgress(imageUrls.filter(Boolean).length, imageBlobs.length);
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

  async deleteDeckAssets(fileUrl: string, slug: string, providedUserId?: string) {
    const userId = await getRequiredDeckUserId(providedUserId);
    const storagePath = getDeckPublicStoragePath(fileUrl);

    if (!storagePath) {
      console.warn(
        `[deckStorageService.deleteDeckAssets] Unexpected fileUrl format; aborting delete. fileUrl: ${fileUrl}`,
      );
      return false;
    }

    await withRetry(async () => {
      const { error } = await supabase.storage.from("decks").remove([storagePath]);
      if (
        error &&
        !error.message?.includes("not found") &&
        error.message !== "Object not found"
      ) {
        throw error;
      }
    });

    await withRetry(async () => {
      const { data: files, error: listError } = await supabase.storage
        .from("decks")
        .list(`${userId}/deck-images/${slug}`);

      if (listError && !listError.message?.includes("not found")) {
        throw listError;
      }

      if (files && files.length > 0) {
        const filesToDelete = files.map(
          (file) => `${userId}/deck-images/${slug}/${file.name}`,
        );
        const { error: removeError } = await supabase.storage
          .from("decks")
          .remove(filesToDelete);

        if (removeError && !removeError.message?.includes("not found")) {
          throw removeError;
        }
      }
    });

    return true;
  },

  async getStoragePath(slug: string, filename: string): Promise<string> {
    const userId = await getRequiredDeckUserId();
    return `${userId}/${slug}/${filename}`;
  },
};
