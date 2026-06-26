import { supabase } from "./supabase.ts";

export type StorageBucket = "decks" | "assets";

type StorageServiceResponse<T> = {
  data: T | null;
  error: Error | null;
};

type StorageListItem = {
  name: string;
  updated_at: string | null;
  created_at: string | null;
  metadata: { size?: number } | null;
};

type StorageListPage = {
  items: StorageListItem[];
  nextToken: string | null;
};

type ImportMetaEnvShape = {
  VITE_R2_PUBLIC_ASSET_BASE_URL?: string;
  VITE_R2_PRIVATE_GATEWAY_BASE_URL?: string;
};

const viteEnv = (import.meta as ImportMeta & { env?: ImportMetaEnvShape }).env;
const STORAGE_FUNCTION_NAME = "r2-storage";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const sanitizeStorageKey = (key: string): string => {
  return key
    .split("/")
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
};

async function callStorageFunction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(STORAGE_FUNCTION_NAME, { body });

  if (error) {
    throw error;
  }

  return data as T;
}

export const storageService = {
  async upload(
    bucket: StorageBucket,
    key: string,
    body: File | Blob | ArrayBuffer | Uint8Array,
    options?: { contentType?: string; upsert?: boolean },
  ): Promise<StorageServiceResponse<{ path: string; publicUrl: string }>> {
    try {
      const { uploadUrl, publicUrl } = await callStorageFunction<{ uploadUrl: string; publicUrl: string }>({
        action: "presign-upload",
        bucket,
        key,
        contentType: options?.contentType,
        upsert: options?.upsert ?? false,
      });

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: body as BodyInit,
        headers: options?.contentType ? { "Content-Type": options.contentType } : undefined,
      });

      if (!response.ok) {
        throw new Error(`R2 upload failed (${response.status})`);
      }

      return { data: { path: key, publicUrl }, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  getPublicUrl(bucket: StorageBucket, key: string): string {
    const safeKey = sanitizeStorageKey(key);

    if (bucket === "assets") {
      const baseUrl = viteEnv?.VITE_R2_PUBLIC_ASSET_BASE_URL;
      return baseUrl ? `${stripTrailingSlash(baseUrl)}/${safeKey}` : safeKey;
    }

    return safeKey;
  },

  async remove(
    bucket: StorageBucket,
    keys: string[],
  ): Promise<StorageServiceResponse<{ success: boolean }>> {
    try {
      const data = await callStorageFunction<{ success: boolean }>({
        action: "remove",
        bucket,
        keys,
      });

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  async list(
    bucket: StorageBucket,
    prefix: string,
    options?: { limit?: number; continuationToken?: string | null },
  ): Promise<StorageServiceResponse<StorageListPage>> {
    try {
      const response = await callStorageFunction<{ data: StorageListItem[]; nextToken?: string | null }>({
        action: "list",
        bucket,
        prefix,
        limit: options?.limit,
        continuationToken: options?.continuationToken ?? null,
      });

      return {
        data: {
          items: response.data ?? [],
          nextToken: response.nextToken ?? null,
        },
        error: null,
      };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },

  async createSignedUrls(
    bucket: StorageBucket,
    paths: string[],
    expiresInSeconds: number,
  ): Promise<StorageServiceResponse<Array<{ path: string; signedUrl: string | null }>>> {
    try {
      const response = await callStorageFunction<{ data: Array<{ path: string; signedUrl: string | null }> }>({
        action: "create-signed-urls",
        bucket,
        paths,
        expiresInSeconds,
      });

      return { data: response.data ?? [], error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};
