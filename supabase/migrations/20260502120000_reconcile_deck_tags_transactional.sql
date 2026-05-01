CREATE OR REPLACE FUNCTION public.reconcile_deck_tags(
    p_deck_id UUID,
    p_user_id UUID,
    p_tag_ids UUID[] DEFAULT '{}'::uuid[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    v_next_tag_ids UUID[];
    v_owned_tag_count INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    SELECT ARRAY(
        SELECT DISTINCT tag_id
        FROM unnest(COALESCE(p_tag_ids, '{}'::uuid[])) AS tag_id
        WHERE tag_id IS NOT NULL
    )
    INTO v_next_tag_ids;

    IF NOT EXISTS (
        SELECT 1
        FROM public.decks d
        WHERE d.id = p_deck_id
          AND d.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Deck not found or access denied';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO v_owned_tag_count
    FROM public.global_tags gt
    WHERE gt.id = ANY(COALESCE(v_next_tag_ids, '{}'::uuid[]))
      AND gt.user_id = p_user_id
      AND gt.deleted_at IS NULL;

    IF v_owned_tag_count <> COALESCE(array_length(v_next_tag_ids, 1), 0) THEN
        RAISE EXCEPTION 'One or more tags were not found.';
    END IF;

    DELETE FROM public.deck_tags
    WHERE deck_id = p_deck_id
      AND NOT (tag_id = ANY(COALESCE(v_next_tag_ids, '{}'::uuid[])));

    INSERT INTO public.deck_tags (deck_id, tag_id)
    SELECT p_deck_id, tag_id
    FROM unnest(COALESCE(v_next_tag_ids, '{}'::uuid[])) AS tag_id
    ON CONFLICT (deck_id, tag_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_deck_tags(UUID, UUID, UUID[]) TO authenticated;
