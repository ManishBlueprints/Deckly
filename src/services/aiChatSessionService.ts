import { supabase } from "./supabase.ts";
import { withRetry } from "../utils/resilience.ts";
import { aiRetrievalQueryService } from "./aiRetrievalQueryService.ts";
import {
  AI_CHAT_MODEL_IDENTIFIER,
  AI_CHAT_MODEL_VERSION,
} from "./aiConfig.ts";
import type { AiScopeReference, AiScopeType } from "./aiScopeResolutionBuilder.ts";
import type {
  AiRetrievalRequest,
  AiRetrievalResult,
  AiRetrievedSnippet,
} from "./aiRetrievalQueryService.ts";

export { AI_CHAT_MODEL_IDENTIFIER, AI_CHAT_MODEL_VERSION } from "./aiConfig.ts";
export const AI_CHAT_HISTORY_LIMIT = 12;

export type AiChatAuthState = "guest" | "signed_in";
export type AiChatSessionStoredStatus = "active" | "closed" | "archived";
export type AiChatSessionResolvedStatus = AiChatSessionStoredStatus | "guest_locked";
export type AiChatMessageRole = "system" | "user" | "assistant" | "tool";
export type AiChatHashChangeStrategy = "reset" | "fork";

export type AiChatSessionActor =
  | {
      auth_state: "guest";
    }
  | {
      auth_state: "signed_in";
      user_id: string;
    };

export interface AiChatSummaryContext {
  summary_cache_id: string | null;
  summary_text: string | null;
}

export interface AiChatSessionKey extends AiScopeReference {
  auth_state: AiChatAuthState;
  user_id: string | null;
  content_hash: string;
  model_identifier: string;
  model_version: string;
}

