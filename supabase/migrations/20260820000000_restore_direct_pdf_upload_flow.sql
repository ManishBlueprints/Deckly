-- Direct PDFs are rasterised and validated in the browser before publishing.
-- CloudConvert processing is deliberately limited to interactive Office files
-- and watermark artifacts, so it must not be on the direct-PDF upload path.

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

DROP TABLE IF EXISTS public.direct_pdf_verifications;

DROP TRIGGER IF EXISTS tr_enforce_viewable_document_limits ON public.decks;
CREATE TRIGGER tr_enforce_viewable_document_limits
  BEFORE INSERT OR UPDATE OF file_url, file_size, pages, page_count, file_type ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viewable_document_limits();
