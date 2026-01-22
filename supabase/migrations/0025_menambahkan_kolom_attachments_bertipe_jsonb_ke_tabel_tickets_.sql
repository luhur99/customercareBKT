ALTER TABLE public.tickets
ADD COLUMN attachments JSONB DEFAULT '[]'::jsonb;