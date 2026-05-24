import { supabase } from "./supabase.ts";
import type { AiSummaryInitialResult } from "./aiSummaryInitialOrchestrator.ts";
import type { AiScopeReference, AiScopeType } from "./aiScopeResolutionBuilder.ts";

export interface AiSummaryChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AiSummaryChatResult {
  scope_type: AiScopeType;
  scope_id: string;
  content_hash: string;
  messages: AiSummaryChatMessage[];
  assistant_message: AiSummaryChatMessage | null;
  summary_text: string | null;
  session_id: string | null;
}

export interface AiSummaryRequest extends AiScopeReference {
  title?: string | null;
}

export interface AiSummaryChatRequest extends AiScopeReference {
  content_hash: string;
  question: string;
  title?: string | null;
  summary_text?: string | null;
}

interface AiExtractionResult extends AiScopeReference {
  processed_documents: number;
  extracted_documents: number;
  skipped_documents: number;
}

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) return {};

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
};

const parseJson = <T,>(value: unknown, context: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${context} response body to be a JSON object, received empty payload.`);
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `Expected ${context} response body to be a JSON object, received ${Array.isArray(value) ? "an array" : typeof value}.`,
    );
  }

  return value as T;
};

const buildRequestError = (
  fallbackMessage: string,
  response: Response,
  data: unknown,
) => {
  const message = typeof (data as { message?: unknown } | null)?.message === "string"
    ? String((data as { message?: string }).message)
    : fallbackMessage;
  const error = new Error(message);
  (error as Error & { status?: number }).status = response.status;
  (error as Error & { payload?: unknown }).payload = data;
  return error;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables for AI summaries.");
}

const invokeAiSummaryFunction = async (body: Record<string, unknown>) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/ai-summary`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: headers.Authorization ?? `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);
  return { response, data };
};

const ensureExtractableText = async (
  request: AiScopeReference,
): Promise<AiExtractionResult> => {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/extract-document-text", {
    method: "POST",
    headers: {
      ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("AI extraction request failed", {
      status: response.status,
      payload: data,
    });
    throw buildRequestError(
      "Failed to prepare document text for AI summary.",
      response,
      data,
    );
  }

  return parseJson<AiExtractionResult>(data, "AI extraction");
};

export const aiSummaryService = {
  async summarizeScope(request: AiSummaryRequest): Promise<AiSummaryInitialResult> {
    await ensureExtractableText({
      scope_type: request.scope_type,
      scope_id: request.scope_id,
    });

    const { response, data } = await invokeAiSummaryFunction({
      action: "summarize",
      scope_type: request.scope_type,
      scope_id: request.scope_id,
      title: request.title ?? null,
    });

    if (!response.ok && response.status !== 429) {
      console.error("AI summary request failed", {
        status: response.status,
        payload: data,
      });
      throw buildRequestError("Failed to load AI summary.", response, data);
    }

    return parseJson<AiSummaryInitialResult>(data, "AI summary");
  },

  async sendChatMessage(request: AiSummaryChatRequest): Promise<AiSummaryChatResult> {
    const { response, data } = await invokeAiSummaryFunction({
      action: "chat",
      scope_type: request.scope_type,
      scope_id: request.scope_id,
      content_hash: request.content_hash,
      question: request.question,
      title: request.title ?? null,
      summary_text: request.summary_text ?? null,
    });

    if (!response.ok) {
      console.error("AI chat request failed", {
        status: response.status,
        payload: data,
      });
      throw buildRequestError("Failed to send AI chat message.", response, data);
    }

    return parseJson<AiSummaryChatResult>(data, "AI chat");
  },
};
