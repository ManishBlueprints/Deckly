BEGIN;

CREATE OR REPLACE FUNCTION public.replace_ai_chunk_embeddings_atomic(
    p_scope_type TEXT,
    p_scope_id UUID,
    p_content_hash TEXT,
    p_embedding_model TEXT,
    p_model_version TEXT,
    p_rows JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_scope_type NOT IN ('deck', 'folder', 'data_room') THEN
        RAISE EXCEPTION 'Unsupported AI scope type: %', p_scope_type;
    END IF;

    IF p_scope_type = 'deck' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = p_scope_id
              AND d.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Deck scope not found or access denied';
        END IF;
    ELSIF p_scope_type = 'folder' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.data_room_folders f
            INNER JOIN public.data_rooms r ON r.id = f.data_room_id
            WHERE f.id = p_scope_id
              AND r.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Folder scope not found or access denied';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1
            FROM public.data_rooms r
            WHERE r.id = p_scope_id
              AND r.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'Data room scope not found or access denied';
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext(p_scope_type || ':' || p_scope_id::text),
        hashtext(p_embedding_model || ':' || p_model_version)
    );

    DELETE FROM public.ai_chunk_embeddings
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id
      AND embedding_model = p_embedding_model
      AND model_version = p_model_version
      AND content_hash <> p_content_hash;

    DELETE FROM public.ai_chunk_embeddings
    WHERE scope_type = p_scope_type
      AND scope_id = p_scope_id
      AND embedding_model = p_embedding_model
      AND model_version = p_model_version
      AND content_hash = p_content_hash;

    SELECT COUNT(*)::INTEGER
    INTO v_row_count
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb));

    IF v_row_count = 0 THEN
        RETURN;
    END IF;

    INSERT INTO public.ai_chunk_embeddings (
        scope_type,
        scope_id,
        content_hash,
        chunk_index,
        source_label,
        chunk_text,
        embedding_model,
        model_version,
        embedding,
        metadata
    )
    SELECT
        p_scope_type,
        p_scope_id,
        p_content_hash,
        row.chunk_index,
        row.source_label,
        row.chunk_text,
        p_embedding_model,
        p_model_version,
        row.embedding::vector,
        COALESCE(row.metadata, '{}'::jsonb)
    FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb)) AS row(
        chunk_index INTEGER,
        source_label TEXT,
        chunk_text TEXT,
        embedding TEXT,
        metadata JSONB
    )
    ON CONFLICT (scope_type, scope_id, content_hash, chunk_index, embedding_model, model_version)
    DO UPDATE SET
        source_label = EXCLUDED.source_label,
        chunk_text = EXCLUDED.chunk_text,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_ai_chunk_embeddings_atomic(TEXT, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_ai_chunk_embeddings_atomic(TEXT, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;

COMMIT;