export interface AiChatSessionRow extends AiScopeReference {
  id: string;
  user_id: string;
  content_hash: string;
  summary_cache_id: string | null;
  model_identifier: string;
  model_version: string;
  session_status: AiChatSessionStoredStatus;
  title: string | null;
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessageRow {
  id: string;
  session_id: string;
  message_index: number;
  role: AiChatMessageRole;
  content: string;
  citations: Record<string, unknown>[];
  retrieval_context: AiRetrievedSnippet[];
  token_count: number | null;
  model_identifier: string | null;
  model_version: string | null;
  created_at: string;
}

export interface AiManagedChatSession extends AiChatSessionKey {
  id: string | null;
  summary_cache_id: string | null;
  title: string | null;
  session_status: AiChatSessionResolvedStatus;
  persistence: "database" | "ephemeral";
  reused: boolean;
  transition:
    | "guest_locked"
    | "reused_existing"
    | "created_new"
    | "reset_for_hash"
    | "forked_for_hash";
  last_message_at: string | null;
  closed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  session_key: string;
}

export interface AiEnsureChatSessionRequest extends AiScopeReference {
  actor: AiChatSessionActor;
  content_hash: string;
  model_identifier?: string;
  model_version?: string;
  title?: string | null;
  summary_context?: Partial<AiChatSummaryContext> | null;
  hash_change_strategy?: AiChatHashChangeStrategy;
  now?: Date;
}

export interface AiAppendChatMessageRequest {
  session: Pick<AiManagedChatSession, "id" | "auth_state" | "session_key">;
  role: AiChatMessageRole;
  content: string;
  citations?: Record<string, unknown>[];
  retrieval_context?: AiRetrievedSnippet[];
  token_count?: number | null;
  model_identifier?: string | null;
  model_version?: string | null;
  created_at?: Date;
}

export interface AiChatRetrievalConfig {
  embedding_model: string;
  model_version: string;
  max_results?: number;
  max_characters?: number;
  max_candidates?: number;
}

export interface AiAssembleFollowUpContextRequest extends AiScopeReference {
  actor: AiChatSessionActor;
  content_hash: string;
  question: string;
  retrieval: AiChatRetrievalConfig;
  summary_context?: Partial<AiChatSummaryContext> | null;
  model_identifier?: string;
  model_version?: string;
  title?: string | null;
  hash_change_strategy?: AiChatHashChangeStrategy;
  history_limit?: number;
  now?: Date;
}

export interface AiFollowUpContextResult {
  session: AiManagedChatSession;
  summary_context: AiChatSummaryContext;
  history: AiChatMessageRow[];
  recent_history: AiChatMessageRow[];
  retrieval: AiRetrievalResult;
  prompt_context: {
    scope_type: AiScopeType;
    scope_id: string;
    content_hash: string;
    auth_state: AiChatAuthState;
    question: string;
    summary_text: string | null;
    history_message_count: number;
    retrieval_snippet_count: number;
  };
}

export interface AiChatSessionServiceDependencies {
  getExactSession: (key: AiChatSessionKey) => Promise<AiChatSessionRow | null>;
  getLatestScopedSession: (
    key: Omit<AiChatSessionKey, "auth_state" | "content_hash"> & { auth_state: "signed_in" },
  ) => Promise<AiChatSessionRow | null>;
  closeScopedSessionsForOtherHashes: (
    key: Omit<AiChatSessionKey, "auth_state"> & { closed_at: string },
  ) => Promise<void>;
  createSession: (input: {
    user_id: string;
    scope_type: AiScopeType;
    scope_id: string;
    content_hash: string;
    summary_cache_id: string | null;
    model_identifier: string;
    model_version: string;
    title: string | null;
    now: Date;
  }) => Promise<AiChatSessionRow>;
  getMessages: (session_id: string) => Promise<AiChatMessageRow[]>;
  getLatestMessage: (session_id: string) => Promise<AiChatMessageRow | null>;
  insertMessage: (input: {
    session_id: string;
    message_index: number;
    role: AiChatMessageRole;
    content: string;
    citations: Record<string, unknown>[];
    retrieval_context: AiRetrievedSnippet[];
    token_count: number | null;
    model_identifier: string | null;
    model_version: string | null;
    created_at: string;
  }) => Promise<AiChatMessageRow>;
  touchSession: (session_id: string, last_message_at: string) => Promise<void>;
  retrieveSnippets: (request: AiRetrievalRequest) => Promise<AiRetrievalResult>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

const asNullableString = (value: unknown): string | null =>
  value === null || value === undefined ? null : asString(value);

const asInteger = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;

const asChatSessionStatus = (value: unknown): AiChatSessionStoredStatus | null => {
  if (value === "active" || value === "closed" || value === "archived") {
    return value;
  }

  return null;
};

const asChatMessageRole = (value: unknown): AiChatMessageRole | null => {
  if (value === "system" || value === "user" || value === "assistant" || value === "tool") {
    return value;
  }

  return null;
};

const asObjectArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)))
    : [];

const asRetrievedSnippetArray = (value: unknown): AiRetrievedSnippet[] =>
  Array.isArray(value) ? (value as AiRetrievedSnippet[]) : [];

