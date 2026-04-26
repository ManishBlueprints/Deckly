-- Deck-level tags for Content should stay independent from Saved Deck tags.

CREATE TABLE IF NOT EXISTS public.deck_tags (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.global_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (deck_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_deck_tags_deck_id
    ON public.deck_tags (deck_id);

CREATE INDEX IF NOT EXISTS idx_deck_tags_tag_id
    ON public.deck_tags (tag_id);

ALTER TABLE public.deck_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage deck tags" ON public.deck_tags;
CREATE POLICY "Owners can manage deck tags" ON public.deck_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.decks d
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE d.id = deck_id
          AND d.user_id = (SELECT auth.uid())
          AND gt.user_id = d.user_id
          AND gt.deleted_at IS NULL
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.decks d
        JOIN public.global_tags gt ON gt.id = tag_id
        WHERE d.id = deck_id
          AND d.user_id = (SELECT auth.uid())
          AND gt.user_id = d.user_id
          AND gt.deleted_at IS NULL
    ));

-- Backfill existing deck tags so the Content page keeps showing historical tags,
-- but future updates will use deck_tags instead of investor_library.
INSERT INTO public.deck_tags (deck_id, tag_id, created_at, updated_at)
SELECT DISTINCT
    il.deck_id,
    ldt.tag_id,
    COALESCE(il.created_at, now()),
    COALESCE(il.created_at, now())
FROM public.investor_library il
JOIN public.library_deck_tags ldt
    ON ldt.library_id = il.id
ON CONFLICT (deck_id, tag_id) DO NOTHING;
