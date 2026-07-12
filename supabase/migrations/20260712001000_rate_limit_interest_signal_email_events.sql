-- Analytics writes are public, so bound the notification queue independently
-- of caller-controlled visitor identifiers.
CREATE INDEX IF NOT EXISTS idx_interest_signal_email_events_deck_created
    ON public.interest_signal_email_events (deck_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.limit_interest_signal_email_event_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_events_last_hour INTEGER;
    v_events_last_day INTEGER;
BEGIN
    -- Serialize queue attempts for each deck so concurrent visitor writes
    -- cannot bypass the count-based limits below.
    PERFORM pg_advisory_xact_lock(hashtext(NEW.deck_id::TEXT));

    SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour'),
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day')
    INTO v_events_last_hour, v_events_last_day
    FROM public.interest_signal_email_events
    WHERE deck_id = NEW.deck_id;

    IF v_events_last_hour >= 5 OR v_events_last_day >= 20 THEN
        RAISE LOG 'Interest signal email rate limit reached for deck %', NEW.deck_id;
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.limit_interest_signal_email_event_rate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_limit_interest_signal_email_event_rate
    ON public.interest_signal_email_events;

CREATE TRIGGER tr_limit_interest_signal_email_event_rate
    BEFORE INSERT ON public.interest_signal_email_events
    FOR EACH ROW
    EXECUTE FUNCTION public.limit_interest_signal_email_event_rate();
