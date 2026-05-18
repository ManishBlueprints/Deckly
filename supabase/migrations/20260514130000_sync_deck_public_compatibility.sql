BEGIN;

CREATE OR REPLACE FUNCTION public.sync_deck_public_compatibility_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_deck_id UUID := COALESCE(NEW.deck_id, OLD.deck_id);
    v_has_enabled_primary BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = v_deck_id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    )
    INTO v_has_enabled_primary;

    UPDATE public.decks d
    SET is_public = v_has_enabled_primary,
        updated_at = NOW()
    WHERE d.id = v_deck_id
      AND d.is_public IS DISTINCT FROM v_has_enabled_primary;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_deck_public_compatibility ON public.deck_links;
CREATE TRIGGER tr_sync_deck_public_compatibility
    AFTER INSERT OR UPDATE OR DELETE ON public.deck_links
    FOR EACH ROW EXECUTE FUNCTION public.sync_deck_public_compatibility_trigger();

-- Backfill one enabled primary link for legacy bare-route public decks, then
-- reconcile decks.is_public so it remains only the enabled-primary mirror.
UPDATE public.deck_links dl
SET is_enabled = TRUE,
    updated_at = NOW()
FROM public.decks d
WHERE d.id = dl.deck_id
  AND d.is_public = TRUE
  AND dl.is_primary = TRUE
  AND dl.is_enabled IS DISTINCT FROM TRUE;

INSERT INTO public.deck_links (deck_id, is_enabled, is_primary)
SELECT d.id, TRUE, TRUE
FROM public.decks d
WHERE d.is_public = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM public.deck_links dl
      WHERE dl.deck_id = d.id
        AND dl.is_primary = TRUE
  );

UPDATE public.decks d
SET is_public = EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    ),
    updated_at = NOW()
WHERE d.is_public IS DISTINCT FROM EXISTS (
        SELECT 1
        FROM public.deck_links dl
        WHERE dl.deck_id = d.id
          AND dl.is_primary = TRUE
          AND dl.is_enabled = TRUE
    );

COMMIT;
