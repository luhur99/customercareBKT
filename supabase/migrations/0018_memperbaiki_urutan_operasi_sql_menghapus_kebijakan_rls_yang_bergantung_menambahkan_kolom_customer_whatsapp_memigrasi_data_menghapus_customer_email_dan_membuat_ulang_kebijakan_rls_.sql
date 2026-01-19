-- 1. Hapus kebijakan RLS yang bergantung pada kolom customer_email
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customer service and admins can view all tickets" ON public.tickets;

-- 2. Tambahkan kolom customer_whatsapp ke tabel tickets
ALTER TABLE public.tickets
ADD COLUMN customer_whatsapp TEXT;

-- 3. Salin data dari customer_email ke customer_whatsapp (jika ada data lama yang perlu dimigrasi)
UPDATE public.tickets
SET customer_whatsapp = customer_email
WHERE customer_email IS NOT NULL;

-- 4. Hapus kolom customer_email dari tabel tickets
ALTER TABLE public.tickets
DROP COLUMN customer_email;

-- 5. Buat ulang kebijakan RLS untuk tabel tickets
-- Kebijakan ini memungkinkan pengguna melihat tiket yang mereka buat
CREATE POLICY "Users can view their own tickets" ON public.tickets
FOR SELECT TO authenticated
USING (auth.uid() = created_by);

-- Kebijakan ini memungkinkan admin dan customer service melihat semua tiket
CREATE POLICY "Customer service and admins can view all tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
    (auth.uid() = created_by) OR
    (get_my_role() = ANY (ARRAY['admin'::user_role, 'customer_service'::user_role]))
);

-- Pastikan kebijakan INSERT, UPDATE, DELETE yang ada masih relevan dan aman
-- (Tidak ada perubahan pada kebijakan INSERT, UPDATE, DELETE yang sudah ada karena tidak mereferensikan customer_email secara langsung untuk otentikasi)