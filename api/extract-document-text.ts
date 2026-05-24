/// <reference types="node" />

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { extractStoragePath } from "../src/services/storagePaths.ts";
import type { AiScopeDocumentRecord, AiScopeReference } from "../src/services/aiScopeResolutionBuilder.ts";

type ExtractionResponse = {
  scope_type: AiScopeReference["scope_type"];
  scope_id: string;
  processed_documents: number;
  extracted_documents: number;
  skipped_documents: number;
};

const TEXT_EXTRACTABLE_FILE_TYPES = new Set([
  "csv",
  "doc",
  "docx",
  "md",
  "pdf",
  "ppt",
  "pptx",
  "rtf",
  "txt",
  "xls",
  "xlsx",
]);

const DIRECT_TEXT_FILE_TYPES = new Set(["csv", "md", "rtf", "txt"]);
const CONVERT_TO_PDF_FILE_TYPES = new Set([
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store, max-age=0, must-revalidate",
    },
  });

const logExtraction = (event: string, payload: Record<string, unknown>) => {
  console.info(
    JSON.stringify({
      channel: "extract_document_text",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
};

const EXTERNAL_FETCH_TIMEOUT_MS = Number(
  process.env.EXTERNAL_FETCH_TIMEOUT_MS?.trim() || "10000",
);
const INTERNAL_ERROR_MESSAGE = "An internal error occurred.";

const formatUnknownError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };

    const parts = [
      typeof candidate.message === "string" ? candidate.message : null,
      typeof candidate.details === "string" ? candidate.details : null,
      typeof candidate.hint === "string" ? candidate.hint : null,
      typeof candidate.code === "string" ? `code=${candidate.code}` : null,
      typeof candidate.error === "string" ? candidate.error : null,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown object error";
    }
  }

  return String(error);
};

const getEnv = (key: string): string =>
  process.env[key]?.trim() ?? "";

type R2Config = {
  endpoint: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  decksBucket: string;
};

const getR2EndpointUrl = (): URL => {
  const configured = getEnv("R2_S3_ENDPOINT");
  if (configured) return new URL(configured);

  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
  if (!accountId) {
    throw new Error("Missing R2_S3_ENDPOINT or CLOUDFLARE_ACCOUNT_ID.");
  }

  return new URL(`https://${accountId}.r2.cloudflarestorage.com`);
};

const getR2Config = (): R2Config => {
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY.");
  }

  return {
    endpoint: getR2EndpointUrl(),
    region: getEnv("R2_REGION") || "auto",
    accessKeyId,
    secretAccessKey,
    decksBucket: getEnv("R2_DECKS_BUCKET") || "decks",
  };
};

const encodePathSegment = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const encodeKey = (key: string): string =>
  key
    .split("/")
    .map((segment) => encodePathSegment(segment))
    .join("/");

const toHex = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sha256Hex = async (message: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return toHex(digest);
};

const hmacSha256 = async (key: CryptoKey, message: string): Promise<ArrayBuffer> => {
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return signature;
};

const deriveSigningKey = async (
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<CryptoKey> => {
  const signingKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`AWS4${secretAccessKey}`),
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
};

const formatAmzDate = (date: Date): string =>
  date.toISOString().replace(/[:-]|\.\d{3}/g, "");

const formatDateStamp = (date: Date): string =>
  date.toISOString().slice(0, 10).replace(/-/g, "");

const canonicalQueryString = (url: URL): string => {
  const pairs = Array.from(url.searchParams.entries())
    .filter(([key]) => key !== "X-Amz-Signature")
    .map(([key, value]) => [encodePathSegment(key), encodePathSegment(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) =>
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)
    );

  return pairs.map(([key, value]) => `${key}=${value}`).join("&");
};

const presignGetUrl = async (key: string): Promise<string> => {
  const config = getR2Config();
  const url = new URL(config.endpoint.toString());
  url.pathname = `/${config.decksBucket}/${encodeKey(key)}`;
  url.search = "";

  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = formatDateStamp(now);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const expiresInSeconds = 300;

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
    "GET",
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
};

