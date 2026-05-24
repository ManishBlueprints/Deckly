import { withRetry } from "../utils/resilience.ts";
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
  message_id: string;
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
  appendMessageAtomically: (input: {
    message_id: string;
    session_id: string;
    role: AiChatMessageRole;
    content: string;
    citations: Record<string, unknown>[];
    retrieval_context: AiRetrievedSnippet[];
    token_count: number | null;
    model_identifier: string | null;
    model_version: string | null;
    created_at: string;
  }) => Promise<AiChatMessageRow>;
  retrieveSnippets: (request: AiRetrievalRequest) => Promise<AiRetrievalResult>;
}

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

export const createAiChatSessionService = (
  dependencies: AiChatSessionServiceDependencies,
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
    const contentHash = request.content_hash.trim();
    if (!contentHash) {
      throw new Error("AI chat sessions require a content hash.");
    }

    const modelIdentifier = resolveModelIdentifier(request.model_identifier);
    const modelVersion = resolveModelVersion(request.model_version);
    const summaryContext = normalizeSummaryContext(request.summary_context);
    const signedInUserId = request.actor.auth_state === "signed_in"
      ? request.actor.user_id
      : null;
    const key: AiChatSessionKey = {
      auth_state: request.actor.auth_state,
      user_id: signedInUserId,
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

    const exactSession = await withRetry(async () => dependencies.getExactSession(key));
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

    if (!signedInUserId) {
      throw new Error("AI chat sessions require a signed-in user.");
    }

    const latestSession = await withRetry(async () =>
      dependencies.getLatestScopedSession({
        auth_state: "signed_in",
        user_id: signedInUserId,
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        model_identifier: modelIdentifier,
        model_version: modelVersion,
      }),
    );
    const hashChanged = Boolean(latestSession && latestSession.content_hash !== contentHash);
    const now = request.now ?? new Date();

    if (hashChanged) {
      await dependencies.closeScopedSessionsForOtherHashes({
        user_id: signedInUserId,
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        content_hash: contentHash,
        model_identifier: modelIdentifier,
        model_version: modelVersion,
        closed_at: now.toISOString(),
      });
    }

    const createdSession = await dependencies.createSession({
      user_id: signedInUserId,
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
  },

  async listMessages(session_id: string): Promise<AiChatMessageRow[]> {
    return withRetry(async () => dependencies.getMessages(session_id));
  },

  async appendMessage(request: AiAppendChatMessageRequest): Promise<AiChatMessageRow> {
    return withRetry(async () => {
      if (request.session.auth_state !== "signed_in" || !request.session.id) {
        throw new Error("AI chat message persistence requires a signed-in session.");
      }

      const messageId = request.message_id.trim();
      if (!messageId) {
        throw new Error("AI chat messages require a client-generated message id.");
      }

      const content = request.content.trim();
      if (!content) {
        throw new Error("AI chat messages cannot be empty.");
      }

      const createdAt = request.created_at ?? new Date();
      return dependencies.appendMessageAtomically({
        message_id: messageId,
        session_id: request.session.id,
        role: request.role,
        content,
        citations: request.citations ?? [],
        retrieval_context: request.retrieval_context ?? [],
        token_count: request.token_count ?? null,
        model_identifier: request.model_identifier ?? null,
        model_version: request.model_version ?? null,
        created_at: createdAt.toISOString(),
      });
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
