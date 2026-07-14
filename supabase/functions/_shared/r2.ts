export type StorageBucket = "decks" | "assets";

type R2Config = {
  endpoint: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  decksBucket: string;
  assetsBucket: string;
  publicAssetBaseUrl: string | null;
  privateGatewayBaseUrl: string | null;
};

type ListObjectsPage = {
  items: StorageListItem[];
  isTruncated: boolean;
  nextContinuationToken: string | null;
};

export type StorageListItem = {
  name: string;
  updated_at: string | null;
  created_at: string | null;
  metadata: { size?: number } | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getEnv(key: string): string | undefined {
  return Deno.env.get(key)?.trim() || undefined;
}

function getEndpointUrl(): URL {
  const configured = getEnv("R2_S3_ENDPOINT");
  if (configured) return new URL(configured);

  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
  if (!accountId) {
    throw new Error("Missing R2_S3_ENDPOINT or CLOUDFLARE_ACCOUNT_ID");
  }

  return new URL(`https://${accountId}.r2.cloudflarestorage.com`);
}

export function getR2Config(): R2Config {
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY");
  }

  return {
    endpoint: getEndpointUrl(),
    region: getEnv("R2_REGION") ?? "auto",
    accessKeyId,
    secretAccessKey,
    decksBucket: getEnv("R2_DECKS_BUCKET") ?? "decks",
    assetsBucket: getEnv("R2_ASSETS_BUCKET") ?? "assets",
    publicAssetBaseUrl: getEnv("R2_PUBLIC_ASSET_BASE_URL") ?? null,
    privateGatewayBaseUrl: getEnv("R2_PRIVATE_GATEWAY_BASE_URL") ?? null,
  };
}

function storageBucketName(config: R2Config, bucket: StorageBucket): string {
  return bucket === "decks" ? config.decksBucket : config.assetsBucket;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((segment) => encodePathSegment(segment))
    .join("/");
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(message));
  return toHex(digest);
}

async function hmacSha256(key: CryptoKey, message: string): Promise<ArrayBuffer> {
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return signature;
}

