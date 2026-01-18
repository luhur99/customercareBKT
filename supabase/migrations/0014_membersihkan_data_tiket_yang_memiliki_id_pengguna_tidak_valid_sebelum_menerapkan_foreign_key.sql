-- 1. Set created_by/assigned_to menjadi NULL jika ID-nya tidak ada di tabel profiles
-- Ini mencegah error saat pembuatan Foreign Key jika ada data "sampah"
UPDATE public.tickets
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM public.profiles);

UPDATE public.tickets
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM public.profiles);

-- 2. Pastikan Constraint Foreign Key terpasang dengan benar (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_created_by_fkey') THEN
        ALTER TABLE public.tickets
          ADD CONSTRAINT tickets_created_by_fkey
          FOREIGN KEY (created_by)
          REFERENCES public.profiles(id)
          ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_assigned_to_fkey') THEN
        ALTER TABLE public.tickets
          ADD CONSTRAINT tickets_assigned_to_fkey
          FOREIGN KEY (assigned_to)
          REFERENCES public.profiles(id)
          ON DELETE SET NULL;
    END IF;
END $$;