-- Fix: serialize COUNT+INSERT in validate_signup_throttle using advisory lock
CREATE OR REPLACE FUNCTION public.validate_signup_throttle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_ip TEXT := current_setting('request.headers', true)::json->>'x-forwarded-for';
    v_count INTEGER;
BEGIN
    IF v_ip IS NOT NULL AND trim(v_ip) != '' THEN
        v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    IF v_ip IS NULL OR trim(v_ip) = '' THEN
        v_ip := COALESCE(inet_client_addr()::text, 'local');
    END IF;

    -- Serialize per-IP to make COUNT+INSERT atomic
    PERFORM pg_advisory_xact_lock(hashtext(v_ip));

    SELECT count(*)::INTEGER INTO v_count
    FROM public.signup_throttle
    WHERE ip_address = v_ip AND created_at > NOW() - INTERVAL '1 hour';

    IF v_count >= 3 THEN
        RAISE EXCEPTION 'Too many signup attempts from this IP. Please try again after 1 hour.';
    END IF;

    INSERT INTO public.signup_throttle (ip_address) VALUES (v_ip);
    RETURN jsonb_build_object('success', true);
END;
$$;
