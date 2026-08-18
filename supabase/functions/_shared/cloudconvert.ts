/**
 * Small, server-only CloudConvert client.  This module deliberately owns the
 * provider-specific task graph so browser code never handles provider URLs,
 * credentials or task identifiers.
 */

export const CLOUDCONVERT_MAX_JOB_SECONDS = 60 * 60;
export const CLOUDCONVERT_IO_URL_TTL_SECONDS = CLOUDCONVERT_MAX_JOB_SECONDS + (15 * 60);
const CLOUDCONVERT_REQUEST_TIMEOUT_MS = 30_000;

type CloudConvertTask = {
  id: string;
  name: string;
  operation: string;
  status: string;
  engine?: string;
  engine_version?: string;
  credits?: number;
  result?: Record<string, unknown>;
  message?: string;
  code?: string;
};

export type CloudConvertJob = {
  id: string;
  tag?: string;
  status: string;
  tasks: CloudConvertTask[];
  created_at?: string;
  ended_at?: string;
};

export type CloudConvertWatermark = {
  text: string;
  outputUrl: string;
};

export type CloudConvertOfficeJobInput = {
  tag: string;
  sourceUrl: string;
  sourceFilename: string;
  sourceFormat: "doc" | "docx" | "ppt" | "pptx" | "xls" | "xlsx";
  outputPdfUrl: string;
  outputThumbnailUrl: string;
  watermark?: CloudConvertWatermark;
};

export type CloudConvertWatermarkJobInput = {
  tag: string;
  sourceUrl: string;
  outputUrl: string;
  text: string;
};

type CloudConvertApiResponse<T> = { data: T };

export class CloudConvertError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "CloudConvertError";
  }
}

function getApiBaseUrl(): string {
  // Sandbox is opt-in and only intended for the CloudConvert allow-listed
  // fixture suite. Production processing is intentionally pinned to EU.
  if (Deno.env.get("CLOUDCONVERT_ENV") === "sandbox") {
    return "https://sandbox.api.cloudconvert.com/v2";
  }
  return "https://eu-central.api.cloudconvert.com/v2";
}

function getApiToken(): string {
  const token = Deno.env.get("CLOUDCONVERT_API_TOKEN")?.trim();
  if (!token) throw new Error("Missing CLOUDCONVERT_API_TOKEN");
  return token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLOUDCONVERT_REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiToken()}`,
        Accept: "application/json",
        ...init.headers,
      },
    });

    const payload = await response.json().catch(() => null) as
      | { message?: unknown; code?: unknown }
      | null;
    if (!response.ok) {
      const message = typeof payload?.message === "string"
        ? payload.message
        : `CloudConvert request failed (${response.status})`;
      throw new CloudConvertError(
        message,
        response.status,
        typeof payload?.code === "string" ? payload.code : null,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (!payload || !("data" in payload)) {
      throw new CloudConvertError("CloudConvert returned an invalid response.", response.status);
    }
    return (payload as CloudConvertApiResponse<T>).data;
  } catch (error) {
    if (timedOut) {
      throw new CloudConvertError("CloudConvert request timed out.", 504, "request_timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function watermarkTask(input: string, text: string): Record<string, unknown> {
  // Keep provider units rather than calling this "px".  These options must be
  // visually verified against the selected CloudConvert watermark engine before
  // enabling production billing (including Unicode/RTL fixture coverage).
  return {
    operation: "watermark",
    input,
    input_format: "pdf",
    text,
    text_color: "#666666",
    font_size: 42,
    opacity: 0.25,
    position: "center",
    rotation: -35,
    layer: "above",
    timeout: CLOUDCONVERT_MAX_JOB_SECONDS,
  };
}

function exportUploadTask(input: string, url: string): Record<string, unknown> {
  return { operation: "export/upload", input, url };
}

export async function createOfficeConversionJob(
  input: CloudConvertOfficeJobInput,
): Promise<CloudConvertJob> {
  const tasks: Record<string, Record<string, unknown>> = {
    "import-source": {
      operation: "import/url",
      url: input.sourceUrl,
      filename: input.sourceFilename,
    },
    "convert-pdf": {
      operation: "convert",
      input: "import-source",
      input_format: input.sourceFormat,
      output_format: "pdf",
      timeout: CLOUDCONVERT_MAX_JOB_SECONDS,
    },
    "optimize-pdf": {
      operation: "optimize",
      input: "convert-pdf",
      input_format: "pdf",
      profile: "web",
      timeout: CLOUDCONVERT_MAX_JOB_SECONDS,
    },
    "read-metadata": {
      operation: "metadata",
      input: "optimize-pdf",
      input_format: "pdf",
      timeout: CLOUDCONVERT_MAX_JOB_SECONDS,
    },
    "create-thumbnail": {
      operation: "thumbnail",
      input: "optimize-pdf",
      input_format: "pdf",
      output_format: "webp",
      width: 600,
      fit: "max",
      timeout: CLOUDCONVERT_MAX_JOB_SECONDS,
    },
    // The canonical document remains an optimised PDF.  A protected download
    // is a second artifact: publishing it must never replace the unwatermarked
    // source that viewers render.
    "export-pdf": exportUploadTask("optimize-pdf", input.outputPdfUrl),
    "export-thumbnail": exportUploadTask("create-thumbnail", input.outputThumbnailUrl),
  };

  if (input.watermark) {
    tasks["apply-watermark"] = watermarkTask("optimize-pdf", input.watermark.text);
    tasks["export-watermark"] = exportUploadTask("apply-watermark", input.watermark.outputUrl);
  }

  return request<CloudConvertJob>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag: input.tag, tasks }),
  });
}

export async function createWatermarkJob(
  input: CloudConvertWatermarkJobInput,
): Promise<CloudConvertJob> {
  return request<CloudConvertJob>("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tag: input.tag,
      tasks: {
        "import-source": { operation: "import/url", url: input.sourceUrl },
        "apply-watermark": watermarkTask("import-source", input.text),
        "export-watermark": exportUploadTask("apply-watermark", input.outputUrl),
      },
    }),
  });
}

export function getCloudConvertJob(jobId: string): Promise<CloudConvertJob> {
  return request<CloudConvertJob>(`/jobs/${encodeURIComponent(jobId)}`);
}

export function findCloudConvertJobsByTag(tag: string): Promise<CloudConvertJob[]> {
  const query = new URLSearchParams({
    "filter[tag]": tag,
    per_page: "100",
  });
  return request<CloudConvertJob[]>(`/jobs?${query}`);
}

/** Deleting a running job is CloudConvert's cancellation mechanism. */
export async function deleteCloudConvertJob(jobId: string): Promise<void> {
  await request<CloudConvertJob>(`/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
}

export function providerTaskCredits(job: CloudConvertJob): Record<string, number> {
  return Object.fromEntries(
    job.tasks
      .filter((task) => typeof task.credits === "number")
      .map((task) => [task.name, task.credits as number]),
  );
}

export function providerTaskValue(job: CloudConvertJob, name: string, key: string): unknown {
  return job.tasks.find((task) => task.name === name)?.result?.[key];
}
