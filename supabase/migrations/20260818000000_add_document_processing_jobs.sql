-- Durable, provider-backed document processing.
-- Jobs are intentionally private to service-role Edge Functions; browser clients only
-- receive sanitised status through the document-processing API.

ALTER TABLE public.tier_limits
  ADD COLUMN IF NOT EXISTS max_viewable_document_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS max_document_pages INTEGER;

UPDATE public.tier_limits
SET
  max_viewable_document_size_bytes = CASE tier
    WHEN 'FREE' THEN 52428800
    WHEN 'PRO' THEN 52428800
    WHEN 'PRO_PLUS' THEN 209715200
    WHEN 'RAISE' THEN 209715200
  END,
  max_document_pages = 500,
  updated_at = NOW()
WHERE tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE');

ALTER TABLE public.tier_limits
  ALTER COLUMN max_viewable_document_size_bytes SET NOT NULL,
  ALTER COLUMN max_document_pages SET NOT NULL,
  DROP CONSTRAINT IF EXISTS tier_limits_viewable_document_size_check,
  ADD CONSTRAINT tier_limits_viewable_document_size_check
    CHECK (max_viewable_document_size_bytes > 0),
  DROP CONSTRAINT IF EXISTS tier_limits_document_pages_check,
  ADD CONSTRAINT tier_limits_document_pages_check
    CHECK (max_document_pages BETWEEN 1 AND 500);

INSERT INTO public.billing_feature_catalog (
  key, label, description, availability, required_tier, display_order
)
VALUES (
  'office_conversion',
  'Office to PDF conversion',
  'Convert Word, Excel and PowerPoint documents into shareable PDFs.',
  'live',
  'PRO',
  66
)
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  availability = EXCLUDED.availability,
  required_tier = EXCLUDED.required_tier,
  display_order = EXCLUDED.display_order;

INSERT INTO public.billing_tier_features (tier, feature_key, included)
SELECT tier.tier, 'office_conversion', tier.tier_rank >= required.tier_rank
FROM public.tier_limits AS tier
JOIN public.tier_limits AS required ON required.tier = 'PRO'
WHERE tier.tier IN ('FREE', 'PRO', 'PRO_PLUS', 'RAISE')
ON CONFLICT (tier, feature_key) DO UPDATE SET included = EXCLUDED.included;

ALTER TABLE public.decks
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS page_count INTEGER,
  ADD COLUMN IF NOT EXISTS source_filename TEXT,
  ADD COLUMN IF NOT EXISTS content_revision UUID;

-- Direct PDFs are rasterised in the browser, but their publishable metadata
-- must come from a trusted storage inspection rather than the browser's
-- mutable deck payload.  The verification record is short lived and names an
-- immutable, server-created copy of the uploaded source.
CREATE TABLE IF NOT EXISTS public.direct_pdf_verifications (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  page_count INTEGER NOT NULL CHECK (page_count BETWEEN 1 AND 500),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, storage_path)
);

CREATE INDEX IF NOT EXISTS direct_pdf_verifications_expiry_idx
  ON public.direct_pdf_verifications (expires_at);

ALTER TABLE public.direct_pdf_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.direct_pdf_verifications FROM anon, authenticated;

UPDATE public.decks
SET content_revision = gen_random_uuid()
WHERE content_revision IS NULL;

ALTER TABLE public.decks
  ALTER COLUMN content_revision SET DEFAULT gen_random_uuid(),
  ALTER COLUMN content_revision SET NOT NULL,
  DROP CONSTRAINT IF EXISTS decks_page_count_check,
  ADD CONSTRAINT decks_page_count_check
    CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 500) NOT VALID;

