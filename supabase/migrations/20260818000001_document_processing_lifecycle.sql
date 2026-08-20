-- Atomic publishing and public-visibility rules for asynchronous documents.

-- A finalizer supplies a new revision for an Office document whose watermark
-- was created before the deck had a canonical PDF.  Preserve that revision;
-- ordinary owner edits still receive a fresh revision.
CREATE OR REPLACE FUNCTION public.prepare_deck_watermark_artifact()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT NEW.watermark_enabled THEN
    IF TG_OP = 'INSERT'
       OR OLD.watermark_enabled IS DISTINCT FROM NEW.watermark_enabled
       OR OLD.watermark_text IS DISTINCT FROM NEW.watermark_text
       OR OLD.watermarked_file_path IS NOT NULL
       OR OLD.watermark_status IS DISTINCT FROM 'disabled'
       OR OLD.watermark_error IS NOT NULL THEN
      NEW.watermark_text := NULL;
      NEW.watermarked_file_path := NULL;
      NEW.watermark_status := 'disabled';
      NEW.watermark_error := NULL;
      NEW.watermark_updated_at := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.file_type <> 'pdf' THEN
    -- An Office source may carry a requested watermark while it is a private
    -- processing draft.  It never becomes public until the finalizer swaps in
    -- the generated PDF and watermark artifact atomically.
    IF NEW.status = 'PENDING' AND NEW.file_url LIKE NEW.user_id::TEXT || '/processing/%' THEN
      NEW.watermark_text := btrim(NEW.watermark_text);
      NEW.watermark_status := 'pending';
      NEW.watermarked_file_path := NULL;
      NEW.watermark_error := NULL;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Watermarking is only available for PDF decks';
  END IF;

  IF char_length(btrim(COALESCE(NEW.watermark_text, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Watermark text must be between 1 and 80 characters';
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.watermark_enabled IS DISTINCT FROM OLD.watermark_enabled
     OR NEW.watermark_text IS DISTINCT FROM OLD.watermark_text
     OR NEW.file_url IS DISTINCT FROM OLD.file_url
     OR NEW.file_type IS DISTINCT FROM OLD.file_type THEN
    NEW.watermark_text := btrim(NEW.watermark_text);
    IF (TG_OP = 'INSERT' OR NEW.watermark_revision IS NOT DISTINCT FROM OLD.watermark_revision)
       AND current_setting('deckly.preserve_watermark_revision', TRUE) IS DISTINCT FROM 'true' THEN
      NEW.watermark_revision := gen_random_uuid();
    END IF;
    NEW.watermark_status := 'pending';
    NEW.watermarked_file_path := NULL;
    NEW.watermark_error := NULL;
    NEW.watermark_updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_deck_feature_entitlements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_access_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'access_controls');
  v_download_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'deck_downloads');
  v_watermark_allowed BOOLEAN := public.has_live_feature_for_user(NEW.user_id, 'deck_watermarking');
BEGIN
  IF NOT v_access_allowed AND (
    (TG_OP = 'INSERT' AND (NEW.require_email OR NEW.require_password OR NEW.expires_at IS NOT NULL))
    OR (TG_OP = 'UPDATE' AND (
      (NEW.require_email AND NOT OLD.require_email)
      OR (NEW.require_password AND NOT OLD.require_password)
      OR (NEW.expires_at IS NOT NULL AND NEW.expires_at IS DISTINCT FROM OLD.expires_at)
      OR (NEW.require_password AND NEW.view_password IS DISTINCT FROM OLD.view_password)
    ))
  ) THEN
    RAISE EXCEPTION 'Email capture, password protection and expiry require Share or higher';
  END IF;
  IF NOT v_download_allowed AND (
    (TG_OP = 'INSERT' AND NEW.allow_download)
    OR (TG_OP = 'UPDATE' AND NEW.allow_download AND NOT OLD.allow_download)
  ) THEN
    RAISE EXCEPTION 'Download controls require Share or higher';
  END IF;
  IF NOT v_watermark_allowed AND (
    (TG_OP = 'INSERT' AND NEW.watermark_enabled)
    OR (TG_OP = 'UPDATE' AND (
      (NEW.watermark_enabled AND NOT OLD.watermark_enabled)
      OR (NEW.watermark_enabled AND NEW.watermark_text IS DISTINCT FROM OLD.watermark_text)
    ))
  ) THEN
    RAISE EXCEPTION 'Deck watermarking requires the Raise plan';
  END IF;
  IF NEW.watermark_enabled AND COALESCE(NEW.file_type, 'pdf') <> 'pdf'
     AND NOT (NEW.status = 'PENDING' AND NEW.file_url LIKE NEW.user_id::TEXT || '/processing/%') THEN
    RAISE EXCEPTION 'Deck watermarking is currently available for PDF decks only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_document_processing_quota(
  p_user_id UUID,
  p_reserved_credits INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_active_count INTEGER;
  v_hourly_count INTEGER;
  v_daily_reserved INTEGER;
  v_settings public.document_processing_settings;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('document-processing:' || p_user_id::text));
  -- The daily reservation cap is shared by all owners, so this check and the
  -- subsequent reservation must use a global lock as well.
  PERFORM pg_advisory_xact_lock(hashtext('document-processing-global-credit-cap'));
  SELECT * INTO v_settings FROM public.document_processing_settings WHERE singleton FOR UPDATE;
  IF NOT FOUND OR NOT v_settings.submissions_enabled THEN
    RAISE EXCEPTION 'Document processing is temporarily unavailable';
  END IF;
  SELECT count(*) INTO v_active_count
  FROM public.document_processing_jobs
  WHERE user_id = p_user_id
    AND public.is_document_processing_active(status);
  IF v_active_count >= 3 THEN RAISE EXCEPTION 'You already have 3 documents processing'; END IF;
  SELECT count(*) INTO v_hourly_count
  FROM public.document_processing_jobs
  WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '1 hour';
  IF v_hourly_count >= 20 THEN RAISE EXCEPTION 'Document processing limit reached; try again later'; END IF;
  SELECT COALESCE(sum(reserved_credits), 0) INTO v_daily_reserved
  FROM public.document_processing_jobs
  WHERE created_at >= date_trunc('day', NOW());
  IF v_daily_reserved + p_reserved_credits > v_settings.daily_credit_cap THEN
    RAISE EXCEPTION 'Document processing is temporarily unavailable';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_viewable_document_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit public.tier_limits;
  v_page_count INTEGER;
