BEGIN;

ALTER TABLE public.decks
  VALIDATE CONSTRAINT decks_watermark_revision_not_null,
  VALIDATE CONSTRAINT decks_watermark_status_check,
  VALIDATE CONSTRAINT decks_watermark_text_check;

ALTER TABLE public.decks
  ALTER COLUMN watermark_revision SET NOT NULL,
  DROP CONSTRAINT decks_watermark_revision_not_null;

COMMIT;
