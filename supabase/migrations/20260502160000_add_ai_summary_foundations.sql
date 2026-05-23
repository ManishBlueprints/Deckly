-- AI summarization foundations: cache, chat sessions/messages, guest usage,
-- and vector-backed chunk storage for deck/folder/data_room scopes.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.ai_summary_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('deck', 'folder', 'data_room')),
    scope_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    model_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'error', 'stale', 'no_content')),
    summary_text TEXT,
    summary_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    expires_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope_type, scope_id, content_hash, model_identifier, model_version)
);

ALTER TABLE public.ai_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_scope_recent
    ON public.ai_summary_cache(scope_type, scope_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_expires_at
    ON public.ai_summary_cache(expires_at);

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('deck', 'folder', 'data_room')),
    scope_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    summary_cache_id UUID REFERENCES public.ai_summary_cache(id) ON DELETE SET NULL,
    model_identifier TEXT NOT NULL,
    model_version TEXT NOT NULL,
    session_status TEXT NOT NULL DEFAULT 'active' CHECK (session_status IN ('active', 'closed', 'archived')),
    title TEXT,
    last_message_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_scope
    ON public.ai_chat_sessions(user_id, scope_type, scope_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_scope_recent
    ON public.ai_chat_sessions(scope_type, scope_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_summary_cache
    ON public.ai_chat_sessions(summary_cache_id);

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
    message_index INTEGER NOT NULL CHECK (message_index >= 0),
    role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
    content TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    retrieval_context JSONB NOT NULL DEFAULT '[]'::jsonb,
    token_count INTEGER,
    model_identifier TEXT,
    model_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, message_index)
);

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_created_at
    ON public.ai_chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_role
    ON public.ai_chat_messages(session_id, role);

CREATE TABLE IF NOT EXISTS public.ai_guest_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('deck', 'folder', 'data_room')),
    scope_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    model_version TEXT NOT NULL,
    usage_kind TEXT NOT NULL DEFAULT 'summary' CHECK (usage_kind = 'summary'),
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ip_address, usage_date, usage_kind)
);

ALTER TABLE public.ai_guest_usage ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_guest_usage_scope_recent
    ON public.ai_guest_usage(scope_type, scope_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_ai_guest_usage_content_hash
    ON public.ai_guest_usage(content_hash);

CREATE TABLE IF NOT EXISTS public.ai_chunk_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('deck', 'folder', 'data_room')),
    scope_id UUID NOT NULL,
    content_hash TEXT NOT NULL,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    source_label TEXT,
    chunk_text TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (scope_type, scope_id, content_hash, chunk_index, embedding_model, model_version)
);

ALTER TABLE public.ai_chunk_embeddings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_chunk_embeddings_scope_recent
    ON public.ai_chunk_embeddings(scope_type, scope_id, content_hash, chunk_index);

CREATE INDEX IF NOT EXISTS idx_ai_chunk_embeddings_scope_model
    ON public.ai_chunk_embeddings(scope_type, scope_id, embedding_model, model_version);

CREATE INDEX IF NOT EXISTS idx_ai_chunk_embeddings_embedding
    ON public.ai_chunk_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

COMMIT;
