-- Remove the legacy room-local tag definition table after the global tag
-- migration path has rewired all surviving consumers to public.global_tags.
-- Policies and indexes tied to the dropped table are removed automatically.

DO $$
BEGIN
    IF to_regclass('public.data_room_tags') IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE contype = 'f'
          AND confrelid = 'public.data_room_tags'::regclass
          AND conrelid <> 'public.data_room_tags'::regclass
    ) THEN
        RAISE EXCEPTION 'Cannot drop public.data_room_tags while foreign key dependencies still exist.';
    END IF;
END $$;

DROP TABLE IF EXISTS public.data_room_tags;
