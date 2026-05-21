BEGIN;

CREATE TABLE IF NOT EXISTS public.deck_links (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    public_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT deck_links_public_token_format_check CHECK (public_token ~ '^[a-f0-9]{32}$')
);

CREATE INDEX IF NOT EXISTS idx_deck_links_deck_id ON public.deck_links(deck_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_public_token ON public.deck_links(public_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deck_links_one_primary_per_deck
    ON public.deck_links(deck_id)
    WHERE is_primary;

ALTER TABLE public.deck_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage deck links" ON public.deck_links;
CREATE POLICY "Owners can manage deck links" ON public.deck_links
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
              AND d.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.decks d
            WHERE d.id = deck_id
              AND d.user_id = (select auth.uid())
        )
    );

COMMIT;
