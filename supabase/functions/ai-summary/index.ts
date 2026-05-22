import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildAiScopeResolution,
  type AiScopeDocumentRecord,
  type AiScopeReference,
  type AiScopeResolution,
} from "../../../src/services/aiScopeResolutionBuilder.ts";
import {
  AI_SUMMARY_MODEL_IDENTIFIER,
  AI_SUMMARY_MODEL_VERSION,
  createAiSummaryInitialOrchestrator,
  type AiSummaryActor,
  type AiSummaryGenerateInput,
  type AiSummaryProviderResult,
} from "../../../src/services/aiSummaryInitialOrchestrator.ts";
import { createAiSummaryCacheServiceWithRetry } from "../../../src/services/aiSummaryCacheCore.ts";
import {
  AI_CHAT_MODEL_IDENTIFIER,
  AI_CHAT_MODEL_VERSION,
  createAiChatSessionService,
} from "../../../src/services/aiChatSessionService.ts";
import {
  AI_RETRIEVAL_MAX_CANDIDATES,
  AI_RETRIEVAL_MAX_CHARACTERS,
  AI_RETRIEVAL_MAX_RESULTS,
  createAiRetrievalQueryService,
  type AiRetrievedSnippet,
} from "../../../src/services/aiRetrievalQueryService.ts";
import { AI_SUMMARY_QUOTA_WINDOW_HOURS } from "../../../src/services/aiSummaryQuotaPolicy.ts";

type ProfileRow = {
  id: string;
  tier: "FREE" | "PRO" | "PRO_PLUS";
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const logAiTelemetry = (
  event: string,
  payload: Record<string, unknown>,
) => {
  console.log(
    JSON.stringify({
      channel: "ai_summary",
      event,
      timestamp: new Date().toISOString(),
      ...payload,
    }),
  );
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getServiceClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    Deno.env.get("PROJECT_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service credentials.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
};

const getAuthenticatedUser = async (
  supabaseClient: SupabaseClient,
  request: Request,
): Promise<{ id: string } | null> => {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser(token);

  if (error || !user) return null;
  return { id: user.id };
};

const getSignedInActor = async (
  supabaseClient: SupabaseClient,
  userId: string,
): Promise<AiSummaryActor> => {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, tier")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Profile not found.");

  return {
    type: "signed_in",
    user_id: userId,
    tier: (data as ProfileRow).tier,
  };
};

const getGuestActor = (ipAddress: string): AiSummaryActor => ({
  type: "guest",
  ip_address: ipAddress,
});

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

const getClientIpAddress = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const connectingIp = request.headers.get("cf-connecting-ip");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();

  return connectingIp?.trim() || realIp?.trim() || firstForwarded || "0.0.0.0";
};

const getScopeResolutionFromPublicDeck = async (
  supabaseClient: SupabaseClient,
  scopeId: string,
): Promise<AiScopeResolution> => {
  const { data, error } = await supabaseClient
    .from("decks")
    .select("*")
    .eq("id", scopeId)
    .eq("is_public", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Public deck scope not found.");
  }

  return buildAiScopeResolution(
    {
      scope_type: "deck",
      scope_id: scopeId,
      scope_label: String((data as AiScopeDocumentRecord).title ?? "Untitled"),
    },
    [
      {
        ...(data as AiScopeDocumentRecord),
        deck_id: String((data as AiScopeDocumentRecord).deck_id ?? (data as AiScopeDocumentRecord).id),
        title: String((data as AiScopeDocumentRecord).title ?? "Untitled"),
      },
    ],
  );
};

