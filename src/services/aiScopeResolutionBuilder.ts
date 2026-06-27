export type AiScopeType = "deck" | "folder" | "data_room";

export type AiSourceExclusionReason =
  | "unsupported_file_type"
  | "missing_extractable_text";

export type AiNoContentReason =
  | "empty_scope"
  | "unsupported_files_only"
  | "missing_text_only"
  | "unsupported_or_missing_text";

export interface AiScopeReference {
  scope_type: AiScopeType;
  scope_id: string;
}

export interface AiScopeDocumentRecord {
  id: string;
  title: string;
  file_type?: string | null;
  file_url?: string | null;
  deck_id?: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
  display_order?: number | null;
  pages?: unknown[] | null;
  extracted_text?: string | null;
  text_content?: string | null;
  plain_text?: string | null;
  markdown_content?: string | null;
  transcript?: string | null;
  ocr_text?: string | null;
  [key: string]: unknown;
}

export interface AiIncludedSource {
  source_id: string;
  deck_id: string;
  title: string;
  file_type: string | null;
  folder_id: string | null;
  folder_name: string | null;
  normalized_text: string;
  text_length: number;
  pages?: Array<{ page_number: number; image_url?: string }>;
}

export interface AiExcludedSource {
  source_id: string;
  deck_id: string;
  title: string;
  file_type: string | null;
  folder_id: string | null;
  folder_name: string | null;
  reason: AiSourceExclusionReason;
}

export interface AiScopeResolutionMetadata {
  scope_type: AiScopeType;
  scope_id: string;
  scope_label: string | null;
  partial_data: boolean;
  no_content: boolean;
  no_content_reason: AiNoContentReason | null;
  total_sources: number;
  included_sources: number;
  excluded_sources: number;
  unsupported_sources: number;
  missing_text_sources: number;
}

export interface AiScopeResolution {
  scope_type: AiScopeType;
  scope_id: string;
  scope_label: string | null;
  content_hash: string | null;
  normalized_content: string;
  included_sources: AiIncludedSource[];
  excluded_sources: AiExcludedSource[];
  metadata: AiScopeResolutionMetadata;
}

export interface AiScopeDescriptor {
  scope_type: AiScopeType;
  scope_id: string;
  scope_label: string | null;
}

const SUPPORTED_FILE_TYPES = new Set([
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

const RECORD_TEXT_FIELDS = [
  "extracted_text",
  "text_content",
  "plain_text",
  "markdown_content",
  "transcript",
  "ocr_text",
] as const;

const PAGE_TEXT_FIELDS = [
  "text",
  "text_content",
  "plain_text",
  "markdown_content",
  "extracted_text",
  "transcript",
  "ocr_text",
  "speaker_notes",
] as const;

const normalizeWhitespace = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value);
  return normalized || null;
};

