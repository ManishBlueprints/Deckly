DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'global_tag_aliases_user_type_value_key'
          AND conrelid = 'public.global_tag_aliases'::regclass
    ) THEN
        ALTER TABLE public.global_tag_aliases
            ADD CONSTRAINT global_tag_aliases_user_type_value_key
            UNIQUE (user_id, alias_type, alias_value);
    END IF;
END $$;

DROP POLICY IF EXISTS "Users can read global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can insert global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can update global tag aliases" ON public.global_tag_aliases;
DROP POLICY IF EXISTS "Users can delete global tag aliases" ON public.global_tag_aliases;

CREATE POLICY "Users can read global tag aliases" ON public.global_tag_aliases
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert global tag aliases" ON public.global_tag_aliases
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update global tag aliases" ON public.global_tag_aliases
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete global tag aliases" ON public.global_tag_aliases
    FOR DELETE USING ((select auth.uid()) = user_id);