CREATE TABLE IF NOT EXISTS public.document_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'cloudconvert'
    CHECK (provider = 'cloudconvert'),
  operation TEXT NOT NULL
    CHECK (operation IN ('office_publish', 'watermark_publish')),
  status TEXT NOT NULL DEFAULT 'awaiting_upload'
    CHECK (status IN (
      'awaiting_upload', 'queued', 'submitting', 'processing', 'validating',
      'publishing', 'completed', 'failed', 'cancelled', 'superseded', 'timed_out'
    )),
  source_path TEXT,
  source_filename TEXT,
  source_file_type TEXT,
  source_size_bytes BIGINT,
  source_content_revision UUID NOT NULL,
  previous_file_url TEXT,
  previous_thumbnail_url TEXT,
  previous_watermarked_file_path TEXT,
  watermark_revision UUID,
  requested_watermark_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  requested_watermark_text TEXT,
  requested_deck_updates JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(requested_deck_updates) = 'object'),
  output_document_path TEXT,
  output_thumbnail_path TEXT,
  output_watermark_path TEXT,
  output_size_bytes BIGINT,
  output_page_count INTEGER,
  reserved_bytes BIGINT NOT NULL DEFAULT 0,
  reserved_credits INTEGER NOT NULL DEFAULT 0,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  provider_job_id TEXT UNIQUE,
  provider_engine TEXT,
  provider_engine_version TEXT,
  provider_task_credits JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_error_code TEXT,
  provider_error_detail TEXT,
  submission_uncertain_at TIMESTAMPTZ,
  deadline_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cleanup_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_size_bytes IS NULL OR source_size_bytes >= 0),
  CHECK (output_size_bytes IS NULL OR output_size_bytes >= 0),
  CHECK (output_page_count IS NULL OR output_page_count BETWEEN 1 AND 500),
  CHECK (reserved_bytes >= 0),
  CHECK (reserved_credits BETWEEN 0 AND 10),
  CHECK (attempt_number BETWEEN 1 AND 3),
  CHECK (
    (requested_watermark_enabled AND char_length(btrim(COALESCE(requested_watermark_text, ''))) BETWEEN 1 AND 80)
    OR (NOT requested_watermark_enabled AND requested_watermark_text IS NULL)
  )
);

CREATE OR REPLACE FUNCTION public.is_document_processing_active(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_status IN ('awaiting_upload', 'queued', 'submitting', 'processing', 'validating', 'publishing');
$$;

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_jobs_one_active_revision
  ON public.document_processing_jobs (deck_id, operation, source_content_revision, COALESCE(watermark_revision, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE public.is_document_processing_active(status);

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_jobs_one_active_operation
  ON public.document_processing_jobs (deck_id, operation)
  WHERE public.is_document_processing_active(status);

CREATE UNIQUE INDEX IF NOT EXISTS document_processing_jobs_revision_attempt_key
  ON public.document_processing_jobs (
    deck_id, operation, source_content_revision,
    COALESCE(watermark_revision, '00000000-0000-0000-0000-000000000000'::uuid),
    attempt_number
  );

CREATE INDEX IF NOT EXISTS document_processing_jobs_dispatch_idx
  ON public.document_processing_jobs (status, created_at)
  WHERE public.is_document_processing_active(status);

CREATE INDEX IF NOT EXISTS document_processing_jobs_owner_idx
  ON public.document_processing_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS document_processing_jobs_deadline_idx
  ON public.document_processing_jobs (deadline_at)
  WHERE public.is_document_processing_active(status);

ALTER TABLE public.document_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Service-role functions own all job state.  Keeping this table unreadable to
-- clients prevents provider IDs, signed paths and provider diagnostics leaking.
REVOKE ALL ON public.document_processing_jobs FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.document_processing_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  submissions_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  daily_credit_cap INTEGER NOT NULL DEFAULT 500 CHECK (daily_credit_cap > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.document_processing_settings (singleton)
VALUES (TRUE)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.document_processing_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_processing_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_document_processing_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_document_processing_job ON public.document_processing_jobs;
CREATE TRIGGER tr_touch_document_processing_job
  BEFORE UPDATE ON public.document_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_document_processing_job();

NOTIFY pgrst, 'reload schema';
