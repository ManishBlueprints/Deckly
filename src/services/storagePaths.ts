export type StorageBucket = "decks" | "assets";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const isUrl = (value: string): boolean => /^https?:\/\//i.test(value);

type RuntimeEnv = {
  env?: Record<string, string | undefined>;
};

const viteEnv = (import.meta as ImportMeta & RuntimeEnv).env;
const denoEnv = (globalThis as typeof globalThis & { Deno?: { env?: { get: (key: string) => string | undefined } } }).Deno?.env ?? null;

function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = viteEnv?.[key] ?? denoEnv?.get(key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getConfiguredBaseUrls(bucket: StorageBucket): string[] {
  if (bucket === "assets") {
    return [
      readEnv("VITE_R2_PUBLIC_ASSET_BASE_URL", "R2_PUBLIC_ASSET_BASE_URL"),
    ].filter((value): value is string => Boolean(value));
  }

  return [
    readEnv("VITE_R2_PRIVATE_GATEWAY_BASE_URL", "R2_PRIVATE_GATEWAY_BASE_URL"),
  ].filter((value): value is string => Boolean(value));
}

export function isStorageKey(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && !isUrl(value.trim());
}

export function extractStoragePath(
  storedValue: string,
  bucket: StorageBucket,
  options: { publicBaseUrls?: string[] } = {},
): string | null {
  const normalized = storedValue.trim();
  if (!normalized) return null;

  if (!isUrl(normalized)) {
    return normalized;
  }

  let normalizedUrl: URL;
  try {
    normalizedUrl = new URL(normalized);
  } catch {
    return null;
  }

  const supabasePattern = new RegExp(
    `/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?#]+)`,
    "i",
  );
  const match = normalized.match(supabasePattern);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  // R2's S3 endpoint uses the bucket as the first pathname segment. Stored
  // values may be a short-lived R2 URL, but callers must always sign the
  // underlying object key rather than the URL itself.
  if (/\.r2\.cloudflarestorage\.com$/i.test(normalizedUrl.hostname)) {
    const bucketPrefix = `/${bucket}/`;
    if (normalizedUrl.pathname.startsWith(bucketPrefix)) {
      const path = normalizedUrl.pathname.slice(bucketPrefix.length);
      return path ? decodeURIComponent(path) : null;
    }
  }

  const publicBaseUrls = options.publicBaseUrls
    ?.map((baseUrl) => baseUrl.trim())
    .filter(Boolean)
    .map(stripTrailingSlash) ?? [];

  for (const baseUrl of [...publicBaseUrls, ...getConfiguredBaseUrls(bucket)]) {
    let baseUrlObject: URL;
    try {
      baseUrlObject = new URL(baseUrl);
    } catch {
      continue;
    }

    if (normalizedUrl.origin !== baseUrlObject.origin) continue;

    const basePathname = stripTrailingSlash(baseUrlObject.pathname);
    const pathname = normalizedUrl.pathname;
    const hasMatchingPathPrefix = basePathname
      ? pathname === basePathname || pathname.startsWith(`${basePathname}/`)
      : true;

    if (!hasMatchingPathPrefix) continue;

    const path = pathname
      .slice(basePathname.length)
      .replace(/^\/+/, "");
    return path ? decodeURIComponent(path) : null;
  }

  return null;
}