const asSessionRow = (value: unknown): AiChatSessionRow | null => {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = asString(raw.id);
  const userId = asString(raw.user_id);
  const scopeType = raw.scope_type;
  const scopeId = asString(raw.scope_id);
  const contentHash = asString(raw.content_hash);
  const modelIdentifier = asString(raw.model_identifier);
  const modelVersion = asString(raw.model_version);
  const sessionStatus = asChatSessionStatus(raw.session_status);
  const createdAt = asString(raw.created_at);
  const updatedAt = asString(raw.updated_at);

  if (
    !id ||
    !userId ||
    !scopeId ||
    !contentHash ||
    !modelIdentifier ||
    !modelVersion ||
    !sessionStatus ||
    !createdAt ||
    !updatedAt ||
    (scopeType !== "deck" && scopeType !== "folder" && scopeType !== "data_room")
  ) {
    return null;
  }

  return {
    id,
    user_id: userId,
    scope_type: scopeType,
    scope_id: scopeId,
    content_hash: contentHash,
    summary_cache_id: asNullableString(raw.summary_cache_id),
    model_identifier: modelIdentifier,
    model_version: modelVersion,
    session_status: sessionStatus,
    title: asNullableString(raw.title),
    last_message_at: asNullableString(raw.last_message_at),
    closed_at: asNullableString(raw.closed_at),
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const asMessageRow = (value: unknown): AiChatMessageRow | null => {
  const raw = asRecord(value);
  if (!raw) return null;

  const id = asString(raw.id);
  const sessionId = asString(raw.session_id);
  const messageIndex = asInteger(raw.message_index);
  const role = asChatMessageRole(raw.role);
  const content = asString(raw.content);
  const createdAt = asString(raw.created_at);

  if (!id || !sessionId || messageIndex === null || !role || !content || !createdAt) {
    return null;
  }

  return {
    id,
    session_id: sessionId,
    message_index: messageIndex,
    role,
    content,
    citations: asObjectArray(raw.citations),
    retrieval_context: asRetrievedSnippetArray(raw.retrieval_context),
    token_count: asInteger(raw.token_count),
    model_identifier: asNullableString(raw.model_identifier),
    model_version: asNullableString(raw.model_version),
    created_at: createdAt,
  };
};

const normalizeSummaryContext = (
  summaryContext: Partial<AiChatSummaryContext> | null | undefined,
): AiChatSummaryContext => ({
  summary_cache_id: summaryContext?.summary_cache_id ?? null,
  summary_text: summaryContext?.summary_text?.trim() || null,
});

const resolveModelIdentifier = (value: string | undefined): string =>
  value?.trim() || AI_CHAT_MODEL_IDENTIFIER;

const resolveModelVersion = (value: string | undefined): string =>
  value?.trim() || AI_CHAT_MODEL_VERSION;

const clampHistoryLimit = (value: number | undefined): number => {
  if (!Number.isFinite(value)) return AI_CHAT_HISTORY_LIMIT;
  return Math.max(1, Math.floor(value as number));
};

const buildManagedSession = (
  session: AiChatSessionRow | null,
  key: AiChatSessionKey,
  args: {
    summary_cache_id: string | null;
    title: string | null;
    persistence: "database" | "ephemeral";
    reused: boolean;
    transition: AiManagedChatSession["transition"];
  },
): AiManagedChatSession => ({
  id: session?.id ?? null,
  auth_state: key.auth_state,
  user_id: key.user_id,
  scope_type: key.scope_type,
  scope_id: key.scope_id,
  content_hash: key.content_hash,
  model_identifier: key.model_identifier,
  model_version: key.model_version,
  summary_cache_id: args.summary_cache_id,
  title: args.title,
  session_status: session?.session_status ?? "guest_locked",
  persistence: args.persistence,
  reused: args.reused,
  transition: args.transition,
  last_message_at: session?.last_message_at ?? null,
  closed_at: session?.closed_at ?? null,
  created_at: session?.created_at ?? null,
  updated_at: session?.updated_at ?? null,
  session_key: serializeAiChatSessionKey(key),
});

export const serializeAiChatSessionKey = (key: AiChatSessionKey): string =>
  [
    key.auth_state,
    key.user_id ?? "guest",
    key.scope_type,
    key.scope_id,
    key.content_hash,
    key.model_identifier,
    key.model_version,
  ].join(":");

const defaultDependencies: AiChatSessionServiceDependencies = {
  async getExactSession(key) {
    const { data, error } = await supabase
      .from("ai_chat_sessions")
      .select("*")
      .eq("user_id", key.user_id)
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("content_hash", key.content_hash)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .eq("session_status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return asSessionRow(data);
  },

  async getLatestScopedSession(key) {
    const { data, error } = await supabase
      .from("ai_chat_sessions")
      .select("*")
      .eq("user_id", key.user_id)
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return asSessionRow(data);
  },

  async closeScopedSessionsForOtherHashes(key) {
    const { error } = await supabase
      .from("ai_chat_sessions")
      .update({
        session_status: "closed",
        closed_at: key.closed_at,
        updated_at: key.closed_at,
      })
      .eq("user_id", key.user_id)
      .eq("scope_type", key.scope_type)
      .eq("scope_id", key.scope_id)
      .eq("model_identifier", key.model_identifier)
      .eq("model_version", key.model_version)
      .eq("session_status", "active")
      .neq("content_hash", key.content_hash);

    if (error) throw error;
  },

  async createSession(input) {
    const nowIso = input.now.toISOString();
    const { data, error } = await supabase
      .from("ai_chat_sessions")
      .insert({
        user_id: input.user_id,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        content_hash: input.content_hash,
        summary_cache_id: input.summary_cache_id,
        model_identifier: input.model_identifier,
        model_version: input.model_version,
        session_status: "active",
        title: input.title,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("*")
      .single();

    if (error) throw error;
    const row = asSessionRow(data);
    if (!row) {
      throw new Error("Failed to persist AI chat session.");
    }

    return row;
  },

  async getMessages(session_id) {
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("session_id", session_id)
      .order("message_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as unknown[])
      .map((row) => asMessageRow(row))
      .filter((row): row is AiChatMessageRow => Boolean(row));
  },

  async getLatestMessage(session_id) {
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("session_id", session_id)
      .order("message_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return asMessageRow(data);
  },

  async insertMessage(input) {
    const { data, error } = await supabase
      .from("ai_chat_messages")
      .insert(input)
      .select("*")
      .single();

    if (error) throw error;
    const row = asMessageRow(data);
    if (!row) {
      throw new Error("Failed to persist AI chat message.");
    }

    return row;
  },

  async touchSession(session_id, last_message_at) {
    const { error } = await supabase
      .from("ai_chat_sessions")
      .update({
        last_message_at,
        updated_at: last_message_at,
      })
      .eq("id", session_id);

    if (error) throw error;
  },

  async retrieveSnippets(request) {
    return aiRetrievalQueryService.retrieveSnippets(request);
  },
};

export const createAiChatSessionService = (
  dependencies: AiChatSessionServiceDependencies = defaultDependencies,
) => {
  const service = {
  buildSessionKey(request: {
    actor: AiChatSessionActor;
    scope_type: AiScopeType;
    scope_id: string;
    content_hash: string;
    model_identifier?: string;
    model_version?: string;
  }): string {
    const key: AiChatSessionKey = {
      auth_state: request.actor.auth_state,
      user_id: request.actor.auth_state === "signed_in" ? request.actor.user_id : null,
      scope_type: request.scope_type,
      scope_id: request.scope_id,
      content_hash: request.content_hash,
      model_identifier: resolveModelIdentifier(request.model_identifier),
      model_version: resolveModelVersion(request.model_version),
    };

    return serializeAiChatSessionKey(key);
  },

  async ensureSession(
    request: AiEnsureChatSessionRequest,
  ): Promise<{ session: AiManagedChatSession; summary_context: AiChatSummaryContext }> {
    return withRetry(async () => {
      const contentHash = request.content_hash.trim();
      if (!contentHash) {
        throw new Error("AI chat sessions require a content hash.");
      }

      const modelIdentifier = resolveModelIdentifier(request.model_identifier);
      const modelVersion = resolveModelVersion(request.model_version);
      const summaryContext = normalizeSummaryContext(request.summary_context);
      const key: AiChatSessionKey = {
        auth_state: request.actor.auth_state,
        user_id: request.actor.auth_state === "signed_in" ? request.actor.user_id : null,
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        content_hash: contentHash,
        model_identifier: modelIdentifier,
        model_version: modelVersion,
      };

      if (request.actor.auth_state === "guest") {
        return {
          session: buildManagedSession(null, key, {
            summary_cache_id: summaryContext.summary_cache_id,
            title: request.title?.trim() || null,
            persistence: "ephemeral",
            reused: false,
            transition: "guest_locked",
          }),
          summary_context: summaryContext,
        };
      }

      const exactSession = await dependencies.getExactSession(key);
      if (exactSession) {
        return {
          session: buildManagedSession(exactSession, key, {
            summary_cache_id: summaryContext.summary_cache_id ?? exactSession.summary_cache_id,
            title: request.title?.trim() || exactSession.title,
            persistence: "database",
            reused: true,
            transition: "reused_existing",
          }),
          summary_context: {
            ...summaryContext,
            summary_cache_id: summaryContext.summary_cache_id ?? exactSession.summary_cache_id,
          },
        };
      }

      const latestSession = await dependencies.getLatestScopedSession({
        auth_state: "signed_in",
        user_id: request.actor.user_id,
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        model_identifier: modelIdentifier,
        model_version: modelVersion,
      });
      const hashChanged = Boolean(latestSession && latestSession.content_hash !== contentHash);
      const now = request.now ?? new Date();

      if (hashChanged) {
        await dependencies.closeScopedSessionsForOtherHashes({
          user_id: request.actor.user_id,
          scope_type: request.scope_type,
          scope_id: request.scope_id,
          content_hash: contentHash,
          model_identifier: modelIdentifier,
          model_version: modelVersion,
          closed_at: now.toISOString(),
        });
      }

      const createdSession = await dependencies.createSession({
        user_id: request.actor.user_id,
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        content_hash: contentHash,
        summary_cache_id: summaryContext.summary_cache_id,
        model_identifier: modelIdentifier,
        model_version: modelVersion,
        title: request.title?.trim() || latestSession?.title || null,
        now,
      });

      return {
        session: buildManagedSession(createdSession, key, {
          summary_cache_id: summaryContext.summary_cache_id ?? createdSession.summary_cache_id,
          title: createdSession.title,
          persistence: "database",
          reused: false,
          transition: hashChanged
            ? request.hash_change_strategy === "reset"
              ? "reset_for_hash"
              : "forked_for_hash"
            : "created_new",
        }),
        summary_context: summaryContext,
      };
    });
  },

  async listMessages(session_id: string): Promise<AiChatMessageRow[]> {
    return withRetry(async () => dependencies.getMessages(session_id));
  },

  async appendMessage(request: AiAppendChatMessageRequest): Promise<AiChatMessageRow> {
    return withRetry(async () => {
      if (request.session.auth_state !== "signed_in" || !request.session.id) {
        throw new Error("AI chat message persistence requires a signed-in session.");
      }

      const content = request.content.trim();
      if (!content) {
        throw new Error("AI chat messages cannot be empty.");
      }

      const latestMessage = await dependencies.getLatestMessage(request.session.id);
      const messageIndex = latestMessage ? latestMessage.message_index + 1 : 0;
      const createdAt = request.created_at ?? new Date();
      const persisted = await dependencies.insertMessage({
        session_id: request.session.id,
        message_index: messageIndex,
        role: request.role,
        content,
        citations: request.citations ?? [],
        retrieval_context: request.retrieval_context ?? [],
        token_count: request.token_count ?? null,
        model_identifier: request.model_identifier ?? null,
        model_version: request.model_version ?? null,
        created_at: createdAt.toISOString(),
      });

      await dependencies.touchSession(request.session.id, persisted.created_at);
      return persisted;
    });
  },

  async assembleFollowUpContext(
    request: AiAssembleFollowUpContextRequest,
  ): Promise<AiFollowUpContextResult> {
    const question = request.question.trim();
    if (!question) {
      throw new Error("AI follow-up questions cannot be empty.");
    }

    const { session, summary_context } = await service.ensureSession(request);
    if (!session.id) {
      throw new Error("AI follow-up chat requires a signed-in session.");
    }

    const history = await service.listMessages(session.id);
    const retrieval = await dependencies.retrieveSnippets({
      scope_type: request.scope_type,
      scope_id: request.scope_id,
      content_hash: request.content_hash,
      query: question,
      embedding_model: request.retrieval.embedding_model,
      model_version: request.retrieval.model_version,
      max_results: request.retrieval.max_results,
      max_characters: request.retrieval.max_characters,
      max_candidates: request.retrieval.max_candidates,
    });
    const historyLimit = clampHistoryLimit(request.history_limit);
    const recentHistory = history.slice(-historyLimit);

    return {
      session,
      summary_context,
      history,
      recent_history: recentHistory,
      retrieval,
      prompt_context: {
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        content_hash: request.content_hash,
        auth_state: request.actor.auth_state,
        question,
        summary_text: summary_context.summary_text,
        history_message_count: history.length,
        retrieval_snippet_count: retrieval.snippets.length,
      },
    };
  },
  };

  return service;
};

export const aiChatSessionService = createAiChatSessionService();