const downloadDeckObject = async (storagePath: string): Promise<Uint8Array> => {
  const signedUrl = await presignGetUrl(storagePath);
  const response = await fetchWithTimeout(signedUrl);

  if (!response.ok) {
    throw new Error(`R2 download failed (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
};

const normalizeExtractedText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

const asNonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const getServiceClient = (): SupabaseClient => {
  const supabaseUrl =
    getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const serviceRoleKey =
    getEnv("PROJECT_SECRET_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE_KEY");

  logExtraction("service_client_config_checked", {
    has_supabase_url: Boolean(supabaseUrl),
    has_project_secret_key: Boolean(getEnv("PROJECT_SECRET_KEY")),
    has_service_role_key: Boolean(getEnv("SUPABASE_SERVICE_ROLE_KEY")),
  });

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service credentials.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const fetchWithTimeout = async (
  input: string | URL,
  init?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        `External request timed out after ${EXTERNAL_FETCH_TIMEOUT_MS}ms.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAuthenticatedUser = async (
  supabaseClient: SupabaseClient,
  request: Request,
): Promise<{ id: string } | null> => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);

  if (error) {
    logExtraction("auth_lookup_failed", {
      error: error.message,
    });
  }

  if (error || !user) return null;
  logExtraction("auth_lookup_succeeded", {
    user_id: user.id,
  });
  return { id: user.id };
};

const getDocumentFileType = (record: AiScopeDocumentRecord): string | null => {
  const directType = asNonEmptyString(record.file_type)?.toLowerCase();
  if (directType) return directType;

  const fileUrl = asNonEmptyString(record.file_url);
  if (!fileUrl) return null;

  const withoutQuery = fileUrl.split("?")[0] ?? fileUrl;
  const lastSegment = withoutQuery.split("/").pop() ?? withoutQuery;
  const extension = lastSegment.includes(".")
    ? lastSegment.slice(lastSegment.lastIndexOf(".") + 1)
    : "";

  return extension ? extension.toLowerCase() : null;
};

const extractPdfText = async (pdfBytes: Uint8Array): Promise<string | null> => {
  logExtraction("pdf_text_extraction_started", {
    byte_length: pdfBytes.byteLength,
  });
  const parser = new PDFParse({ data: Buffer.from(pdfBytes) });

  try {
    const result = await parser.getText();
    const normalized = normalizeExtractedText(result.text ?? "");
    logExtraction("pdf_text_extraction_completed", {
      total_pages: result.total,
      extracted_characters: normalized.length,
      has_text: Boolean(normalized),
    });
    return normalized || null;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};

const convertOfficeDocumentToPdf = async (
  fileName: string,
  fileBytes: Uint8Array,
): Promise<Uint8Array> => {
  const apiKey = getEnv("CONVERT_API_SECRET");
  if (!apiKey) {
    throw new Error("CONVERT_API_SECRET is not configured.");
  }

  const fileExt = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!fileExt) {
    throw new Error("Unable to infer file extension for conversion.");
  }

  logExtraction("office_to_pdf_conversion_started", {
    file_name: fileName,
    file_ext: fileExt,
    byte_length: fileBytes.byteLength,
  });

  const convertResponse = await fetchWithTimeout(
    `https://v2.convertapi.com/convert/${fileExt}/to/pdf`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: (() => {
        const formData = new FormData();
        formData.append("File", new Blob([Buffer.from(fileBytes)]), fileName);
        return formData;
      })(),
    },
  );

  if (!convertResponse.ok) {
    const errorText = await convertResponse.text().catch(() => "");
    throw new Error(
      `ConvertAPI request failed (${convertResponse.status}): ${errorText || "unknown error"}`,
    );
  }

  const convertResult = await convertResponse.json();
  const convertedFiles =
    convertResult && typeof convertResult === "object" && "Files" in convertResult
      ? (convertResult as { Files?: Array<Record<string, unknown>> }).Files
      : null;

  if (!convertedFiles || convertedFiles.length === 0) {
    throw new Error("ConvertAPI returned no converted PDF.");
  }

  const pdfFile = convertedFiles[0] ?? {};
  const pdfUrl =
    typeof pdfFile.Url === "string"
      ? pdfFile.Url
      : typeof pdfFile.url === "string"
      ? pdfFile.url
      : typeof pdfFile.URL === "string"
      ? pdfFile.URL
      : null;

  if (!pdfUrl) {
    throw new Error("ConvertAPI did not return a downloadable PDF URL.");
  }

  const pdfResponse = await fetchWithTimeout(pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Failed to download converted PDF (${pdfResponse.status}).`);
  }

  const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
  logExtraction("office_to_pdf_conversion_completed", {
    file_name: fileName,
    pdf_byte_length: pdfBytes.byteLength,
  });
  return pdfBytes;
};

const extractTextFromRecord = async (
  record: AiScopeDocumentRecord,
): Promise<string | null> => {
  const fileType = getDocumentFileType(record);
  if (!fileType || !TEXT_EXTRACTABLE_FILE_TYPES.has(fileType)) {
    logExtraction("record_skipped_unsupported_type", {
      deck_id: String(record.deck_id ?? record.id),
      file_type: fileType,
    });
    return null;
  }

  const fileUrl = asNonEmptyString(record.file_url);
  if (!fileUrl) return null;

  const storagePath = extractStoragePath(fileUrl, "decks");
  if (!storagePath) {
    logExtraction("record_skipped_missing_storage_path", {
      deck_id: String(record.deck_id ?? record.id),
      file_type: fileType,
      has_file_url: Boolean(fileUrl),
    });
    return null;
  }

  logExtraction("record_extraction_started", {
    deck_id: String(record.deck_id ?? record.id),
    file_type: fileType,
    storage_path: storagePath,
  });

  let fileBytes: Uint8Array;
  try {
    fileBytes = await downloadDeckObject(storagePath);
  } catch (error) {
    logExtraction("record_download_failed", {
      deck_id: String(record.deck_id ?? record.id),
      storage_path: storagePath,
      error: formatUnknownError(error),
    });
    throw error;
  }

  if (fileType === "pdf") {
    return extractPdfText(fileBytes);
  }

  if (DIRECT_TEXT_FILE_TYPES.has(fileType)) {
    const directText = normalizeExtractedText(Buffer.from(fileBytes).toString("utf8"));
    logExtraction("direct_text_extraction_completed", {
      deck_id: String(record.deck_id ?? record.id),
      file_type: fileType,
      extracted_characters: directText.length,
      has_text: Boolean(directText),
    });
    return directText || null;
  }

  if (CONVERT_TO_PDF_FILE_TYPES.has(fileType)) {
    const fileName = storagePath.split("/").pop() ?? `document.${fileType}`;
    const pdfBytes = await convertOfficeDocumentToPdf(fileName, fileBytes);
    return extractPdfText(pdfBytes);
  }

  return null;
};

const persistDeckExtractedText = async (
  supabaseClient: SupabaseClient,
  deckId: string,
  extractedText: string,
) => {
  logExtraction("persist_extracted_text_started", {
    deck_id: deckId,
    extracted_characters: extractedText.length,
  });
  const { error } = await supabaseClient
    .from("decks")
    .update({
      extracted_text: extractedText,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deckId);

  if (error) throw error;
  logExtraction("persist_extracted_text_completed", {
    deck_id: deckId,
  });
};

const getRoomDocuments = async (
  supabaseClient: SupabaseClient,
  roomId: string,
): Promise<AiScopeDocumentRecord[]> => {
  const { data, error } = await supabaseClient
    .from("data_room_documents")
    .select(`
      id,
      deck_id,
      folder_id,
      display_order,
      deck:decks (*)
    `)
    .eq("data_room_id", roomId)
    .order("display_order", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).flatMap((row) => {
    const rawDeck = row.deck;
    const deck =
      rawDeck && typeof rawDeck === "object" && !Array.isArray(rawDeck)
        ? (rawDeck as Record<string, unknown>)
        : null;

    if (!deck) return [];

    return [
      {
        ...(deck as AiScopeDocumentRecord),
        id: String(row.id),
        deck_id: String(row.deck_id ?? deck.id ?? row.id),
        title: String(deck.title ?? "Untitled"),
        folder_id:
          row.folder_id === null || row.folder_id === undefined
            ? null
            : String(row.folder_id),
        display_order: typeof row.display_order === "number" ? row.display_order : null,
      },
    ];
  });
};

const resolveRecordsForScope = async (
  supabaseClient: SupabaseClient,
  reference: AiScopeReference,
  userId: string | null,
): Promise<AiScopeDocumentRecord[]> => {
  logExtraction("resolve_scope_records_started", {
    scope_type: reference.scope_type,
    scope_id: reference.scope_id,
    auth_state: userId ? "signed_in" : "guest",
  });
  if (reference.scope_type === "deck") {
    let query = supabaseClient
      .from("decks")
      .select("*")
      .eq("id", reference.scope_id);

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error(userId ? "Deck scope not found." : "Public deck scope not found.");
    }

    logExtraction("resolve_scope_records_completed", {
      scope_type: reference.scope_type,
      scope_id: reference.scope_id,
      record_count: 1,
    });

    return [
      {
        ...(data as AiScopeDocumentRecord),
        deck_id: String((data as AiScopeDocumentRecord).deck_id ?? (data as AiScopeDocumentRecord).id),
        title: String((data as AiScopeDocumentRecord).title ?? "Untitled"),
      },
    ];
  }

  if (!userId) {
    throw new Error("Authentication required for this scope.");
  }

  if (reference.scope_type === "folder") {
    const { data, error } = await supabaseClient
      .from("data_room_folders")
      .select("id, data_room_id, data_rooms!inner(user_id)")
      .eq("id", reference.scope_id)
      .eq("data_rooms.user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Folder scope not found.");

    const folderId = String(data.id);
    const roomId = String(data.data_room_id);
    const roomDocuments = await getRoomDocuments(supabaseClient, roomId);
    const folderDocuments = roomDocuments.filter((document) => document.folder_id === folderId);
    logExtraction("resolve_scope_records_completed", {
      scope_type: reference.scope_type,
      scope_id: reference.scope_id,
      record_count: folderDocuments.length,
      room_id: roomId,
    });
    return folderDocuments;
  }

  const { data, error } = await supabaseClient
    .from("data_rooms")
    .select("id")
    .eq("id", reference.scope_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Data room scope not found.");

  const roomDocuments = await getRoomDocuments(supabaseClient, String(data.id));
  logExtraction("resolve_scope_records_completed", {
    scope_type: reference.scope_type,
    scope_id: reference.scope_id,
    record_count: roomDocuments.length,
  });
  return roomDocuments;
};

const extractScopeDocuments = async (
  supabaseClient: SupabaseClient,
  reference: AiScopeReference,
  userId: string | null,
): Promise<ExtractionResponse> => {
  const records = await resolveRecordsForScope(supabaseClient, reference, userId);
  let extractedDocuments = 0;
  let skippedDocuments = 0;
  const processedDeckIds = new Set<string>();

  logExtraction("scope_extraction_started", {
    scope_type: reference.scope_type,
    scope_id: reference.scope_id,
    record_count: records.length,
  });

  for (const record of records) {
    const deckId = String(record.deck_id ?? record.id);
    if (processedDeckIds.has(deckId)) continue;
    processedDeckIds.add(deckId);

    if (asNonEmptyString(record.extracted_text)) {
      logExtraction("record_skipped_existing_text", {
        deck_id: deckId,
      });
      skippedDocuments += 1;
      continue;
    }

    const extractedText = await extractTextFromRecord(record);
    if (!extractedText) {
      logExtraction("record_skipped_no_text_extracted", {
        deck_id: deckId,
        file_type: getDocumentFileType(record),
      });
      skippedDocuments += 1;
      continue;
    }

    await persistDeckExtractedText(supabaseClient, deckId, extractedText);
    extractedDocuments += 1;
  }

  const result = {
    scope_type: reference.scope_type,
    scope_id: reference.scope_id,
    processed_documents: processedDeckIds.size,
    extracted_documents: extractedDocuments,
    skipped_documents: skippedDocuments,
  };

  logExtraction("scope_extraction_completed", result);
  return result;
};

export default async function handler(request: Request) {
  logExtraction("request_received", {
    method: request.method,
  });
  if (request.method !== "POST") {
    return json({ error: true, message: "Method not allowed." }, 405);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const scopeType =
      typeof body.scope_type === "string" ? body.scope_type : null;
    const scopeId =
      typeof body.scope_id === "string" ? body.scope_id : null;

    if (!scopeType || !scopeId || !["deck", "folder", "data_room"].includes(scopeType)) {
      logExtraction("request_invalid", {
        scope_type: scopeType,
        scope_id: scopeId,
      });
      return json(
        { error: true, message: "scope_type and scope_id are required." },
        400,
      );
    }

    const supabaseClient = getServiceClient();
    const authenticatedUser = await getAuthenticatedUser(supabaseClient, request);

    if (!authenticatedUser && scopeType !== "deck") {
      logExtraction("request_forbidden_guest_scope", {
        scope_type: scopeType,
        scope_id: scopeId,
      });
      return json(
        { error: true, message: "Authentication required for folder and data room extraction." },
        401,
      );
    }

    const result = await extractScopeDocuments(
      supabaseClient,
      {
        scope_type: scopeType as AiScopeReference["scope_type"],
        scope_id: scopeId,
      },
      authenticatedUser?.id ?? null,
    );

    return json(result);
  } catch (error) {
    const formattedError = formatUnknownError(error);
    logExtraction("request_failed", {
      error: formattedError,
      stack: error instanceof Error ? error.stack ?? null : null,
    });
    const isDevelopment = process.env.NODE_ENV !== "production";
    return json(
      {
        error: true,
        message: isDevelopment ? formattedError : INTERNAL_ERROR_MESSAGE,
      },
      500,
    );
  }
}
