ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS no_plat_kendaraan VARCHAR(10),
ADD COLUMN IF NOT EXISTS no_simcard_gps VARCHAR(12);

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_no_plat_kendaraan_format_check;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_no_plat_kendaraan_format_check
CHECK (no_plat_kendaraan IS NULL OR no_plat_kendaraan ~ '^[A-Za-z0-9]{1,10}$');

ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_no_simcard_gps_format_check;
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_no_simcard_gps_format_check
CHECK (no_simcard_gps IS NULL OR no_simcard_gps ~ '^0812[0-9]{0,8}$');
