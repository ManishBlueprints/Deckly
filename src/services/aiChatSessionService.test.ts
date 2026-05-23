/// <reference types="vitest/globals" />

import {
  AI_CHAT_MODEL_IDENTIFIER,
  AI_CHAT_MODEL_VERSION,
  createAiChatSessionService,
  serializeAiChatSessionKey,
  type AiChatMessageRow,
  type AiChatSessionRow,
} from "./aiChatSessionService";
import type { AiRetrievedSnippet } from "./aiRetrievalQueryService";

const RETRIEVAL_MODEL = {
  embedding_model: "text-embedding-3-small",
  model_version: "2026-05-02",
} as const;

const createSessionRow = (
  overrides: Partial<AiChatSessionRow> = {},
): AiChatSessionRow => ({
  id: "session-1",
  user_id: "user-1",
  scope_type: "folder",
  scope_id: "folder-1",
  content_hash: "hash-1",
  summary_cache_id: "cache-1",
  model_identifier: AI_CHAT_MODEL_IDENTIFIER,
  model_version: AI_CHAT_MODEL_VERSION,
  session_status: "active",
  title: "Finance Folder",
  last_message_at: null,
  closed_at: null,
  created_at: "2026-05-02T12:00:00.000Z",
  updated_at: "2026-05-02T12:00:00.000Z",
  ...overrides,
});

const createMessageRow = (
  overrides: Partial<AiChatMessageRow> = {},
): AiChatMessageRow => ({
  id: "message-1",
  session_id: "session-1",
  message_index: 0,
  role: "user",
  content: "What changed?",
  citations: [],
  retrieval_context: [],
  token_count: null,
  model_identifier: null,
  model_version: null,
  created_at: "2026-05-02T12:05:00.000Z",
  ...overrides,
});

const createSnippet = (overrides: Partial<AiRetrievedSnippet> = {}): AiRetrievedSnippet => ({
  chunk_id: "chunk-1",
  chunk_index: 0,
  scope_type: "folder",
  scope_id: "folder-1",
  content_hash: "hash-1",
  source_label: "Financial Overview",
  snippet_text: "Revenue expanded after the pricing change.",
  truncated: false,
  metadata: {
    source_id: "doc-1",
    deck_id: "deck-1",
    file_type: "pdf",
    folder_id: "folder-1",
    folder_name: "Finance",
    source_chunk_index: 0,
    source_chunk_count: 1,
    char_start: 0,
    char_end: 42,
    text_length: 42,
  },
  ranking: {
    combined_score: 120,
    keyword_score: 80,
    repository_score: 0.4,
    exact_phrase_match: false,
    matched_terms: ["revenue"],
  },
  ...overrides,
});

const createInMemoryService = () => {
  const sessions: AiChatSessionRow[] = [];
  const messages: AiChatMessageRow[] = [];
  const retrievalCalls: Array<Record<string, unknown>> = [];
  const closeCalls: Array<Record<string, unknown>> = [];

  const service = createAiChatSessionService({
    async getExactSession(key) {
      return (
        sessions
          .filter(
            (session) =>
              session.user_id === key.user_id &&
              session.scope_type === key.scope_type &&
              session.scope_id === key.scope_id &&
              session.content_hash === key.content_hash &&
              session.model_identifier === key.model_identifier &&
              session.model_version === key.model_version &&
              session.session_status === "active",
          )
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null
      );
    },

    async getLatestScopedSession(key) {
      return (
        sessions
          .filter(
            (session) =>
              session.user_id === key.user_id &&
              session.scope_type === key.scope_type &&
              session.scope_id === key.scope_id &&
              session.model_identifier === key.model_identifier &&
              session.model_version === key.model_version,
          )
          .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null
      );
    },

    async closeScopedSessionsForOtherHashes(key) {
      closeCalls.push(key);
      sessions.forEach((session) => {
        if (
          session.user_id === key.user_id &&
          session.scope_type === key.scope_type &&
          session.scope_id === key.scope_id &&
          session.model_identifier === key.model_identifier &&
          session.model_version === key.model_version &&
          session.session_status === "active" &&
          session.content_hash !== key.content_hash
        ) {
          session.session_status = "closed";
          session.closed_at = key.closed_at;
          session.updated_at = key.closed_at;
        }
      });
    },

    async createSession(input) {
      const row = createSessionRow({
        id: `session-${sessions.length + 1}`,
        user_id: input.user_id,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        content_hash: input.content_hash,
        summary_cache_id: input.summary_cache_id,
        model_identifier: input.model_identifier,
        model_version: input.model_version,
        title: input.title,
        created_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      });
      sessions.push(row);
      return row;
    },

    async getMessages(session_id) {
      return messages
        .filter((message) => message.session_id === session_id)
        .sort((left, right) => {
          if (left.message_index !== right.message_index) {
            return left.message_index - right.message_index;
          }

          return left.created_at.localeCompare(right.created_at);
        });
    },

    async appendMessageAtomically(input) {
      const existing = messages.find((message) => message.id === input.message_id);
      if (existing) {
        if (existing.session_id !== input.session_id) {
          throw new Error("Message id already belongs to another session.");
        }
        const session = sessions.find((entry) => entry.id === input.session_id);
        if (session) {
          session.last_message_at = existing.created_at;
          session.updated_at = existing.created_at;
        }
        return existing;
      }

      const nextIndex =
        messages
          .filter((message) => message.session_id === input.session_id)
          .reduce((max, message) => Math.max(max, message.message_index), -1) + 1;

      const row = createMessageRow({
        id: input.message_id,
        session_id: input.session_id,
        message_index: nextIndex,
        role: input.role,
        content: input.content,
        citations: input.citations,
        retrieval_context: input.retrieval_context,
        token_count: input.token_count,
        model_identifier: input.model_identifier,
        model_version: input.model_version,
        created_at: input.created_at,
      });
      messages.push(row);

      const session = sessions.find((entry) => entry.id === input.session_id);
      if (session) {
        session.last_message_at = input.created_at;
        session.updated_at = input.created_at;
      }
      return row;
    },

    async retrieveSnippets(request) {
      retrievalCalls.push(request as unknown as Record<string, unknown>);
      return {
        scope_type: request.scope_type,
        scope_id: request.scope_id,
        content_hash: request.content_hash ?? null,
        query: request.query,
        snippets: [
          createSnippet({
            scope_type: request.scope_type,
            scope_id: request.scope_id,
            content_hash: request.content_hash ?? "hash-1",
          }),
        ],
        metadata: {
          query_terms: ["revenue"],
          ranking_version: "lexical_scope_v1",
          content_hash_source: "provided",
          fallback_used: false,
          returned_count: 1,
          used_characters: 42,
          max_results: request.max_results ?? 6,
          max_characters: request.max_characters ?? 3600,
          max_candidates: request.max_candidates ?? 40,
          candidate_count: 1,
          filtered_out_count: 0,
          dropped_chunk_ids: [],
          matched_chunk_ids: ["chunk-1"],
        },
      };
    },
  });

  return { service, sessions, messages, retrievalCalls, closeCalls };
};

