BEGIN;

CREATE OR REPLACE FUNCTION public.create_deck_with_primary_link(
    p_user_id uuid,
    p_title text,
    p_slug text,
    p_description text,
    p_file_url text,
    p_pages jsonb DEFAULT '[]'::jsonb,
    p_status text DEFAULT 'PENDING',
    p_display_mode text DEFAULT 'raw',
    p_file_size bigint DEFAULT NULL,
    p_file_type text DEFAULT 'pdf',
    p_require_email boolean DEFAULT false,
    p_require_password boolean DEFAULT false,
    p_view_password text DEFAULT NULL,
    p_expires_at timestamptz DEFAULT NULL
)
RETURNS public.decks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    v_deck public.decks;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;

    INSERT INTO public.decks (
        user_id,
        title,
        slug,
        description,
        file_url,
        pages,
        status,
        display_mode,
        file_size,
        file_type,
        require_email,
        require_password,
        view_password,
        expires_at
    )
    VALUES (
        p_user_id,
        p_title,
        p_slug,
        p_description,
        p_file_url,
        p_pages,
        p_status,
        p_display_mode,
        p_file_size,
        p_file_type,
        p_require_email,
        p_require_password,
        p_view_password,
        p_expires_at
    )
    RETURNING * INTO v_deck;

    INSERT INTO public.deck_links (
        deck_id,
        link_name,
        link_alias,
        is_enabled,
        is_primary
    )
    VALUES (
        v_deck.id,
        'Default Link',
        p_slug,
        true,
        true
    );

    RETURN v_deck;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_deck_with_primary_link(
    uuid,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text,
    bigint,
    text,
    boolean,
    boolean,
    text,
    timestamptz
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_deck_with_primary_link(
    uuid,
    text,
    text,
    text,
    text,
    jsonb,
    text,
    text,
    bigint,
    text,
    boolean,
    boolean,
    text,
    timestamptz
) TO authenticated;

COMMIT;