const resolveSignedInScope = async (
  supabaseClient: SupabaseClient,
  reference: AiScopeReference,
  userId: string,
) => {
  if (reference.scope_type === "deck") {
    const { data, error } = await supabaseClient
      .from("decks")
      .select("*")
      .eq("id", reference.scope_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Deck scope not found.");

    return buildAiScopeResolution(
      {
        scope_type: "deck",
        scope_id: reference.scope_id,
        scope_label: String((data as AiScopeDocumentRecord).title ?? "Untitled"),
      },
      [
        {
          ...(data as AiScopeDocumentRecord),
          deck_id: String((data as AiScopeDocumentRecord).deck_id ?? (data as AiScopeDocumentRecord).id),
          title: String((data as AiScopeDocumentRecord).title ?? "Untitled"),
        },
      ],
    );
  }

  if (reference.scope_type === "folder") {
    const { data, error } = await supabaseClient
      .from("data_room_folders")
      .select("id, data_room_id, name, data_rooms!inner(id, user_id)")
      .eq("id", reference.scope_id)
      .eq("data_rooms.user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Folder scope not found.");

    const folder = {
      id: String(data.id),
      data_room_id: String(data.data_room_id),
      name: String(data.name),
    };
    const roomDocuments = await getRoomDocuments(supabaseClient, folder.data_room_id);
    const folderDocuments = roomDocuments
      .filter((document) => document.folder_id === folder.id)
      .map((document) => ({
        ...document,
        folder_name: folder.name,
      }));

    return buildAiScopeResolution(
      {
        scope_type: "folder",
        scope_id: reference.scope_id,
        scope_label: folder.name,
      },
      folderDocuments,
    );
  }

  const { data, error } = await supabaseClient
    .from("data_rooms")
    .select("id, name")
    .eq("id", reference.scope_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Data room scope not found.");

  const room = {
    id: String(data.id),
    name: String(data.name),
  };
  const roomDocuments = await getRoomDocuments(supabaseClient, room.id);

  return buildAiScopeResolution(
    {
      scope_type: "data_room",
      scope_id: reference.scope_id,
      scope_label: room.name,
    },
    roomDocuments,
  );
};

const getOwnedIds = async (
  supabaseClient: SupabaseClient,
  table: "decks" | "data_rooms" | "data_room_folders",
  userId: string,
): Promise<string[]> => {
  if (table === "decks") {
    const { data, error } = await supabaseClient
      .from("decks")
      .select("id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => String((row as { id: string }).id));
  }

  if (table === "data_rooms") {
    const { data, error } = await supabaseClient
      .from("data_rooms")
      .select("id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).map((row) => String((row as { id: string }).id));
  }

  const { data, error } = await supabaseClient
    .from("data_room_folders")
    .select("id, data_rooms!inner(user_id)")
    .eq("data_rooms.user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => String((row as { id: string }).id));
};

const getGuestSummaryUsageCount = async (
  supabaseClient: SupabaseClient,
  ipAddress: string,
  now: Date,
): Promise<number> => {
  const windowStart = new Date(
    now.getTime() - AI_SUMMARY_QUOTA_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const { count, error } = await supabaseClient
    .from("ai_guest_usage")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .gte("consumed_at", windowStart.toISOString())
    .lte("consumed_at", now.toISOString());

  if (error) throw error;
  return count ?? 0;
};

const recordGuestSummaryUsage = async (
  supabaseClient: SupabaseClient,
  args: {
    ipAddress: string;
    scopeType: "deck" | "folder" | "data_room";
    scopeId: string;
    contentHash: string;
    now: Date;
  },
) => {
  const { error } = await supabaseClient.from("ai_guest_usage").insert({
    ip_address: args.ipAddress,
    usage_date: args.now.toISOString().slice(0, 10),
    scope_type: args.scopeType,
    scope_id: args.scopeId,
    content_hash: args.contentHash,
    model_identifier: AI_SUMMARY_MODEL_IDENTIFIER,
    model_version: AI_SUMMARY_MODEL_VERSION,
    usage_kind: "summary",
    consumed_at: args.now.toISOString(),
  });

  if (error) throw error;
};

const createRetrievalService = (supabaseClient: SupabaseClient) =>
  createAiRetrievalQueryService({
    async getLatestContentHash(scope) {
      const { data, error } = await supabaseClient
        .from("ai_chunk_embeddings")
        .select("content_hash, updated_at")
        .eq("scope_type", scope.scope_type)
        .eq("scope_id", scope.scope_id)
        .eq("embedding_model", scope.embedding_model)
        .eq("model_version", scope.model_version)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data && typeof data === "object" && "content_hash" in data
        ? String((data as { content_hash?: unknown }).content_hash ?? "")
        : null;
    },
    async getScopeChunks(scope) {
      const { data, error } = await supabaseClient
        .from("ai_chunk_embeddings")
        .select("id, scope_type, scope_id, content_hash, chunk_index, source_label, chunk_text, metadata, repository_score")
        .eq("scope_type", scope.scope_type)
        .eq("scope_id", scope.scope_id)
        .eq("content_hash", scope.content_hash)
        .eq("embedding_model", scope.embedding_model)
        .eq("model_version", scope.model_version)
        .order("chunk_index", { ascending: true });

      if (error) throw error;
      return (data ?? []) as never;
    },
  });

const createChatService = (supabaseClient: SupabaseClient) =>
  createAiChatSessionService({
    async getExactSession(key) {
      const { data, error } = await supabaseClient
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
      return (data ?? null) as never;
    },
    async getLatestScopedSession(key) {
      const { data, error } = await supabaseClient
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
      return (data ?? null) as never;
    },
    async closeScopedSessionsForOtherHashes(key) {
      const { error } = await supabaseClient
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
      const { data, error } = await supabaseClient
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
          created_at: input.now.toISOString(),
          updated_at: input.now.toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;
      return data as never;
    },
    async getMessages(session_id) {
      const { data, error } = await supabaseClient
        .from("ai_chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("message_index", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as never;
    },
    async getLatestMessage(session_id) {
      const { data, error } = await supabaseClient
        .from("ai_chat_messages")
        .select("*")
        .eq("session_id", session_id)
        .order("message_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as never;
    },
    async insertMessage(input) {
      const { data, error } = await supabaseClient
        .from("ai_chat_messages")
        .insert(input)
        .select("*")
        .single();

      if (error) throw error;
      return data as never;
    },
    async touchSession(session_id, last_message_at) {
      const { error } = await supabaseClient
        .from("ai_chat_sessions")
        .update({
          last_message_at,
          updated_at: last_message_at,
        })
        .eq("id", session_id);

      if (error) throw error;
    },
    retrieveSnippets(request) {
      return createRetrievalService(supabaseClient).retrieveSnippets(request);
    },
  });

const countSummaryRowsForOwnedScopes = async (
  supabaseClient: SupabaseClient,
  scopeType: "deck" | "folder" | "data_room",
  scopeIds: string[],
  windowStartIso: string,
  nowIso: string,
): Promise<number> => {
  if (scopeIds.length === 0) return 0;

  const { count, error } = await supabaseClient
    .from("ai_summary_cache")
    .select("id", { count: "exact", head: true })
    .eq("scope_type", scopeType)
    .in("scope_id", scopeIds)
    .in("status", ["ready", "no_content"])
    .gte("generated_at", windowStartIso)
    .lte("generated_at", nowIso);

  if (error) throw error;
  return count ?? 0;
};

const getSignedInUsageCount = async (
  supabaseClient: SupabaseClient,
  userId: string,
  now: Date,
): Promise<number> => {
  const windowStart = new Date(
    now.getTime() - AI_SUMMARY_QUOTA_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const [deckIds, folderIds, roomIds] = await Promise.all([
    getOwnedIds(supabaseClient, "decks", userId),
    getOwnedIds(supabaseClient, "data_room_folders", userId),
    getOwnedIds(supabaseClient, "data_rooms", userId),
  ]);

  const [deckCount, folderCount, roomCount] = await Promise.all([
    countSummaryRowsForOwnedScopes(
      supabaseClient,
      "deck",
      deckIds,
      windowStart.toISOString(),
      now.toISOString(),
    ),
    countSummaryRowsForOwnedScopes(
      supabaseClient,
      "folder",
      folderIds,
      windowStart.toISOString(),
      now.toISOString(),
    ),
    countSummaryRowsForOwnedScopes(
      supabaseClient,
      "data_room",
      roomIds,
      windowStart.toISOString(),
      now.toISOString(),
    ),
  ]);

  return deckCount + folderCount + roomCount;
};

const callOpenAiSummary = async (
  input: AiSummaryGenerateInput,
): Promise<AiSummaryProviderResult> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const systemPrompt =
    input.mode === "aggregate"
      ? "You combine document summaries into one concise investor-facing overview. Preserve cross-document themes, material risks, and open questions."
      : input.mode === "source"
      ? "You summarize one document for a later recursive roll-up. Keep it factual, concise, and easy to merge."
      : "You write concise investor-facing summaries for document scopes.";

  const userPrompt =
    input.mode === "aggregate"
      ? `Scope: ${input.scope.scope_type}\nLabel: ${input.scope.scope_label ?? input.scope.scope_id}\nCombine these source summaries into one concise overview:\n\n${input.content}`
      : input.mode === "source"
      ? `Scope: ${input.scope.scope_type}\nLabel: ${input.scope.scope_label ?? input.scope.scope_id}\nSource ${input.source_index}/${input.total_sources}: ${input.source_title ?? "Untitled"}\nSummarize the following extractable text:\n\n${input.content}`
      : `Scope: ${input.scope.scope_type}\nLabel: ${input.scope.scope_label ?? input.scope.scope_id}\nCreate an initial summary from the following extractable text:\n\n${input.content}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_SUMMARY_MODEL_IDENTIFIER,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? "OpenAI request failed.")
        : "OpenAI request failed.";
    throw new Error(message);
  }

  const typedPayload = payload as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const summaryText = typedPayload.choices?.[0]?.message?.content?.trim() ?? "";

  return {
    summary_text: summaryText,
    usage: {
      input_tokens: typedPayload.usage?.prompt_tokens,
      output_tokens: typedPayload.usage?.completion_tokens,
      total_tokens: typedPayload.usage?.total_tokens,
    },
  };
};

const callOpenAiChat = async (input: {
  summary_text: string | null;
  question: string;
  recent_history: Array<{ role: "user" | "assistant"; content: string }>;
  snippets: AiRetrievedSnippet[];
  scope_type: "deck" | "folder" | "data_room";
  scope_label: string | null;
}): Promise<AiSummaryProviderResult> => {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const systemPrompt =
    "You answer concise investor-facing follow-up questions about the provided summary. Use the summary and retrieved snippets first, then the chat history. Do not invent facts.";
  const contextPrompt = [
    `Scope: ${input.scope_type}`,
    `Label: ${input.scope_label ?? "Untitled"}`,
    input.summary_text ? `Summary:\n${input.summary_text}` : "Summary: unavailable",
    input.snippets.length > 0
      ? `Relevant snippets:\n${input.snippets
          .map((snippet, index) => `Snippet ${index + 1} (${snippet.source_label ?? "Untitled"}):\n${snippet.snippet_text}`)
          .join("\n\n")}`
      : "Relevant snippets: none available",
  ].join("\n");

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextPrompt },
    ...input.recent_history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: input.question },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_CHAT_MODEL_IDENTIFIER,
      messages,
      temperature: 0.2,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? "OpenAI request failed.")
        : "OpenAI request failed.";
    throw new Error(message);
  }

  const typedPayload = payload as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const reply = typedPayload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!reply) {
    throw new Error("AI chat generation returned empty content.");
  }
  return {
    summary_text: reply,
    usage: {
      input_tokens: typedPayload.usage?.prompt_tokens,
      output_tokens: typedPayload.usage?.completion_tokens,
      total_tokens: typedPayload.usage?.total_tokens,
    },
  };
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartedAt = Date.now();
  let telemetryContext: Record<string, unknown> = {
    method: request.method,
  };

  try {
    const supabaseClient = getServiceClient();
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "summarize";
    const scopeType =
      typeof body.scope_type === "string" ? body.scope_type : null;
    const scopeId = typeof body.scope_id === "string" ? body.scope_id : null;

    telemetryContext = {
      ...telemetryContext,
      action,
      scope_type: scopeType,
      scope_id: scopeId,
    };

    if (
      !scopeType ||
      !scopeId ||
      !["deck", "folder", "data_room"].includes(scopeType)
    ) {
      return new Response(
        JSON.stringify({
          error: true,
          code: "INVALID_REQUEST",
          message: "scope_type and scope_id are required.",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const cacheService = createAiSummaryCacheServiceWithRetry({
      async getExactCacheRow(key) {
        const { data, error } = await supabaseClient
          .from("ai_summary_cache")
          .select("*")
          .eq("scope_type", key.scope_type)
          .eq("scope_id", key.scope_id)
          .eq("content_hash", key.content_hash)
          .eq("model_identifier", key.model_identifier)
          .eq("model_version", key.model_version)
          .maybeSingle();
        if (error) throw error;
        return data as never;
      },
      async getLatestCacheRow(key) {
        const { data, error } = await supabaseClient
          .from("ai_summary_cache")
          .select("*")
          .eq("scope_type", key.scope_type)
          .eq("scope_id", key.scope_id)
          .eq("model_identifier", key.model_identifier)
          .eq("model_version", key.model_version)
          .order("updated_at", { ascending: false })
          .maybeSingle();
        if (error) throw error;
        return data as never;
      },
      async upsertCacheRow(input) {
        const { error } = await supabaseClient
          .from("ai_summary_cache")
          .upsert(
            {
              scope_type: input.scope_type,
              scope_id: input.scope_id,
              content_hash: input.content_hash,
              model_identifier: input.model_identifier,
              model_version: input.model_version,
              status: input.status,
              summary_text: input.summary_text ?? null,
              summary_metadata: input.summary_metadata ?? {},
              error_message: input.error_message ?? null,
              expires_at: input.expires_at?.toISOString() ?? null,
              generated_at:
                input.generated_at?.toISOString() ??
                (input.status === "pending" ? null : (input.now ?? new Date()).toISOString()),
              last_accessed_at: (input.last_accessed_at ?? input.now ?? new Date()).toISOString(),
              updated_at: (input.now ?? new Date()).toISOString(),
            },
            {
              onConflict:
                "scope_type,scope_id,content_hash,model_identifier,model_version",
            },
          );
        if (error) throw error;
      },
      async markStaleRows(key) {
        const { error } = await supabaseClient
          .from("ai_summary_cache")
          .update({
            status: "stale",
            updated_at: new Date().toISOString(),
          })
          .eq("scope_type", key.scope_type)
          .eq("scope_id", key.scope_id)
          .eq("model_identifier", key.model_identifier)
          .eq("model_version", key.model_version)
          .neq("content_hash", key.content_hash);
        if (error) throw error;
      },
    }, (operation) => operation());

    if (action === "chat") {
      const authenticatedUser = await getAuthenticatedUser(supabaseClient, request);
      if (!authenticatedUser) {
        return new Response(
          JSON.stringify({ error: true, code: "UNAUTHORIZED", message: "Authentication required." }),
          { status: 401, headers: corsHeaders },
        );
      }

      const question = typeof body.question === "string" ? body.question.trim() : "";
      const contentHash = typeof body.content_hash === "string" ? body.content_hash.trim() : "";
      if (!question || !contentHash) {
        return new Response(
          JSON.stringify({
            error: true,
            code: "INVALID_REQUEST",
            message: "question and content_hash are required.",
          }),
          { status: 400, headers: corsHeaders },
        );
      }

      await getSignedInActor(supabaseClient, authenticatedUser.id);
      const chatService = createChatService(supabaseClient);
      const now = new Date();
      const summaryCacheLookup = await cacheService.lookupCache(
        {
          scope_type: scopeType as AiScopeReference["scope_type"],
          scope_id: scopeId,
          content_hash: contentHash,
          model_identifier: AI_SUMMARY_MODEL_IDENTIFIER,
          model_version: AI_SUMMARY_MODEL_VERSION,
        },
        now,
      );

      const summaryContext = {
        summary_cache_id: summaryCacheLookup.cache_row?.id ?? null,
        summary_text:
          summaryCacheLookup.summary_text ??
          (typeof body.summary_text === "string" ? body.summary_text : null),
      };

      logAiTelemetry("chat_requested", {
        ...telemetryContext,
        auth_state: "signed_in",
        user_id: authenticatedUser.id,
        cache_state: summaryCacheLookup.state,
        has_summary_context: Boolean(summaryContext.summary_text),
      });

      const context = await chatService.assembleFollowUpContext({
        scope_type: scopeType as AiScopeReference["scope_type"],
        scope_id: scopeId,
        content_hash: contentHash,
        question,
        actor: {
          auth_state: "signed_in",
          user_id: authenticatedUser.id,
        },
        title: typeof body.title === "string" ? body.title : null,
        summary_context: summaryContext,
        retrieval: {
          embedding_model: "text-embedding-3-small",
          model_version: "2026-05-02",
          max_results: AI_RETRIEVAL_MAX_RESULTS,
          max_characters: AI_RETRIEVAL_MAX_CHARACTERS,
          max_candidates: AI_RETRIEVAL_MAX_CANDIDATES,
        },
        history_limit: 12,
        now,
      });

      const answer = await callOpenAiChat({
        summary_text: context.summary_context.summary_text,
        question: context.prompt_context.question,
        recent_history: context.recent_history.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
        snippets: context.retrieval.snippets,
        scope_type: context.session.scope_type,
        scope_label: context.session.title ?? (typeof body.title === "string" ? body.title : null),
      });

      const userMessage = await chatService.appendMessage({
        session: context.session,
        role: "user",
        content: question,
        created_at: now,
      });

      const assistantMessage = await chatService.appendMessage({
        session: context.session,
        role: "assistant",
        content: answer.summary_text,
        retrieval_context: context.retrieval.snippets,
        model_identifier: AI_CHAT_MODEL_IDENTIFIER,
        model_version: AI_CHAT_MODEL_VERSION,
        created_at: now,
      });

      logAiTelemetry("chat_completed", {
        ...telemetryContext,
        auth_state: "signed_in",
        user_id: authenticatedUser.id,
        session_id: context.session.id,
        content_hash: contentHash,
        cache_state: summaryCacheLookup.state,
        retrieval_count: context.retrieval.snippets.length,
        duration_ms: Date.now() - requestStartedAt,
      });

      return new Response(
        JSON.stringify({
          scope_type: scopeType,
          scope_id: scopeId,
          content_hash: contentHash,
          summary_text: summaryContext.summary_text,
          session_id: context.session.id,
          messages: [
            { id: userMessage.id, role: "user", content: userMessage.content },
            { id: assistantMessage.id, role: "assistant", content: assistantMessage.content },
          ],
          assistant_message: {
            id: assistantMessage.id,
            role: "assistant",
            content: assistantMessage.content,
          },
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    const authenticatedUser = await getAuthenticatedUser(supabaseClient, request);

    if (!authenticatedUser) {
      if (scopeType !== "deck") {
        return new Response(
          JSON.stringify({
            error: true,
            code: "FORBIDDEN",
            message: "Guest summaries are available for decks only.",
          }),
          { status: 403, headers: corsHeaders },
        );
      }

      const ipAddress = getClientIpAddress(request);
      const actor = getGuestActor(ipAddress);
      const guestCacheService = cacheService;
      const orchestrator = createAiSummaryInitialOrchestrator({
        resolveScope: (reference) =>
          reference.scope_type === "deck"
            ? getScopeResolutionFromPublicDeck(supabaseClient, reference.scope_id)
            : Promise.reject(new Error("Unsupported guest scope.")),
        lookupCache: (key, currentNow) => guestCacheService.lookupCache(key, currentNow),
        writeCache: (input) => guestCacheService.writeCache(input),
        getUsageCount: (_, currentNow) => getGuestSummaryUsageCount(supabaseClient, ipAddress, currentNow),
        recordUsage: (_, cacheKey, consumedAt) =>
          recordGuestSummaryUsage(supabaseClient, {
            ipAddress,
            scopeType: cacheKey.scope_type,
            scopeId: cacheKey.scope_id,
            contentHash: cacheKey.content_hash,
            now: consumedAt,
          }),
        generateSummary: callOpenAiSummary,
      });

      logAiTelemetry("summary_requested", {
        ...telemetryContext,
        auth_state: "guest",
      });

      const result = await orchestrator.summarize({
        scope_type: "deck",
        scope_id: scopeId,
        actor,
        model_identifier: AI_SUMMARY_MODEL_IDENTIFIER,
        model_version: AI_SUMMARY_MODEL_VERSION,
      });

      logAiTelemetry("summary_resolved", {
        ...telemetryContext,
        auth_state: "guest",
        status: result.status,
        cache_state: result.cache.state,
        cache_hit: result.cache.hit,
        cached_reopen: result.cache.cached_reopen,
        should_regenerate: result.cache.should_regenerate,
        content_hash: result.scope.content_hash,
        partial_data: result.partial_data,
        no_content: result.no_content,
        usage_count: result.usage.usage_count,
        quota_allowed: result.usage.quota?.allowed ?? null,
        quota_limit: result.usage.quota?.limitPer24Hours ?? null,
        quota_remaining: result.usage.quota?.remaining ?? null,
        duration_ms: Date.now() - requestStartedAt,
      });

      const statusCode =
        result.status === "quota_limited"
          ? 429
          : result.status === "generating"
          ? 202
          : 200;

      return new Response(JSON.stringify(result), {
        status: statusCode,
        headers: corsHeaders,
      });
    }

    const actor = await getSignedInActor(supabaseClient, authenticatedUser.id);
    const orchestrator = createAiSummaryInitialOrchestrator({
      resolveScope: (reference) =>
        resolveSignedInScope(supabaseClient, reference, authenticatedUser.id),
      lookupCache: (key, currentNow) => cacheService.lookupCache(key, currentNow),
      writeCache: (input) => cacheService.writeCache(input),
      getUsageCount: (_, currentNow) =>
        getSignedInUsageCount(supabaseClient, authenticatedUser.id, currentNow),
      generateSummary: callOpenAiSummary,
    });

    logAiTelemetry("summary_requested", {
      ...telemetryContext,
      auth_state: "signed_in",
      user_id: authenticatedUser.id,
    });

    const result = await orchestrator.summarize({
      scope_type: scopeType as AiScopeReference["scope_type"],
      scope_id: scopeId,
      actor,
      model_identifier: AI_SUMMARY_MODEL_IDENTIFIER,
      model_version: AI_SUMMARY_MODEL_VERSION,
    });

    logAiTelemetry("summary_resolved", {
      ...telemetryContext,
      auth_state: "signed_in",
      user_id: authenticatedUser.id,
      status: result.status,
      cache_state: result.cache.state,
      cache_hit: result.cache.hit,
      cached_reopen: result.cache.cached_reopen,
      should_regenerate: result.cache.should_regenerate,
      content_hash: result.scope.content_hash,
      partial_data: result.partial_data,
      no_content: result.no_content,
      usage_count: result.usage.usage_count,
      quota_allowed: result.usage.quota?.allowed ?? null,
      quota_limit: result.usage.quota?.limitPer24Hours ?? null,
      quota_remaining: result.usage.quota?.remaining ?? null,
      duration_ms: Date.now() - requestStartedAt,
    });

    const statusCode =
      result.status === "quota_limited"
        ? 429
        : result.status === "generating"
        ? 202
        : 200;

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    logAiTelemetry("request_failed", {
      ...telemetryContext,
      error_message: message,
      duration_ms: Date.now() - requestStartedAt,
    });
    return new Response(
      JSON.stringify({
        error: true,
        code: "INTERNAL_ERROR",
        message,
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
