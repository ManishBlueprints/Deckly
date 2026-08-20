import { supabase } from "./supabase";

// Allows the largest supported Office upload (200 MB) to complete over a
// roughly 0.6 Mbps connection, while ensuring an unavailable R2 upload settles.
const OFFICE_SOURCE_UPLOAD_TIMEOUT_MS = 45 * 60 * 1000;

export type ProcessingJobStatus =
  | "awaiting_upload"
  | "queued"
  | "submitting"
  | "processing"
  | "validating"
  | "publishing"
  | "completed"
  | "failed"
  | "cancelled"
  | "superseded"
  | "timed_out";

export type DocumentProcessingJob = {
  id: string;
  deck_id: string;
  operation: "office_publish" | "watermark_publish";
  status: ProcessingJobStatus;
  attempt_number: number;
  deadline_at: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error_code: string | null;
};

type PreparedOfficeUpload = {
  jobId: string;
  deckId: string | null;
  sourcePath: string;
  uploadUrl: string;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("document-processing", { body });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error("Document processing returned an invalid response.");
  if (typeof (data as { error?: unknown }).error === "string") {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export const documentProcessingService = {
  prepareOfficeUpload(input: {
    replacementDeckId?: string;
    title?: string;
    slug?: string;
    description?: string;
    sourceFilename: string;
    sourceFileType: string;
    sourceSizeBytes: number;
    requireEmail: boolean;
    requirePassword: boolean;
    viewPassword: string | null;
    expiresAt: string | null;
    allowDownload: boolean;
    watermarkEnabled: boolean;
    watermarkText: string | null;
  }) {
    return invoke<PreparedOfficeUpload>({ action: "prepare-office-upload", ...input });
  },

  async uploadPreparedOfficeSource(
    uploadUrl: string,
    file: File,
    signal: AbortSignal = AbortSignal.timeout(OFFICE_SOURCE_UPLOAD_TIMEOUT_MS),
  ): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: file.type ? { "Content-Type": file.type } : undefined,
      signal,
    });
    if (!response.ok) throw new Error(`Document upload failed (${response.status}).`);
  },

  completeUpload(jobId: string) {
    return invoke<DocumentProcessingJob>({ action: "complete-upload", jobId });
  },

  getStatus(jobId: string) {
    return invoke<DocumentProcessingJob>({ action: "status", jobId });
  },

  retry(jobId: string) {
    return invoke<DocumentProcessingJob>({ action: "retry", jobId });
  },

  retryOffice(deckId: string) {
    return invoke<DocumentProcessingJob>({ action: "retry-office", deckId });
  },

  cancel(jobId: string) {
    return invoke<{ cancelled: boolean }>({ action: "cancel", jobId });
  },
};
