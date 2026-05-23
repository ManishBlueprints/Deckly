BEGIN;

CREATE OR REPLACE FUNCTION public.append_ai_chat_message(
    p_message_id UUID,
    p_session_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_citations JSONB DEFAULT '[]'::jsonb,
    p_retrieval_context JSONB DEFAULT '[]'::jsonb,
    p_token_count INTEGER DEFAULT NULL,
    p_model_identifier TEXT DEFAULT NULL,
    p_model_version TEXT DEFAULT NULL,
    p_created_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS public.ai_chat_messages
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing public.ai_chat_messages%ROWTYPE;
    v_inserted public.ai_chat_messages%ROWTYPE;
    v_next_index INTEGER;
    v_created_at TIMESTAMPTZ := COALESCE(p_created_at, NOW());
BEGIN
    PERFORM 1
    FROM public.ai_chat_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI chat session % not found', p_session_id
            USING ERRCODE = 'P0002';
    END IF;

    SELECT *
    INTO v_existing
    FROM public.ai_chat_messages
    WHERE id = p_message_id;

    IF FOUND THEN
        IF v_existing.session_id <> p_session_id THEN
            RAISE EXCEPTION 'AI chat message id % already belongs to another session', p_message_id
                USING ERRCODE = '23505';
        END IF;

        UPDATE public.ai_chat_sessions
        SET last_message_at = GREATEST(COALESCE(last_message_at, v_existing.created_at), v_existing.created_at),
            updated_at = GREATEST(updated_at, v_existing.created_at)
        WHERE id = p_session_id;

        RETURN v_existing;
    END IF;

    SELECT COALESCE(MAX(message_index), -1) + 1
    INTO v_next_index
    FROM public.ai_chat_messages
    WHERE session_id = p_session_id;

    INSERT INTO public.ai_chat_messages (
        id,
        session_id,
        message_index,
        role,
        content,
        citations,
        retrieval_context,
        token_count,
        model_identifier,
        model_version,
        created_at
    )
    VALUES (
        p_message_id,
        p_session_id,
        v_next_index,
        p_role,
        p_content,
        COALESCE(p_citations, '[]'::jsonb),
        COALESCE(p_retrieval_context, '[]'::jsonb),
        p_token_count,
        p_model_identifier,
        p_model_version,
        v_created_at
    )
    RETURNING *
    INTO v_inserted;

    UPDATE public.ai_chat_sessions
    SET last_message_at = v_inserted.created_at,
        updated_at = v_inserted.created_at
    WHERE id = p_session_id;

    RETURN v_inserted;
END;
$$;

COMMIT;
