-- Normalize legacy non-destructive drift back to the Deckly canonical baseline.
-- This production-safe cleanup intentionally avoids data rewrites and live-table
-- nullability changes. It is limited to policy/name cleanup that should not
-- mutate application data.

BEGIN;

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

COMMIT;
