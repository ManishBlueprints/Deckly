BEGIN;

CREATE OR REPLACE FUNCTION public.claim_ai_summary_cache_pending(
    p_scope_type TEXT,
    p_scope_id UUID,
    p_content_hash TEXT,
    p_model_identifier TEXT,
    p_model_version TEXT,
    p_summary_metadata JSONB,
    p_last_accessed_at TIMESTAMPTZ,
    p_updated_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted_count INTEGER;
    v_updated_count INTEGER;
BEGIN
    INSERT INTO public.ai_summary_cache (
        scope_type,
        scope_id,
        content_hash,
        model_identifier,
        model_version,
        status,
        summary_text,
        summary_metadata,
        error_message,
        expires_at,
        generated_at,
        last_accessed_at,
        created_at,
        updated_at
    )
    VALUES (
        p_scope_type,
        p_scope_id,
        p_content_hash,
        p_model_identifier,
        p_model_version,
        'pending',
        NULL,
        COALESCE(p_summary_metadata, '{}'::jsonb),
        NULL,
        NULL,
        NULL,
        p_last_accessed_at,
        p_updated_at,
        p_updated_at
    )
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    IF v_inserted_count > 0 THEN
        RETURN TRUE;
    END IF;

    UPDATE public.ai_summary_cache
    SET status = 'pending',
        summary_text = NULL,
        summary_metadata = COALESCE(p_summary_metadata, '{}'::jsonb),
        error_message = NULL,
        expires_at = NULL,
        generated_at = NULL,
        last_accessed_at = p_last_accessed_at,
        updated_at = p_updated_at
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id
      AND content_hash = p_content_hash
      AND model_identifier = p_model_identifier
      AND model_version = p_model_version
      AND status IN ('error', 'stale', 'no_content');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count > 0;
END;
$$;

COMMIT;