describe("aiChatSessionService", () => {
  it("reuses a signed-in session only when scope, auth state, and content hash all match", async () => {
    const { service, sessions, messages, retrievalCalls } = createInMemoryService();
    sessions.push(createSessionRow());
    messages.push(
      createMessageRow({ id: "message-1", role: "user", message_index: 0 }),
      createMessageRow({ id: "message-2", role: "assistant", message_index: 1 }),
    );

    const { session } = await service.ensureSession({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "hash-1",
      actor: {
        auth_state: "signed_in",
        user_id: "user-1",
      },
      summary_context: {
        summary_cache_id: "cache-1",
        summary_text: "Cached finance summary",
      },
    });

    expect(session.reused).toBe(true);
    expect(session.transition).toBe("reused_existing");
    expect(session.session_key).toBe(
      serializeAiChatSessionKey({
        auth_state: "signed_in",
        user_id: "user-1",
        scope_type: "folder",
        scope_id: "folder-1",
        content_hash: "hash-1",
        model_identifier: AI_CHAT_MODEL_IDENTIFIER,
        model_version: AI_CHAT_MODEL_VERSION,
      }),
    );

    const context = await service.assembleFollowUpContext({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "hash-1",
      question: "What changed in revenue?",
      actor: {
        auth_state: "signed_in",
        user_id: "user-1",
      },
      summary_context: {
        summary_cache_id: "cache-1",
        summary_text: "Cached finance summary",
      },
      retrieval: RETRIEVAL_MODEL,
    });

    expect(context.session.id).toBe("session-1");
    expect(context.history.map((message) => message.message_index)).toEqual([0, 1]);
    expect(context.retrieval.snippets).toHaveLength(1);
    expect(context.prompt_context.summary_text).toBe("Cached finance summary");
    expect(retrievalCalls[0]).toMatchObject({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "hash-1",
      query: "What changed in revenue?",
      embedding_model: RETRIEVAL_MODEL.embedding_model,
      model_version: RETRIEVAL_MODEL.model_version,
    });
  });

  it("forks to a new session on content hash changes and closes stale active history", async () => {
    const { service, sessions, messages, closeCalls } = createInMemoryService();
    sessions.push(
      createSessionRow({
        id: "session-old",
        content_hash: "old-hash",
        updated_at: "2026-05-02T12:10:00.000Z",
      }),
    );
    messages.push(
      createMessageRow({
        id: "message-old",
        session_id: "session-old",
        message_index: 0,
        content: "Old hash question",
      }),
    );

    const { session } = await service.ensureSession({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "new-hash",
      actor: {
        auth_state: "signed_in",
        user_id: "user-1",
      },
      summary_context: {
        summary_cache_id: "cache-2",
        summary_text: "Updated summary",
      },
      hash_change_strategy: "fork",
      now: new Date("2026-05-02T12:15:00.000Z"),
    });

    expect(session.id).toBe("session-2");
    expect(session.reused).toBe(false);
    expect(session.transition).toBe("forked_for_hash");
    expect(closeCalls).toHaveLength(1);
    expect(sessions[0]?.session_status).toBe("closed");

    const newSessionMessages = await service.listMessages("session-2");
    expect(newSessionMessages).toEqual([]);
    expect(messages.filter((message) => message.session_id === "session-old")).toHaveLength(1);
  });

  it("persists message order deterministically and keeps retrieval metadata on assistant replies", async () => {
    const { service, messages, sessions } = createInMemoryService();
    const ensured = await service.ensureSession({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "hash-1",
      actor: {
        auth_state: "signed_in",
        user_id: "user-1",
      },
      summary_context: {
        summary_cache_id: "cache-1",
        summary_text: "Summary",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    await service.appendMessage({
      session: ensured.session,
      message_id: "message-1",
      role: "user",
      content: "How is revenue trending?",
      created_at: new Date("2026-05-02T12:01:00.000Z"),
    });
    await service.appendMessage({
      session: ensured.session,
      message_id: "message-2",
      role: "assistant",
      content: "Revenue is trending upward.",
      retrieval_context: [createSnippet()],
      model_identifier: AI_CHAT_MODEL_IDENTIFIER,
      model_version: AI_CHAT_MODEL_VERSION,
      created_at: new Date("2026-05-02T12:01:30.000Z"),
    });
    await service.appendMessage({
      session: ensured.session,
      message_id: "message-3",
      role: "user",
      content: "Which file shows that?",
      created_at: new Date("2026-05-02T12:02:00.000Z"),
    });

    expect(messages.map((message) => message.message_index)).toEqual([0, 1, 2]);
    expect(messages[1]?.retrieval_context[0]?.chunk_id).toBe("chunk-1");
    expect(messages[1]?.model_identifier).toBe(AI_CHAT_MODEL_IDENTIFIER);
    expect(sessions[0]?.last_message_at).toBe("2026-05-02T12:02:00.000Z");

    const ordered = await service.listMessages(ensured.session.id as string);
    expect(ordered.map((message) => `${message.message_index}:${message.role}`)).toEqual([
      "0:user",
      "1:assistant",
      "2:user",
    ]);
  });

  it("is idempotent when the same client message id is retried", async () => {
    const { service, messages, sessions } = createInMemoryService();
    const ensured = await service.ensureSession({
      scope_type: "folder",
      scope_id: "folder-1",
      content_hash: "hash-1",
      actor: {
        auth_state: "signed_in",
        user_id: "user-1",
      },
      summary_context: {
        summary_cache_id: "cache-1",
        summary_text: "Summary",
      },
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    const first = await service.appendMessage({
      session: ensured.session,
      message_id: "message-retry-1",
      role: "user",
      content: "Is this idempotent?",
      created_at: new Date("2026-05-02T12:01:00.000Z"),
    });

    const second = await service.appendMessage({
      session: ensured.session,
      message_id: "message-retry-1",
      role: "user",
      content: "Is this idempotent?",
      created_at: new Date("2026-05-02T12:01:00.000Z"),
    });

    expect(first.id).toBe("message-retry-1");
    expect(second.id).toBe("message-retry-1");
    expect(messages).toHaveLength(1);
    expect(messages[0]?.message_index).toBe(0);
    expect(sessions[0]?.last_message_at).toBe("2026-05-02T12:01:00.000Z");
  });

  it("keeps guest summary context intact and unlocks signed-in chat without re-summary", async () => {
    const { service, sessions } = createInMemoryService();

    const guest = await service.ensureSession({
      scope_type: "deck",
      scope_id: "deck-1",
      content_hash: "deck-hash-1",
      actor: {
        auth_state: "guest",
      },
      summary_context: {
        summary_cache_id: "cache-deck-1",
        summary_text: "Deck summary already on screen.",
      },
    });

    expect(guest.session.id).toBeNull();
    expect(guest.session.persistence).toBe("ephemeral");
    expect(guest.session.transition).toBe("guest_locked");
    expect(guest.summary_context.summary_text).toBe("Deck summary already on screen.");

    const signedIn = await service.ensureSession({
      scope_type: "deck",
      scope_id: "deck-1",
      content_hash: "deck-hash-1",
      actor: {
        auth_state: "signed_in",
        user_id: "user-99",
      },
      summary_context: guest.summary_context,
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(signedIn.session.id).toBe("session-1");
    expect(signedIn.session.summary_cache_id).toBe("cache-deck-1");
    expect(signedIn.summary_context.summary_text).toBe("Deck summary already on screen.");
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      scope_type: "deck",
      scope_id: "deck-1",
      content_hash: "deck-hash-1",
      summary_cache_id: "cache-deck-1",
    });
  });
});
