-- Queue one email per newly observed deck/viewer interest signal.
-- Delivery is handled asynchronously by a Supabase Database Webhook calling
-- the send-interest-signal-email Edge Function.

CREATE TABLE IF NOT EXISTS public.interest_signal_email_events (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    signal_label TEXT NOT NULL CHECK (
        signal_label IN (
            'Revisited',
            'Viewed multiple times',
            'Spent time on key slides',
            'Returned quickly',
            'Extended viewing'
        )
    ),
    recipient_email TEXT NOT NULL CHECK (btrim(recipient_email) <> ''),
    deck_title TEXT NOT NULL,
    deck_slug TEXT,
    viewer_email TEXT,
    total_visits INTEGER NOT NULL DEFAULT 0,
    total_time_seconds INTEGER NOT NULL DEFAULT 0,
    distinct_days INTEGER NOT NULL DEFAULT 0,
    deep_slides INTEGER NOT NULL DEFAULT 0,
    days_between_first_and_last INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'sending', 'sent', 'failed')
    ),
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    resend_message_id TEXT,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT interest_signal_email_events_once_per_signal
        UNIQUE (deck_id, visitor_id, signal_label)
);

ALTER TABLE public.interest_signal_email_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interest_signal_email_events_status
    ON public.interest_signal_email_events (status, created_at)
    WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_interest_signal_email_events_owner
    ON public.interest_signal_email_events (owner_user_id, created_at DESC);

-- The queue is intentionally not exposed to browser clients. The trigger and
-- Edge Function use privileged execution, while RLS remains a second barrier.
REVOKE ALL ON public.interest_signal_email_events FROM anon, authenticated;
GRANT ALL ON public.interest_signal_email_events TO service_role;

CREATE OR REPLACE FUNCTION public.queue_interest_signal_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_owner_user_id UUID;
    v_recipient_email TEXT;
    v_deck_title TEXT;
    v_deck_slug TEXT;
    v_viewer_email TEXT;
    v_total_visits INTEGER;
    v_total_time_seconds INTEGER;
    v_distinct_days INTEGER;
    v_deep_slides INTEGER;
    v_first_view TIMESTAMPTZ;
    v_last_view TIMESTAMPTZ;
    v_days_between INTEGER;
    v_signals TEXT[] := ARRAY[]::TEXT[];
    v_signal TEXT;
BEGIN
    SELECT
        d.user_id,
        u.email,
        d.title,
        d.slug
    INTO
        v_owner_user_id,
        v_recipient_email,
        v_deck_title,
        v_deck_slug
    FROM public.decks d
    JOIN auth.users u ON u.id = d.user_id
    WHERE d.id = NEW.deck_id;

    -- A deleted/incomplete owner record should never block analytics writes.
    IF v_owner_user_id IS NULL OR v_recipient_email IS NULL
       OR btrim(v_recipient_email) = '' THEN
        RETURN NEW;
    END IF;

    SELECT
        COUNT(*)::INTEGER,
        ROUND(COALESCE(SUM(time_spent), 0))::INTEGER,
        COUNT(DISTINCT viewed_at::DATE)::INTEGER,
        COALESCE(
            COUNT(DISTINCT page_number) FILTER (WHERE COALESCE(time_spent, 0) >= 20),
            0
        )::INTEGER,
        MIN(viewed_at),
        MAX(viewed_at)
    INTO
        v_total_visits,
        v_total_time_seconds,
        v_distinct_days,
        v_deep_slides,
        v_first_view,
        v_last_view
    FROM public.deck_page_views
    WHERE deck_id = NEW.deck_id
      AND visitor_id = NEW.visitor_id;

    SELECT viewer_email
    INTO v_viewer_email
    FROM public.deck_page_views
    WHERE deck_id = NEW.deck_id
      AND visitor_id = NEW.visitor_id
      AND viewer_email IS NOT NULL
      AND btrim(viewer_email) <> ''
    ORDER BY viewed_at ASC
    LIMIT 1;

    IF v_last_view IS NOT NULL AND v_first_view IS NOT NULL
       AND v_total_visits >= 2 THEN
        v_days_between := ROUND(
            EXTRACT(EPOCH FROM (v_last_view - v_first_view)) / 86400
        )::INTEGER;
    END IF;

    -- Keep these thresholds aligned with src/services/interestSignalService.ts.
    IF v_distinct_days >= 2 THEN
        v_signals := array_append(v_signals, 'Revisited');
    END IF;

    IF v_total_visits >= 3 THEN
        v_signals := array_append(v_signals, 'Viewed multiple times');
    END IF;

    IF v_deep_slides >= 2 THEN
        v_signals := array_append(v_signals, 'Spent time on key slides');
    END IF;

    IF v_days_between IS NOT NULL
       AND v_days_between <= 3
       AND v_distinct_days >= 2 THEN
        v_signals := array_append(v_signals, 'Returned quickly');
    END IF;

    IF v_total_time_seconds >= 60 THEN
        v_signals := array_append(v_signals, 'Extended viewing');
    END IF;

    FOREACH v_signal IN ARRAY v_signals LOOP
        INSERT INTO public.interest_signal_email_events (
            owner_user_id,
            deck_id,
            visitor_id,
            signal_label,
            recipient_email,
            deck_title,
            deck_slug,
            viewer_email,
            total_visits,
            total_time_seconds,
            distinct_days,
            deep_slides,
            days_between_first_and_last
        )
        VALUES (
            v_owner_user_id,
            NEW.deck_id,
            NEW.visitor_id,
            v_signal,
            v_recipient_email,
            COALESCE(v_deck_title, 'Your deck'),
            v_deck_slug,
            v_viewer_email,
            COALESCE(v_total_visits, 0),
            COALESCE(v_total_time_seconds, 0),
            COALESCE(v_distinct_days, 0),
            COALESCE(v_deep_slides, 0),
            v_days_between
        )
        ON CONFLICT (deck_id, visitor_id, signal_label) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.queue_interest_signal_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_queue_interest_signal_email ON public.deck_page_views;
CREATE TRIGGER tr_queue_interest_signal_email
    AFTER INSERT OR UPDATE OF viewed_at, time_spent, viewer_email
    ON public.deck_page_views
    FOR EACH ROW
    EXECUTE FUNCTION public.queue_interest_signal_email();