BEGIN
  IF NEW.status = 'DELETED' OR COALESCE(NEW.file_type, 'pdf') <> 'pdf' THEN
    RETURN NEW;
  END IF;
  IF current_setting('deckly.skip_viewable_document_verification', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;
  v_limit := public.get_tier_limit_for_user(NEW.user_id);
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Unable to determine tier limits';
  END IF;
  IF COALESCE(NEW.file_size, 0) > v_limit.max_viewable_document_size_bytes THEN
    RAISE EXCEPTION 'Document exceeds the viewable document size limit';
  END IF;
  v_page_count := CASE
    WHEN jsonb_typeof(COALESCE(NEW.pages, '[]'::jsonb)) = 'array'
      THEN jsonb_array_length(NEW.pages)
    ELSE 0
  END;
  IF v_page_count > v_limit.max_document_pages
     OR COALESCE(NEW.page_count, 0) > v_limit.max_document_pages THEN
    RAISE EXCEPTION 'Document exceeds the page limit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_viewable_document_limits ON public.decks;
CREATE TRIGGER tr_enforce_viewable_document_limits
  BEFORE INSERT OR UPDATE OF file_url, file_size, pages, page_count, file_type ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viewable_document_limits();

CREATE OR REPLACE FUNCTION public.queue_deck_watermark_processing_job(
  p_deck_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_deck public.decks;
BEGIN
  SELECT * INTO v_deck
  FROM public.decks
  WHERE id = p_deck_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND
     OR NOT v_deck.watermark_enabled
     OR v_deck.watermark_status NOT IN ('pending', 'failed')
     OR v_deck.file_type <> 'pdf'
     OR v_deck.file_url IS NULL
     OR NOT public.has_live_feature_for_user(v_deck.user_id, 'deck_watermarking') THEN
    RETURN FALSE;
  END IF;

  IF v_deck.watermark_status = 'failed' THEN
    UPDATE public.decks
    SET watermark_status = 'pending',
        watermark_error = NULL,
        watermark_updated_at = NOW()
    WHERE id = v_deck.id;
  END IF;

  UPDATE public.document_processing_jobs
  SET status = 'superseded', completed_at = NOW(), cleanup_after = NOW() + INTERVAL '1 hour'
  WHERE deck_id = v_deck.id
    AND operation = 'watermark_publish'
    AND public.is_document_processing_active(status);

  PERFORM public.assert_document_processing_quota(v_deck.user_id, 1);
  INSERT INTO public.document_processing_jobs (
    deck_id, user_id, operation, status, source_path, source_filename,
    source_file_type, source_content_revision, watermark_revision,
    requested_watermark_enabled, requested_watermark_text, reserved_credits,
    deadline_at
  ) VALUES (
    v_deck.id, v_deck.user_id, 'watermark_publish', 'queued', v_deck.file_url, v_deck.source_filename,
    'pdf', v_deck.content_revision, v_deck.watermark_revision, TRUE, v_deck.watermark_text, 1,
    NOW() + INTERVAL '60 minutes'
  );
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Queue failures are a retryable watermark-processing result, not a reason
  -- to discard the owner's otherwise valid deck settings change.
  UPDATE public.decks
  SET watermark_status = 'failed',
      watermark_error = LEFT(SQLERRM, 500),
      watermark_updated_at = NOW()
  WHERE id = p_deck_id AND user_id = p_user_id AND watermark_enabled;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_deck_watermark_processing_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF current_setting('deckly.skip_watermark_enqueue', TRUE) = 'true' THEN
    RETURN NEW;
  END IF;
  PERFORM public.queue_deck_watermark_processing_job(NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_enqueue_deck_watermark_processing_job ON public.decks;
CREATE TRIGGER tr_enqueue_deck_watermark_processing_job
  AFTER INSERT OR UPDATE OF watermark_enabled, watermark_text, file_url, file_type ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_deck_watermark_processing_job();

CREATE OR REPLACE FUNCTION public.prepare_office_processing_draft(
  p_user_id UUID,
  p_title TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_source_filename TEXT,
  p_source_file_type TEXT,
  p_source_size_bytes BIGINT,
  p_require_email BOOLEAN DEFAULT FALSE,
  p_require_password BOOLEAN DEFAULT FALSE,
  p_view_password TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_allow_download BOOLEAN DEFAULT FALSE,
  p_watermark_enabled BOOLEAN DEFAULT FALSE,
  p_watermark_text TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, deck_id UUID, source_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_id UUID := gen_random_uuid();
  v_deck_id UUID := gen_random_uuid();
  v_revision UUID := gen_random_uuid();
  v_watermark_revision UUID := CASE WHEN p_watermark_enabled THEN gen_random_uuid() ELSE NULL END;
  v_file_type TEXT := lower(btrim(p_source_file_type));
  v_path TEXT;
  v_limit public.tier_limits;
BEGIN
  IF v_file_type NOT IN ('doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx') THEN
    RAISE EXCEPTION 'Unsupported Office document type';
  END IF;
  IF p_source_size_bytes IS NULL OR p_source_size_bytes <= 0 THEN RAISE EXCEPTION 'Invalid document size'; END IF;
  IF NOT public.has_live_feature_for_user(p_user_id, 'office_conversion') THEN
    RAISE EXCEPTION 'Office conversion requires the Share plan';
  END IF;
  IF p_watermark_enabled AND NOT public.has_live_feature_for_user(p_user_id, 'deck_watermarking') THEN
    RAISE EXCEPTION 'Deck watermarking requires the Raise plan';
  END IF;
  IF p_watermark_enabled AND char_length(btrim(COALESCE(p_watermark_text, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Watermark text must be between 1 and 80 characters';
  END IF;
  v_limit := public.get_tier_limit_for_user(p_user_id);
  IF v_limit IS NULL OR p_source_size_bytes > v_limit.max_viewable_document_size_bytes THEN
    RAISE EXCEPTION 'Document exceeds the viewable document size limit';
  END IF;
  PERFORM public.assert_document_processing_quota(p_user_id, CASE WHEN p_watermark_enabled THEN 6 ELSE 5 END);
  v_path := p_user_id::text || '/processing/' || v_job_id::text || '/source.' || v_file_type;

  INSERT INTO public.decks (
    id, user_id, title, slug, description, file_url, file_size, file_type,
    status, display_mode, pages, require_email, require_password, view_password,
    expires_at, allow_download, source_filename, content_revision,
    watermark_enabled, watermark_text, watermark_revision, watermark_status
  ) VALUES (
    v_deck_id, p_user_id, p_title, p_slug, p_description, v_path, p_source_size_bytes, v_file_type,
    'PENDING', 'raw', '[]'::jsonb, p_require_email, p_require_password, p_view_password,
    p_expires_at, p_allow_download, p_source_filename, v_revision,
    p_watermark_enabled, CASE WHEN p_watermark_enabled THEN btrim(p_watermark_text) ELSE NULL END,
    COALESCE(v_watermark_revision, gen_random_uuid()), CASE WHEN p_watermark_enabled THEN 'pending' ELSE 'disabled' END
  );
  INSERT INTO public.document_processing_jobs (
    id, deck_id, user_id, operation, status, source_path, source_filename,
    source_file_type, source_size_bytes, source_content_revision, watermark_revision,
    requested_watermark_enabled, requested_watermark_text, reserved_bytes, reserved_credits,
    deadline_at, cleanup_after
  ) VALUES (
    v_job_id, v_deck_id, p_user_id, 'office_publish', 'awaiting_upload', v_path, p_source_filename,
    v_file_type, p_source_size_bytes, v_revision, v_watermark_revision,
    p_watermark_enabled, CASE WHEN p_watermark_enabled THEN btrim(p_watermark_text) ELSE NULL END,
    p_source_size_bytes, CASE WHEN p_watermark_enabled THEN 6 ELSE 5 END,
    NOW() + INTERVAL '60 minutes', NOW() + INTERVAL '7 days'
  );
  RETURN QUERY SELECT v_job_id, v_deck_id, v_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_office_processing_replacement(
  p_user_id UUID,
  p_deck_id UUID,
  p_source_filename TEXT,
  p_source_file_type TEXT,
  p_source_size_bytes BIGINT,
  p_title TEXT,
  p_description TEXT,
  p_require_email BOOLEAN,
  p_require_password BOOLEAN,
  p_view_password TEXT,
  p_expires_at TIMESTAMPTZ,
  p_allow_download BOOLEAN,
  p_watermark_enabled BOOLEAN DEFAULT FALSE,
  p_watermark_text TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, source_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job_id UUID := gen_random_uuid();
  v_revision UUID := gen_random_uuid();
  v_watermark_revision UUID := CASE WHEN p_watermark_enabled THEN gen_random_uuid() ELSE NULL END;
  v_deck public.decks;
  v_file_type TEXT := lower(btrim(p_source_file_type));
  v_path TEXT;
  v_limit public.tier_limits;
  v_requested_deck_updates JSONB;
BEGIN
  IF v_file_type NOT IN ('doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx') THEN RAISE EXCEPTION 'Unsupported Office document type'; END IF;
  IF p_source_size_bytes IS NULL OR p_source_size_bytes <= 0 THEN RAISE EXCEPTION 'Invalid document size'; END IF;
  SELECT * INTO v_deck FROM public.decks WHERE id = p_deck_id FOR UPDATE;
  IF NOT FOUND OR v_deck.user_id <> p_user_id OR v_deck.status <> 'PROCESSED' THEN
    RAISE EXCEPTION 'Deck is not available for replacement';
  END IF;
  IF NOT public.has_live_feature_for_user(p_user_id, 'office_conversion') THEN RAISE EXCEPTION 'Office conversion requires the Share plan'; END IF;
  IF p_watermark_enabled AND NOT public.has_live_feature_for_user(p_user_id, 'deck_watermarking') THEN RAISE EXCEPTION 'Deck watermarking requires the Raise plan'; END IF;
  IF p_watermark_enabled AND char_length(btrim(COALESCE(p_watermark_text, ''))) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Watermark text must be between 1 and 80 characters'; END IF;
  v_limit := public.get_tier_limit_for_user(p_user_id);
  IF v_limit IS NULL OR p_source_size_bytes > v_limit.max_viewable_document_size_bytes THEN
    RAISE EXCEPTION 'Document exceeds the viewable document size limit';
  END IF;
  v_requested_deck_updates := jsonb_build_object(
    'title', p_title,
    'description', p_description,
    'require_email', p_require_email,
    'require_password', p_require_password,
    'view_password', CASE
      WHEN p_view_password IS NULL OR btrim(p_view_password) = '' THEN NULL
      WHEN p_view_password LIKE '$2a$%' OR p_view_password LIKE '$2b$%' OR p_view_password LIKE '$2y$%' THEN p_view_password
      ELSE crypt(p_view_password, gen_salt('bf'))
    END,
    'expires_at', p_expires_at,
    'allow_download', p_allow_download
  );
  -- A new source supersedes every active job for the old revision.  The Edge
  -- caller uses the captured provider IDs to cancel those jobs immediately.
  UPDATE public.document_processing_jobs
  SET status = 'superseded', completed_at = NOW(), cleanup_after = NOW() + INTERVAL '1 hour'
  WHERE deck_id = p_deck_id
    AND public.is_document_processing_active(status);
  PERFORM public.assert_document_processing_quota(p_user_id, CASE WHEN p_watermark_enabled THEN 6 ELSE 5 END);
  v_path := p_user_id::text || '/processing/' || v_job_id::text || '/source.' || v_file_type;
  INSERT INTO public.document_processing_jobs (
    id, deck_id, user_id, operation, status, source_path, source_filename,
    source_file_type, source_size_bytes, source_content_revision, watermark_revision,
    requested_watermark_enabled, requested_watermark_text, requested_deck_updates, previous_file_url,
    previous_thumbnail_url, previous_watermarked_file_path, reserved_bytes, reserved_credits,
    deadline_at, cleanup_after
  ) VALUES (
    v_job_id, p_deck_id, p_user_id, 'office_publish', 'awaiting_upload', v_path, p_source_filename,
    v_file_type, p_source_size_bytes, v_revision, v_watermark_revision,
    p_watermark_enabled, CASE WHEN p_watermark_enabled THEN btrim(p_watermark_text) ELSE NULL END, v_requested_deck_updates,
    v_deck.file_url, v_deck.thumbnail_url, v_deck.watermarked_file_path,
    p_source_size_bytes, CASE WHEN p_watermark_enabled THEN 6 ELSE 5 END,
    NOW() + INTERVAL '60 minutes', NOW() + INTERVAL '7 days'
  );
  RETURN QUERY SELECT v_job_id, v_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_document_processing_upload(
  p_job_id UUID,
  p_actual_size_bytes BIGINT
)
RETURNS public.document_processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job public.document_processing_jobs;
  v_limit public.tier_limits;
  v_result public.document_processing_jobs;
BEGIN
  SELECT * INTO v_job FROM public.document_processing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.status <> 'awaiting_upload' THEN RAISE EXCEPTION 'Upload is not awaiting completion'; END IF;
  IF p_actual_size_bytes IS NULL OR p_actual_size_bytes <= 0 THEN RAISE EXCEPTION 'Invalid uploaded document size'; END IF;
  v_limit := public.get_tier_limit_for_user(v_job.user_id);
  IF v_limit IS NULL THEN RAISE EXCEPTION 'Unable to determine tier limits'; END IF;
  IF p_actual_size_bytes > v_limit.max_viewable_document_size_bytes THEN
    RAISE EXCEPTION 'Document exceeds the viewable document size limit';
  END IF;
  UPDATE public.document_processing_jobs
  SET status = 'queued', source_size_bytes = p_actual_size_bytes, reserved_bytes = p_actual_size_bytes
  WHERE id = v_job.id
  RETURNING * INTO v_result;
  UPDATE public.decks
  SET file_size = p_actual_size_bytes
  WHERE id = v_job.deck_id AND status = 'PENDING';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.retry_document_processing_job(
  p_user_id UUID,
  p_job_id UUID,
  p_new_job_id UUID
)
RETURNS public.document_processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_original public.document_processing_jobs;
  v_highest_attempt INTEGER;
  v_source_path TEXT;
  v_result public.document_processing_jobs;
BEGIN
  SELECT * INTO v_original
  FROM public.document_processing_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND OR v_original.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Processing job not found';
  END IF;
  IF v_original.status NOT IN ('failed', 'cancelled', 'timed_out') THEN
    RAISE EXCEPTION 'This document cannot be retried';
  END IF;
  IF v_original.updated_at > NOW() - INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'Wait one minute before retrying this document';
  END IF;
  IF v_original.source_path IS NULL OR v_original.source_file_type IS NULL THEN
    RAISE EXCEPTION 'The original upload has expired. Upload the document again.';
  END IF;

  SELECT COALESCE(MAX(attempt_number), 0) INTO v_highest_attempt
  FROM public.document_processing_jobs
  WHERE deck_id = v_original.deck_id
    AND operation = v_original.operation
    AND source_content_revision = v_original.source_content_revision
    AND watermark_revision IS NOT DISTINCT FROM v_original.watermark_revision;
  IF v_highest_attempt >= 3 THEN
    RAISE EXCEPTION 'This document has reached the three-attempt limit.';
  END IF;

  PERFORM public.assert_document_processing_quota(p_user_id, v_original.reserved_credits);
  v_source_path := p_user_id::TEXT || '/processing/' || p_new_job_id::TEXT || '/source.' || v_original.source_file_type;

  INSERT INTO public.document_processing_jobs (
    id, deck_id, user_id, operation, status, source_path, source_filename,
    source_file_type, source_size_bytes, source_content_revision, watermark_revision,
    requested_watermark_enabled, requested_watermark_text, requested_deck_updates,
    previous_file_url, previous_thumbnail_url, previous_watermarked_file_path,
    reserved_bytes, reserved_credits, attempt_number, deadline_at, cleanup_after
  ) VALUES (
    p_new_job_id, v_original.deck_id, p_user_id, v_original.operation, 'queued', v_source_path, v_original.source_filename,
    v_original.source_file_type, v_original.source_size_bytes, v_original.source_content_revision, v_original.watermark_revision,
    v_original.requested_watermark_enabled, v_original.requested_watermark_text, v_original.requested_deck_updates,
    v_original.previous_file_url, v_original.previous_thumbnail_url, v_original.previous_watermarked_file_path,
    v_original.reserved_bytes, v_original.reserved_credits, v_highest_attempt + 1,
    NOW() + INTERVAL '60 minutes', NOW() + INTERVAL '7 days'
  )
  RETURNING * INTO v_result;

  IF v_original.operation = 'watermark_publish' THEN
    UPDATE public.decks
    SET watermark_status = 'pending',
        watermark_error = NULL,
        watermark_updated_at = NOW()
    WHERE id = v_original.deck_id
      AND watermark_enabled
      AND watermark_revision IS NOT DISTINCT FROM v_original.watermark_revision
      AND content_revision IS NOT DISTINCT FROM v_original.source_content_revision;
  END IF;

  RETURN v_result;
END;
$$;

-- Claiming is the first half of the submission CAS.  The worker must never
-- retry an ambiguous POST; reconciliation finds it using the immutable tag.
CREATE OR REPLACE FUNCTION public.claim_document_processing_jobs(p_limit INTEGER DEFAULT 10)
RETURNS SETOF public.document_processing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT id
    FROM public.document_processing_jobs
    WHERE status = 'queued'
      AND deadline_at > NOW()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50))
  ), claimed AS (
    UPDATE public.document_processing_jobs job
    SET status = 'submitting', started_at = COALESCE(started_at, NOW())
    FROM candidates
    WHERE job.id = candidates.id
    RETURNING job.*
  )
  SELECT * FROM claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_document_processing_submitted(
  p_job_id UUID,
  p_provider_job_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  UPDATE public.document_processing_jobs
  SET status = 'processing',
      provider_job_id = p_provider_job_id,
      submission_uncertain_at = NULL
  WHERE id = p_job_id
    AND status = 'submitting'
    AND provider_job_id IS NULL;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_document_processing_submission_uncertain(
  p_job_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  UPDATE public.document_processing_jobs
  SET submission_uncertain_at = COALESCE(submission_uncertain_at, NOW())
  WHERE id = p_job_id
    AND status = 'submitting'
    AND provider_job_id IS NULL
  RETURNING TRUE;
$$;

DROP FUNCTION IF EXISTS public.publish_document_processing_job(UUID, TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.publish_document_processing_job(
  p_job_id UUID,
  p_publish_claim_token UUID,
  p_document_path TEXT,
  p_thumbnail_path TEXT,
  p_document_size_bytes BIGINT,
  p_page_count INTEGER,
  p_watermark_path TEXT DEFAULT NULL,
  p_provider_engine TEXT DEFAULT NULL,
  p_provider_engine_version TEXT DEFAULT NULL,
  p_provider_task_credits JSONB DEFAULT '{}'::jsonb
)
RETURNS public.decks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job public.document_processing_jobs;
  v_deck public.decks;
  v_result public.decks;
BEGIN
  PERFORM set_config('deckly.skip_watermark_enqueue', 'true', TRUE);
  PERFORM set_config('deckly.preserve_watermark_revision', 'true', TRUE);
  PERFORM set_config('deckly.skip_viewable_document_verification', 'true', TRUE);
  SELECT * INTO v_job
  FROM public.document_processing_jobs
  WHERE id = p_job_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processing job not found'; END IF;
  IF v_job.publish_claim_token IS DISTINCT FROM p_publish_claim_token THEN
    RETURN NULL;
  END IF;
  IF v_job.status <> 'publishing' THEN
    RAISE EXCEPTION 'Processing job is not publishable';
  END IF;
  IF v_job.deadline_at <= NOW() THEN RAISE EXCEPTION 'Processing job timed out'; END IF;
  IF p_document_size_bytes <= 0 OR p_page_count NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid generated document metadata';
  END IF;
  IF v_job.requested_watermark_enabled AND p_watermark_path IS NULL THEN
    RAISE EXCEPTION 'A watermarked artifact is required';
  END IF;

  SELECT * INTO v_deck FROM public.decks WHERE id = v_job.deck_id FOR UPDATE;
  IF NOT FOUND OR v_deck.user_id <> v_job.user_id OR v_deck.status = 'DELETED' THEN
    RAISE EXCEPTION 'Deck is no longer publishable';
  END IF;

  -- A staged replacement never changes the live row until all R2 copies have
  -- completed.  This one transaction makes the new PDF, thumbnail, page count
  -- and protected-download state visible together.
  UPDATE public.decks
  SET file_url = p_document_path,
      thumbnail_url = p_thumbnail_path,
      file_size = p_document_size_bytes,
      page_count = p_page_count,
      file_type = 'pdf',
      display_mode = 'raw',
      pages = '[]'::jsonb,
      status = 'PROCESSED',
      content_revision = v_job.source_content_revision,
       source_filename = v_job.source_filename,
       title = COALESCE(v_job.requested_deck_updates ->> 'title', title),
       description = CASE WHEN v_job.requested_deck_updates ? 'description'
         THEN v_job.requested_deck_updates ->> 'description' ELSE description END,
       require_email = CASE WHEN v_job.requested_deck_updates ? 'require_email'
         THEN (v_job.requested_deck_updates ->> 'require_email')::BOOLEAN ELSE require_email END,
       require_password = CASE WHEN v_job.requested_deck_updates ? 'require_password'
         THEN (v_job.requested_deck_updates ->> 'require_password')::BOOLEAN ELSE require_password END,
       view_password = CASE WHEN v_job.requested_deck_updates ? 'view_password'
         THEN v_job.requested_deck_updates ->> 'view_password' ELSE view_password END,
       expires_at = CASE WHEN v_job.requested_deck_updates ? 'expires_at'
         THEN NULLIF(v_job.requested_deck_updates ->> 'expires_at', '')::TIMESTAMPTZ ELSE expires_at END,
       allow_download = CASE WHEN v_job.requested_deck_updates ? 'allow_download'
         THEN (v_job.requested_deck_updates ->> 'allow_download')::BOOLEAN ELSE allow_download END,
      watermark_enabled = v_job.requested_watermark_enabled,
      watermark_text = CASE WHEN v_job.requested_watermark_enabled THEN v_job.requested_watermark_text ELSE NULL END,
      watermark_revision = CASE WHEN v_job.requested_watermark_enabled THEN v_job.watermark_revision ELSE watermark_revision END,
      updated_at = NOW()
  WHERE id = v_deck.id
  RETURNING * INTO v_result;

  IF v_job.requested_watermark_enabled THEN
    UPDATE public.decks
    SET watermark_status = 'ready',
        watermarked_file_path = p_watermark_path,
        watermark_error = NULL,
        watermark_updated_at = NOW()
    WHERE id = v_deck.id;
    SELECT * INTO v_result FROM public.decks WHERE id = v_deck.id;
  END IF;

  INSERT INTO public.deck_links (deck_id, link_name, link_alias, is_enabled, is_primary)
  SELECT v_deck.id, 'Default Link', v_result.slug, TRUE, TRUE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.deck_links link
    WHERE link.deck_id = v_deck.id AND link.is_primary
  );

  UPDATE public.document_processing_jobs
  SET status = 'completed',
      output_document_path = p_document_path,
      output_thumbnail_path = p_thumbnail_path,
      output_watermark_path = p_watermark_path,
      output_size_bytes = p_document_size_bytes,
      output_page_count = p_page_count,
      provider_engine = p_provider_engine,
      provider_engine_version = p_provider_engine_version,
      provider_task_credits = COALESCE(p_provider_task_credits, '{}'::jsonb),
      completed_at = NOW(),
      cleanup_after = NOW() + INTERVAL '1 hour'
  WHERE id = v_job.id;

  RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.publish_watermark_processing_job(UUID, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.publish_watermark_processing_job(
  p_job_id UUID,
  p_publish_claim_token UUID,
  p_watermark_path TEXT,
  p_provider_engine TEXT DEFAULT NULL,
  p_provider_engine_version TEXT DEFAULT NULL,
  p_provider_task_credits JSONB DEFAULT '{}'::jsonb
)
RETURNS public.decks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_job public.document_processing_jobs;
  v_deck public.decks;
  v_result public.decks;
BEGIN
  SELECT * INTO v_job FROM public.document_processing_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND OR v_job.operation <> 'watermark_publish' THEN RAISE EXCEPTION 'Watermark job not found'; END IF;
  IF v_job.publish_claim_token IS DISTINCT FROM p_publish_claim_token THEN
    RETURN NULL;
  END IF;
  IF v_job.status <> 'publishing' OR v_job.deadline_at <= NOW() THEN
    RAISE EXCEPTION 'Watermark job is not publishable';
  END IF;
  SELECT * INTO v_deck FROM public.decks WHERE id = v_job.deck_id FOR UPDATE;
  IF NOT FOUND OR v_deck.user_id <> v_job.user_id OR v_deck.status <> 'PROCESSED'
     OR NOT v_deck.watermark_enabled
     OR v_deck.watermark_revision IS DISTINCT FROM v_job.watermark_revision
     OR v_deck.content_revision IS DISTINCT FROM v_job.source_content_revision THEN
    RAISE EXCEPTION 'Deck watermark revision is no longer publishable';
  END IF;

  UPDATE public.decks
  SET watermark_status = 'ready',
      watermarked_file_path = p_watermark_path,
      watermark_error = NULL,
      watermark_updated_at = NOW()
  WHERE id = v_deck.id;

  UPDATE public.document_processing_jobs
  SET status = 'completed',
      output_watermark_path = p_watermark_path,
      provider_engine = p_provider_engine,
      provider_engine_version = p_provider_engine_version,
      provider_task_credits = COALESCE(p_provider_task_credits, '{}'::jsonb),
      completed_at = NOW(),
      cleanup_after = NOW() + INTERVAL '1 hour'
  WHERE id = v_job.id;

  SELECT * INTO v_result FROM public.decks WHERE id = v_deck.id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_failed_watermark_processing_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.operation = 'watermark_publish'
     AND NEW.status IN ('failed', 'timed_out')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.decks
    SET watermark_status = 'failed',
        watermark_error = COALESCE(NEW.provider_error_detail, 'Watermarked download could not be prepared.'),
        watermark_updated_at = NOW()
    WHERE id = NEW.deck_id
      AND watermark_enabled
      AND watermark_revision IS NOT DISTINCT FROM NEW.watermark_revision
      AND content_revision IS NOT DISTINCT FROM NEW.source_content_revision;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_failed_watermark_processing_job ON public.document_processing_jobs;
CREATE TRIGGER tr_sync_failed_watermark_processing_job
  AFTER UPDATE OF status ON public.document_processing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_failed_watermark_processing_job();

-- Job state and provider data are service-role implementation details.
REVOKE ALL ON FUNCTION public.claim_document_processing_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_document_processing_quota(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_document_processing_submitted(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_document_processing_submission_uncertain(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_deck_watermark_processing_job(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_document_processing_job(UUID, UUID, TEXT, TEXT, BIGINT, INTEGER, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_watermark_processing_job(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_office_processing_draft(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_office_processing_replacement(UUID, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_document_processing_upload(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_document_processing_job(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Investor payloads must never expose drafts or failed uploads.  The owner
-- still sees them through authenticated dashboard queries and the job-status
-- endpoint.
CREATE OR REPLACE FUNCTION public.get_deck_payload(
  p_handle TEXT,
  p_slug_or_alias TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_deck RECORD; v_storage_path TEXT; v_allow_download BOOLEAN; v_watermark_enabled BOOLEAN;
BEGIN
  SELECT d.*, resolved.link_id, dl.link_name, dl.link_alias, dl.is_primary INTO v_deck
  FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
  JOIN public.decks d ON d.id = resolved.deck_id
  JOIN public.deck_links dl ON dl.id = resolved.link_id
  WHERE d.status = 'PROCESSED';
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized';
  ELSIF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_deck.user_id
    AND v_deck.require_password
    AND NOT public.check_deck_password(p_handle, p_slug_or_alias, p_password) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT v_deck.allow_download AND COALESCE(p.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE'),
         v_deck.watermark_enabled AND public.has_live_feature_for_user(v_deck.user_id, 'deck_watermarking')
    INTO v_allow_download, v_watermark_enabled
  FROM public.profiles p WHERE p.id = v_deck.user_id;
  v_storage_path := regexp_replace(v_deck.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', '');
  RETURN jsonb_build_object(
    'id', v_deck.id, 'storage_path', v_storage_path, 'file_url', v_deck.file_url,
    'pages', v_deck.pages, 'title', v_deck.title, 'file_type', v_deck.file_type,
    'allow_download', COALESCE(v_allow_download, FALSE),
    'watermark_enabled', COALESCE(v_watermark_enabled, FALSE),
    'watermark_text', CASE WHEN v_watermark_enabled THEN v_deck.watermark_text ELSE NULL END,
    'watermark_status', CASE WHEN v_watermark_enabled THEN v_deck.watermark_status ELSE 'disabled' END,
    'deck_link_id', v_deck.link_id, 'deck_link_name', v_deck.link_name,
    'deck_link_alias', v_deck.link_alias, 'deck_link_is_primary', v_deck.is_primary
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_data_room_payload(
  p_handle TEXT, p_slug TEXT, p_password TEXT
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_room RECORD; v_documents jsonb;
BEGIN
  SELECT dr.* INTO v_room FROM public.data_rooms dr JOIN public.profiles p ON p.id = dr.user_id
  WHERE p.handle = p_handle AND dr.slug = p_slug AND (dr.expires_at IS NULL OR dr.expires_at > NOW());
  IF NOT FOUND THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id AND NOT v_room.is_public THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) <> v_room.user_id
    AND v_room.require_password AND NOT public.check_data_room_password(p_handle, p_slug, p_password) THEN
    RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'data_room_id', v_room.id, 'title', d.title, 'slug', d.slug, 'description', d.description,
    'status', d.status, 'file_type', d.file_type, 'display_mode', d.display_mode, 'file_url', d.file_url,
    'folder_id', drd.folder_id, 'folder_name', drf.name,
    'storage_path', regexp_replace(d.file_url, '^.*/storage/v1/object/(public|sign|authenticated)/decks/', ''),
    'pages', d.pages,
    'allow_download', (d.allow_download AND COALESCE(owner_profile.tier, 'FREE') IN ('PRO', 'PRO_PLUS', 'RAISE')),
    'watermark_enabled', (d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking')),
    'watermark_text', CASE WHEN d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking') THEN d.watermark_text ELSE NULL END,
    'watermark_status', CASE WHEN d.watermark_enabled AND public.has_live_feature_for_user(d.user_id, 'deck_watermarking') THEN d.watermark_status ELSE 'disabled' END
  ) ORDER BY drd.display_order ASC), '[]'::jsonb) INTO v_documents
  FROM public.data_room_documents drd
  JOIN public.decks d ON d.id = drd.deck_id
  JOIN public.profiles owner_profile ON owner_profile.id = d.user_id
  LEFT JOIN public.data_room_folders drf ON drf.id = drd.folder_id
  WHERE drd.data_room_id = v_room.id
    AND d.status = 'PROCESSED';
  RETURN v_documents;
END;
$$;

NOTIFY pgrst, 'reload schema';