const getNormalizedFileType = (record: AiScopeDocumentRecord): string | null => {
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

const getPageNumber = (page: unknown, index: number): number => {
  if (!page || typeof page !== "object") return index + 1;

  const rawPageNumber = (page as { page_number?: unknown }).page_number;
  return typeof rawPageNumber === "number" && Number.isFinite(rawPageNumber)
    ? rawPageNumber
    : index + 1;
};

const getRecordLevelText = (record: AiScopeDocumentRecord): string | null => {
  for (const field of RECORD_TEXT_FIELDS) {
    const value = asNonEmptyString(record[field]);
    if (value) return value;
  }

  return null;
};

const getPageLevelText = (record: AiScopeDocumentRecord): string | null => {
  if (!Array.isArray(record.pages) || record.pages.length === 0) return null;

  const segments = record.pages
    .map((page, index) => ({
      page_number: getPageNumber(page, index),
      text:
        page && typeof page === "object"
          ? PAGE_TEXT_FIELDS.map((field) =>
              asNonEmptyString((page as Record<string, unknown>)[field]),
            ).find(Boolean) ?? null
          : null,
    }))
    .filter(
      (segment): segment is { page_number: number; text: string } =>
        Boolean(segment.text),
    )
    .sort((left, right) => left.page_number - right.page_number)
    .map((segment) => segment.text);

  if (segments.length === 0) return null;
  return normalizeWhitespace(segments.join("\n\n"));
};

const getNormalizedExtractableText = (
  record: AiScopeDocumentRecord,
): string | null => getRecordLevelText(record) ?? getPageLevelText(record);

const getScopeNoContentReason = (args: {
  totalSources: number;
  includedSources: number;
  unsupportedSources: number;
  missingTextSources: number;
}): AiNoContentReason | null => {
  const {
    totalSources,
    includedSources,
    unsupportedSources,
    missingTextSources,
  } = args;

  if (includedSources > 0) return null;
  if (totalSources === 0) return "empty_scope";
  if (unsupportedSources === totalSources) return "unsupported_files_only";
  if (missingTextSources === totalSources) return "missing_text_only";
  return "unsupported_or_missing_text";
};

export const createAiContentHash = async (
  entries: Array<{ 
    source_id: string; 
    deck_id: string; 
    normalized_text: string;
    pages?: Array<{ page_number: number; image_url?: string }>;
  }>,
): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(entries)),
  );

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const buildAiScopeResolution = async (
  descriptor: AiScopeDescriptor,
  records: AiScopeDocumentRecord[],
): Promise<AiScopeResolution> => {
  const includedSources: AiIncludedSource[] = [];
  const excludedSources: AiExcludedSource[] = [];

  for (const record of records) {
    const normalizedFileType = getNormalizedFileType(record);
    const baseSource = {
      source_id: record.id,
      deck_id: record.deck_id ?? record.id,
      title: record.title,
      file_type: normalizedFileType,
      folder_id: record.folder_id ?? null,
      folder_name: record.folder_name ?? null,
    };

    if (!normalizedFileType || !SUPPORTED_FILE_TYPES.has(normalizedFileType)) {
      excludedSources.push({
        ...baseSource,
        reason: "unsupported_file_type",
      });
      continue;
    }

    const normalizedText = getNormalizedExtractableText(record);
    if (!normalizedText) {
      excludedSources.push({
        ...baseSource,
        reason: "missing_extractable_text",
      });
      continue;
    }

    const pages = Array.isArray(record.pages) 
      ? record.pages.map((p, index) => {
          const obj = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
          return {
            page_number: typeof obj.page_number === "number" ? obj.page_number : index + 1,
            image_url: typeof obj.image_url === "string" ? obj.image_url : undefined,
          };
        }).filter(p => p.image_url) // Only include pages that have an image
      : undefined;

    includedSources.push({
      ...baseSource,
      normalized_text: normalizedText,
      text_length: normalizedText.length,
      pages: pages && pages.length > 0 ? pages : undefined,
    });
  }

  const canonicalContentEntries = includedSources
    .map((source) => ({
      source_id: source.source_id,
      deck_id: source.deck_id,
      normalized_text: source.normalized_text,
      pages: source.pages,
    }))
    .sort((left, right) => {
      if (left.deck_id !== right.deck_id) return left.deck_id.localeCompare(right.deck_id);
      return left.source_id.localeCompare(right.source_id);
    });

  const normalizedContent = canonicalContentEntries
    .map((entry) => entry.normalized_text)
    .join("\n\n")
    .trim();

  const contentHash = normalizedContent
    ? await createAiContentHash(canonicalContentEntries)
    : null;

  const unsupportedSources = excludedSources.filter(
    (source) => source.reason === "unsupported_file_type",
  ).length;
  const missingTextSources = excludedSources.filter(
    (source) => source.reason === "missing_extractable_text",
  ).length;

  return {
    scope_type: descriptor.scope_type,
    scope_id: descriptor.scope_id,
    scope_label: descriptor.scope_label,
    content_hash: contentHash,
    normalized_content: normalizedContent,
    included_sources: includedSources,
    excluded_sources: excludedSources,
    metadata: {
      scope_type: descriptor.scope_type,
      scope_id: descriptor.scope_id,
      scope_label: descriptor.scope_label,
      partial_data: includedSources.length > 0 && excludedSources.length > 0,
      no_content: includedSources.length === 0,
      no_content_reason: getScopeNoContentReason({
        totalSources: records.length,
        includedSources: includedSources.length,
        unsupportedSources,
        missingTextSources,
      }),
      total_sources: records.length,
      included_sources: includedSources.length,
      excluded_sources: excludedSources.length,
      unsupported_sources: unsupportedSources,
      missing_text_sources: missingTextSources,
    },
  };
};
