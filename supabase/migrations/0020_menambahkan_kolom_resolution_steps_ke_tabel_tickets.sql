ALTER TABLE public.tickets
ADD COLUMN resolution_steps TEXT;

-- Optional: Update existing RLS policies if needed, though typically a new column doesn't require new policies
-- unless specific access rules are desired for this column.
-- For now, existing UPDATE policies should cover it.