-- Data Room document tags
-- Allows room owners to tag individual documents inside a data room.

CREATE TABLE IF NOT EXISTS "public"."data_room_document_tags" (
    "document_id" uuid NOT NULL REFERENCES public.data_room_documents(id) ON DELETE CASCADE,
    "tag_id" uuid NOT NULL REFERENCES public.data_room_tags(id) ON DELETE CASCADE,
    PRIMARY KEY ("document_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "idx_data_room_document_tags_tag"
    ON "public"."data_room_document_tags" ("tag_id");

ALTER TABLE public.data_room_document_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage data room document tags" ON public.data_room_document_tags;
CREATE POLICY "Owners can manage data room document tags" ON public.data_room_document_tags
    FOR ALL
    USING (EXISTS (
        SELECT 1
        FROM public.data_room_documents drd
        JOIN public.data_rooms dr ON dr.id = drd.data_room_id
        JOIN public.data_room_tags t ON t.id = tag_id
        WHERE drd.id = document_id
          AND dr.user_id = (SELECT auth.uid())
          AND t.data_room_id = drd.data_room_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1
        FROM public.data_room_documents drd
        JOIN public.data_rooms dr ON dr.id = drd.data_room_id
        JOIN public.data_room_tags t ON t.id = tag_id
        WHERE drd.id = document_id
          AND dr.user_id = (SELECT auth.uid())
          AND t.data_room_id = drd.data_room_id
    ));
