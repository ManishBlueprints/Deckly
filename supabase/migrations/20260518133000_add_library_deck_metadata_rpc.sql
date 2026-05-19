BEGIN;

CREATE OR REPLACE FUNCTION public.get_library_deck_metadata(
    p_deck_ids UUID[]
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    title text,
    slug text,
    description text,
    status text,
    file_type text,
    display_mode text,
    user_handle text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT
    d.id,
    d.user_id,
    d.title,
    d.slug,
    d.description,
    d.status,
    d.file_type,
    d.display_mode,
    p.handle AS user_handle
FROM public.decks d
JOIN public.profiles p ON p.id = d.user_id
WHERE d.id = ANY(COALESCE(p_deck_ids, ARRAY[]::uuid[]))
  AND (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) = d.user_id
    OR (
      d.status <> 'DELETED'
      AND (d.expires_at IS NULL OR d.expires_at > NOW())
      AND EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_library_deck_metadata(UUID[]) TO authenticated;

COMMIT;
