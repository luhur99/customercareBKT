-- Add foreign key from tickets.created_by to profiles.id
-- Drop existing constraint if it exists to avoid errors
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add foreign key from tickets.assigned_to to profiles.id
-- Drop existing constraint if it exists to avoid errors
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_assigned_to_fkey
FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;