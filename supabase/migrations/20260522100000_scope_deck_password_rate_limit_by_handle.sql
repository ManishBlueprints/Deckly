BEGIN;

CREATE OR REPLACE FUNCTION public.check_deck_password(
    p_handle TEXT,
    p_slug_or_alias TEXT,
    p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_hashed_pw TEXT;
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
    v_rate_limit_key TEXT := COALESCE(p_handle, '') || ':' || p_slug_or_alias;
BEGIN
    SELECT d.view_password
    INTO v_hashed_pw
    FROM public.resolve_public_deck_link(p_handle, p_slug_or_alias) resolved
    JOIN public.decks d ON d.id = resolved.deck_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_hashed_pw IS NULL THEN
        RETURN TRUE;
    END IF;

    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;

    IF v_ip IS NULL OR trim(v_ip) = '' THEN
        v_ip := COALESCE(inet_client_addr()::text, 'local');
    END IF;

    IF NOT public.check_rate_limit(v_ip, v_rate_limit_key) THEN
        RAISE EXCEPTION 'Too many failed attempts. Please try again later.';
    END IF;

    IF v_hashed_pw = crypt(p_password, v_hashed_pw) THEN
        PERFORM public.clear_rate_limit(v_ip, v_rate_limit_key);
        RETURN TRUE;
    END IF;

    PERFORM public.record_failed_attempt(v_ip, v_rate_limit_key);
    RETURN FALSE;
END;
$$;

COMMIT;