async function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<CryptoKey> {
  const signingKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`AWS4${secretAccessKey}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const dateKeyBytes = await hmacSha256(signingKey, dateStamp);
  const dateKey = await crypto.subtle.importKey(
    "raw",
    dateKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const regionKeyBytes = await hmacSha256(dateKey, region);
  const regionKey = await crypto.subtle.importKey(
    "raw",
    regionKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const serviceKeyBytes = await hmacSha256(regionKey, service);
  const serviceKey = await crypto.subtle.importKey(
    "raw",
    serviceKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signingKeyBytes = await hmacSha256(serviceKey, "aws4_request");
  return crypto.subtle.importKey(
    "raw",
    signingKeyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function formatAmzDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function canonicalQueryString(url: URL): string {
  const pairs = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== "X-Amz-Signature")
    .map(([key, value]) => [encodePathSegment(key), encodePathSegment(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => {
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });

  return pairs.map(([key, value]) => `${key}=${value}`).join("&");
}

async function presignUrl(
  method: string,
  bucket: StorageBucket,
  key: string,
  options: {
    expiresInSeconds?: number;
    query?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<string> {
  const config = getR2Config();
  const bucketName = storageBucketName(config, bucket);
  const url = new URL(config.endpoint.toString());
  const encodedKey = key ? `/${encodeKey(key)}` : "";
  url.pathname = `/${bucketName}${encodedKey}`;
  url.search = "";

  if (options.query) {
    for (const [queryKey, queryValue] of Object.entries(options.query)) {
      if (queryValue === undefined || queryValue === null) continue;
      url.searchParams.set(queryKey, String(queryValue));
    }
  }

  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = formatDateStamp(now);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const expiresInSeconds = Math.min(Math.max(options.expiresInSeconds ?? 900, 1), 604800);

  url.searchParams.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  url.searchParams.set("X-Amz-Credential", `${config.accessKeyId}/${credentialScope}`);
  url.searchParams.set("X-Amz-Date", amzDate);
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  url.searchParams.set("X-Amz-SignedHeaders", "host");

  const canonicalUri = url.pathname
    .split("/")
    .map((segment) => encodePathSegment(decodeURIComponent(segment)))
    .join("/")
    .replace(/%2F/g, "/");
  const canonicalHeaders = `host:${url.host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString(url),
    canonicalHeaders,
    "host",
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    config.secretAccessKey,
    dateStamp,
    config.region,
    "s3",
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  url.searchParams.set("X-Amz-Signature", signature);
  return url.toString();
}

export function buildStoragePublicUrl(bucket: StorageBucket, key: string): string {
  const config = getR2Config();
  const baseUrl = bucket === "assets"
    ? config.publicAssetBaseUrl
    : null;

  if (!baseUrl) {
    return key;
  }

  return `${stripTrailingSlash(baseUrl)}/${key}`;
}

export function presignGetUrl(
  bucket: StorageBucket,
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return presignUrl("GET", bucket, key, { expiresInSeconds });
}

export function presignDownloadUrl(
  bucket: StorageBucket,
  key: string,
  filename: string,
  expiresInSeconds = 60,
): Promise<string> {
  return presignUrl("GET", bucket, key, {
    expiresInSeconds,
    query: {
      "response-content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function presignPutUrl(
  bucket: StorageBucket,
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  return presignUrl("PUT", bucket, key, { expiresInSeconds });
}

export function presignDeleteUrl(
  bucket: StorageBucket,
  key: string,
  expiresInSeconds = 900,
): Promise<string> {
  return presignUrl("DELETE", bucket, key, { expiresInSeconds });
}

export async function uploadObject(
  bucket: StorageBucket,
  key: string,
  body: BodyInit,
  options: { contentType?: string; expiresInSeconds?: number } = {},
): Promise<void> {
  const signedUrl = await presignPutUrl(bucket, key, options.expiresInSeconds);
  const response = await fetch(signedUrl, {
    method: "PUT",
    body,
    headers: options.contentType ? { "Content-Type": options.contentType } : undefined,
  });

  if (!response.ok) {
    throw new Error(`R2 upload failed (${response.status})`);
  }
}

export async function downloadObject(
  bucket: StorageBucket,
  key: string,
): Promise<ArrayBuffer> {
  const signedUrl = await presignGetUrl(bucket, key);
  const response = await fetch(signedUrl);

  if (!response.ok) {
    throw new Error(`R2 download failed (${response.status})`);
  }

  return response.arrayBuffer();
}

export async function deleteObject(
  bucket: StorageBucket,
  key: string,
): Promise<void> {
  const signedUrl = await presignDeleteUrl(bucket, key);
  const response = await fetch(signedUrl, { method: "DELETE" });

  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`R2 delete failed (${response.status})`);
  }
}

export async function deleteObjects(
  bucket: StorageBucket,
  keys: string[],
): Promise<void> {
  for (const key of keys) {
    await deleteObject(bucket, key);
  }
}

function parseListObjectsXml(xml: string): ListObjectsPage {
  const isTruncatedMatch = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/i);
  const isTruncated = isTruncatedMatch ? isTruncatedMatch[1].toLowerCase() === "true" : false;

  const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/i);
  const nextContinuationToken = tokenMatch ? tokenMatch[1] : null;

  const items: StorageListItem[] = [];
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g;
  let match;

  while ((match = contentsRegex.exec(xml)) !== null) {
    const contentBody = match[1];
    const keyMatch = contentBody.match(/<Key>([^<]+)<\/Key>/i);
    const key = keyMatch ? keyMatch[1] : "";

    if (key) {
      const lastModifiedMatch = contentBody.match(/<LastModified>([^<]+)<\/LastModified>/i);
      const lastModified = lastModifiedMatch ? lastModifiedMatch[1] : null;

      const sizeMatch = contentBody.match(/<Size>(\d+)<\/Size>/i);
      const sizeText = sizeMatch ? sizeMatch[1] : "";
      const size = sizeText ? Number(sizeText) : undefined;

      items.push({
        name: key,
        updated_at: lastModified,
        created_at: lastModified,
        metadata: typeof size === "number" && Number.isFinite(size) ? { size } : null,
      });
    }
  }

  return { items, isTruncated, nextContinuationToken };
}

export async function listObjects(
  bucket: StorageBucket,
  prefix: string,
  options: { limit?: number; offset?: number; continuationToken?: string | null } = {},
): Promise<ListObjectsPage> {
  const params: Record<string, string | number | undefined> = {
    "list-type": 2,
    prefix,
    "max-keys": options.limit ?? 1000,
  };

  if (options.continuationToken) {
    params["continuation-token"] = options.continuationToken;
  }

  const signedUrl = await presignUrl("GET", bucket, "", { query: params, expiresInSeconds: 60 });
  const response = await fetch(signedUrl);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[r2.ts] R2 list failed (${response.status}):`, text);
    throw new Error(`R2 list failed (${response.status})`);
  }

  const xml = decoder.decode(await response.arrayBuffer());
  return parseListObjectsXml(xml);
}

export async function listAllObjects(
  bucket: StorageBucket,
  prefix: string,
): Promise<StorageListItem[]> {
  const items: StorageListItem[] = [];
  let continuationToken: string | null = null;

  while (true) {
    const page = await listObjects(bucket, prefix, {
      limit: 1000,
      continuationToken,
    });

    items.push(...page.items);
    if (!page.isTruncated || !page.nextContinuationToken) {
      break;
    }

    continuationToken = page.nextContinuationToken;
  }

  return items;
}

export async function createSignedUrls(
  bucket: StorageBucket,
  keys: string[],
  expiresInSeconds: number,
): Promise<Array<{ path: string; signedUrl: string | null }>> {
  const results: Array<{ path: string; signedUrl: string | null }> = [];

  for (const key of keys) {
    try {
      results.push({ path: key, signedUrl: await presignGetUrl(bucket, key, expiresInSeconds) });
    } catch {
      results.push({ path: key, signedUrl: null });
    }
  }

  return results;
}
