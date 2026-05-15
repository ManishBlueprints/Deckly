BEGIN;

ALTER TABLE public.deck_links
    ADD COLUMN IF NOT EXISTS link_name TEXT,
    ADD COLUMN IF NOT EXISTS link_alias TEXT;

UPDATE public.deck_links dl
SET link_name = CASE
        WHEN dl.is_primary THEN 'Default Link'
        ELSE 'Link'
    END,
    link_alias = CASE
        WHEN dl.is_primary THEN d.slug
        ELSE dl.link_alias
    END,
    updated_at = NOW()
FROM public.decks d
WHERE d.id = dl.deck_id
  AND (dl.link_name IS NULL OR (dl.is_primary AND dl.link_alias IS NULL));

ALTER TABLE public.deck_links
    ALTER COLUMN link_name SET NOT NULL;

ALTER TABLE public.deck_links
    ADD CONSTRAINT deck_links_link_name_nonempty_check
        CHECK (length(trim(link_name)) > 0),
    ADD CONSTRAINT deck_links_link_alias_format_check
        CHECK (link_alias IS NULL OR link_alias ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_deck_alias
    ON public.deck_links(deck_id, link_alias)
    WHERE link_alias IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_decks_public(TEXT);
DROP FUNCTION IF EXISTS public.get_decks_public(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_decks_public(
    p_handle TEXT DEFAULT NULL,
    p_slug_or_alias TEXT DEFAULT NULL,
    p_link_token TEXT DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT DISTINCT
    d.id,
    d.user_id,
    d.title,
    d.slug,
    d.description,
    d.status,
    d.file_size,
    d.display_order,
    d.require_email,
    d.require_password,
    d.expires_at,
    d.created_at,
    d.updated_at,
    d.file_type,
    d.display_mode,
    p.handle AS user_handle
FROM public.decks d
JOIN public.profiles p ON d.user_id = p.id
LEFT JOIN public.deck_links dl ON dl.deck_id = d.id
WHERE d.status <> 'DELETED'
  AND (d.expires_at IS NULL OR d.expires_at > NOW())
  AND (p_handle IS NULL OR p.handle = p_handle)
  AND (
    (
      p_link_token IS NULL
      AND p_slug_or_alias = d.slug
      AND EXISTS (
        SELECT 1
        FROM public.deck_links primary_link
        WHERE primary_link.deck_id = d.id
          AND primary_link.is_primary = TRUE
          AND primary_link.is_enabled = TRUE
      )
    )
    OR
    (
      p_link_token IS NOT NULL
      AND dl.public_token = p_link_token
      AND dl.is_enabled = TRUE
      AND (p_slug_or_alias = d.slug OR p_slug_or_alias = dl.link_alias)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_decks_public()
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_size bigint,
    display_order integer,
    require_email boolean,
    require_password boolean,
    expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    file_type text,
    display_mode text,
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT *
FROM public.get_decks_public(NULL, NULL, NULL);
$$;

GRANT EXECUTE ON FUNCTION public.get_decks_public(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMIT;
