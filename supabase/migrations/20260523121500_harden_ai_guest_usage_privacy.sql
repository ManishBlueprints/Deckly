BEGIN;

ALTER TABLE public.ai_guest_usage
    ADD COLUMN IF NOT EXISTS ip_hash TEXT,
    ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

UPDATE public.ai_guest_usage
SET ip_hash = encode(digest(host(ip_address), 'sha256'), 'hex')
WHERE ip_hash IS NULL
  AND ip_address IS NOT NULL;

UPDATE public.ai_guest_usage
SET retention_expires_at = COALESCE(consumed_at, created_at, NOW()) + INTERVAL '90 days'
WHERE retention_expires_at IS NULL;

ALTER TABLE public.ai_guest_usage
    ALTER COLUMN ip_hash SET NOT NULL,
    ALTER COLUMN retention_expires_at SET NOT NULL;

ALTER TABLE public.ai_guest_usage
    ALTER COLUMN ip_address DROP NOT NULL;

UPDATE public.ai_guest_usage
SET ip_address = NULL
WHERE ip_address IS NOT NULL;

DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT conname
    INTO v_constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.ai_guest_usage'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_guest_usage'::regclass AND attname = 'ip_address'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_guest_usage'::regclass AND attname = 'usage_date'),
        (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.ai_guest_usage'::regclass AND attname = 'usage_kind')
      ]::smallint[];

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE public.ai_guest_usage DROP CONSTRAINT %I',
            v_constraint_name
        );
    END IF;
END $$;

ALTER TABLE public.ai_guest_usage
    ADD CONSTRAINT ai_guest_usage_ip_hash_usage_date_usage_kind_key
    UNIQUE (ip_hash, usage_date, usage_kind);

CREATE INDEX IF NOT EXISTS idx_ai_guest_usage_ip_hash_consumed_at
    ON public.ai_guest_usage(ip_hash, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_guest_usage_retention_expires_at
    ON public.ai_guest_usage(retention_expires_at);

CREATE OR REPLACE FUNCTION public.purge_expired_ai_guest_usage()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.ai_guest_usage
    WHERE retention_expires_at <= NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_ai_guest_usage() IS
    'Deletes expired guest AI summary quota records. Schedule periodically (for example daily) to enforce ai_guest_usage retention.';

COMMIT;
