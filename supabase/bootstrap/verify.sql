DO $$
BEGIN
  IF to_regclass('public.decks') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.decks';
  END IF;

  IF to_regclass('public.branding') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.branding';
  END IF;

  IF to_regclass('public.data_rooms') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.data_rooms';
  END IF;

  IF to_regclass('public.deck_stats') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.deck_stats';
  END IF;

  IF to_regclass('public.deck_page_views') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.deck_page_views';
  END IF;

  IF to_regclass('public.admin_emails') IS NULL THEN
    RAISE EXCEPTION 'Missing table: public.admin_emails';
  END IF;

  IF to_regprocedure('public.get_decks_public()') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.get_decks_public()';
  END IF;

  IF to_regprocedure('public.get_owner_thumbnails()') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.get_owner_thumbnails()';
  END IF;

  IF to_regprocedure('public.cleanup_signup_throttle()') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.cleanup_signup_throttle()';
  END IF;

  IF to_regprocedure('public.enforce_deck_creation_limit()') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.enforce_deck_creation_limit()';
  END IF;

  IF to_regprocedure('public.enforce_data_room_capacity()') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.enforce_data_room_capacity()';
  END IF;

  IF to_regprocedure('public.is_admin(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing function: public.is_admin(uuid)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'decks'
      AND name = 'decks'
      AND public = false
  ) THEN
    RAISE EXCEPTION 'Missing or incorrect storage bucket: decks';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'assets'
      AND name = 'assets'
      AND public = true
  ) THEN
    RAISE EXCEPTION 'Missing or incorrect storage bucket: assets';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload to their own decks folder'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can upload to their own decks folder';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update their own deck files'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can update their own deck files';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete their own deck files'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can delete their own deck files';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Owners can read their own deck files'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Owners can read their own deck files';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload to their own assets folder'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can upload to their own assets folder';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can update their own asset files'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can update their own asset files';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated users can delete their own asset files'
  ) THEN
    RAISE EXCEPTION 'Missing storage policy: Authenticated users can delete their own asset files';
  END IF;
END $$;
