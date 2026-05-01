-- Normalize legacy staging drift back to the Deckly canonical baseline.
-- This keeps future `supabase db diff --linked` output focused on real changes.

BEGIN;

-- Remove legacy objects that are not part of the current local baseline.
DROP EXTENSION IF EXISTS pg_net;
ALTER TABLE public.library_folders
    DROP CONSTRAINT IF EXISTS library_folders_name_check;

-- Branding: Deckly uses UUID primary keys, a fixed room-name default, and a
-- required user_id ownership link.
ALTER TABLE public.branding
    DROP CONSTRAINT IF EXISTS branding_pkey;

ALTER TABLE public.branding
    ALTER COLUMN id DROP IDENTITY IF EXISTS;

ALTER TABLE public.branding
    ALTER COLUMN id TYPE uuid USING extensions.uuid_generate_v4(),
    ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4(),
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN room_name SET DEFAULT 'Deckly Data Room',
    ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.branding
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.branding
    ADD CONSTRAINT branding_pkey PRIMARY KEY (id);

-- Decks: restore the canonical owner-required shape and the default display order.
ALTER TABLE public.decks
    ALTER COLUMN id SET DEFAULT extensions.uuid_generate_v4(),
    ALTER COLUMN user_id DROP DEFAULT,
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN file_url DROP NOT NULL,
    ALTER COLUMN display_order SET DEFAULT 1,
    ALTER COLUMN updated_at SET DEFAULT now();

-- Analytics: restore non-null deck ownership and the default location placeholders.
UPDATE public.deck_page_views
SET country = 'Unknown'
WHERE country IS NULL;

UPDATE public.deck_page_views
SET city = 'Unknown City'
WHERE city IS NULL;

ALTER TABLE public.deck_page_views
    ALTER COLUMN deck_id SET NOT NULL,
    ALTER COLUMN country SET DEFAULT 'Unknown',
    ALTER COLUMN city SET DEFAULT 'Unknown City';

UPDATE public.deck_stats ds
SET user_id = d.user_id
FROM public.decks d
WHERE ds.user_id IS NULL
  AND ds.deck_id = d.id;

ALTER TABLE public.deck_stats
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'deck_stats_user_id_fkey'
    ) THEN
        ALTER TABLE public.deck_stats
            DROP CONSTRAINT deck_stats_user_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_deck_stats_profiles'
    ) THEN
        ALTER TABLE public.deck_stats
            DROP CONSTRAINT fk_deck_stats_profiles;
    END IF;
END $$;

ALTER TABLE public.deck_stats
    ADD CONSTRAINT fk_deck_stats_profiles
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Storage policy names: reassert the canonical Deckly policy set so the
-- linked database matches the repo's current naming.
DROP POLICY IF EXISTS "Authenticated users can upload to their own decks folder" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own decks folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    (
        COALESCE((metadata->>'size')::bigint, 0) <=
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
    )
);

DROP POLICY IF EXISTS "Authenticated users can update their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own deck files"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    (
        COALESCE((metadata->>'size')::bigint, 0) <=
        COALESCE((SELECT max_file_size_bytes FROM public.get_current_user_tier_limit()), 10485760)
    )
);

DROP POLICY IF EXISTS "Authenticated users can delete their own deck files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own deck files"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Anyone can read decks bucket" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read their own deck files" ON storage.objects;
CREATE POLICY "Owners can read their own deck files"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'decks' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Authenticated users can upload to their own assets folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Uploads to Assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow User Management for Assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public storage access" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access for Assets" ON storage.objects;
CREATE POLICY "Authenticated users can upload to their own assets folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Authenticated users can update their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can update their own asset files"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
)
WITH CHECK (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1] AND
    COALESCE((metadata->>'size')::bigint, 0) <= 5242880
);

DROP POLICY IF EXISTS "Authenticated users can delete their own asset files" ON storage.objects;
CREATE POLICY "Authenticated users can delete their own asset files"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'assets' AND
    (select auth.uid())::text = (string_to_array(name, '/'))[1]
);

DROP POLICY IF EXISTS "Anyone can read assets bucket" ON storage.objects;
CREATE POLICY "Anyone can read assets bucket"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'assets');

COMMIT;
