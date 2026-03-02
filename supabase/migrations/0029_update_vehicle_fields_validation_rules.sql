-- Update no_plat_kendaraan column size from VARCHAR(10) to VARCHAR(15)
ALTER TABLE public.tickets
ALTER COLUMN no_plat_kendaraan TYPE VARCHAR(15);

-- Update no_simcard_gps column size from VARCHAR(12) to VARCHAR(15)
ALTER TABLE public.tickets
ALTER COLUMN no_simcard_gps TYPE VARCHAR(15);

-- Drop old constraints
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_no_plat_kendaraan_format_check;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_no_simcard_gps_format_check;

-- Add new constraint for no_plat_kendaraan: allow alphanumeric and spaces, max 15 chars
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_no_plat_kendaraan_format_check
CHECK (no_plat_kendaraan IS NULL OR no_plat_kendaraan ~ '^[A-Za-z0-9 ]{1,15}$');

-- Add new constraint for no_simcard_gps: start with 08, numeric only, max 15 chars
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_no_simcard_gps_format_check
CHECK (no_simcard_gps IS NULL OR no_simcard_gps ~ '^08[0-9]{0,13}$');
