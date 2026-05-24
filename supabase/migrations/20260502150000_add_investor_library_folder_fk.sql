-- Restore the missing investor-library-to-folder foreign key so PostgREST can
-- resolve embedded selects like `library_folders(..., investor_library(count))`.
-- Older environments created `folder_id` without the FK metadata.

BEGIN;

ALTER TABLE public.investor_library
    ADD COLUMN IF NOT EXISTS folder_id UUID;

UPDATE public.investor_library il
SET folder_id = NULL
WHERE folder_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.library_folders lf
      WHERE lf.id = il.folder_id
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'investor_library_folder_id_fkey'
          AND conrelid = 'public.investor_library'::regclass
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE contype = 'f'
              AND conrelid = 'public.investor_library'::regclass
              AND confrelid = 'public.library_folders'::regclass
        ) THEN
            RETURN;
        END IF;

        ALTER TABLE public.investor_library
            ADD CONSTRAINT investor_library_folder_id_fkey
            FOREIGN KEY (folder_id)
            REFERENCES public.library_folders(id)
            ON DELETE SET NULL
            NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE contype = 'f'
          AND conname = 'investor_library_folder_id_fkey'
          AND conrelid = 'public.investor_library'::regclass
    ) THEN
        ALTER TABLE public.investor_library
            VALIDATE CONSTRAINT investor_library_folder_id_fkey;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_investor_library_folder
    ON public.investor_library(folder_id);

COMMIT;
