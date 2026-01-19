-- Tambahkan kolom resolved_at ke tabel tickets
ALTER TABLE public.tickets
ADD COLUMN resolved_at TIMESTAMP WITH TIME ZONE;

-- Kebijakan RLS UPDATE yang sudah ada untuk tabel tickets
-- "Customer service and admins can update tickets"
-- FOR UPDATE TO authenticated USING (get_my_role() = ANY (ARRAY['admin'::user_role, 'customer_service'::user_role]));
-- Kebijakan ini sudah cukup luas untuk mencakup pembaruan kolom resolved_at oleh peran yang berwenang,
-- jadi tidak perlu ada perubahan pada kebijakan RLS yang sudah ada.