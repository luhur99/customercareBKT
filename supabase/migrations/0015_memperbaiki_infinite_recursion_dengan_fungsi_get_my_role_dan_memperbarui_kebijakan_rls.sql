-- 1. Buat fungsi helper yang aman untuk mengambil role tanpa memicu RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.user_role;
BEGIN
  -- Query ini berjalan dengan hak akses pembuat fungsi (admin/superuser), jadi membypass RLS
  SELECT role INTO _role FROM public.profiles WHERE id = auth.uid();
  RETURN _role;
END;
$$;

-- 2. Hapus kebijakan yang bermasalah (penyebab rekursi) pada tabel profiles
DROP POLICY IF EXISTS "Admins and CS can view other profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 3. Buat ulang kebijakan profiles menggunakan fungsi get_my_role()
CREATE POLICY "Admins and CS can view other profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  (auth.uid() = id) OR -- User selalu bisa lihat profil sendiri
  (get_my_role() IN ('admin', 'customer_service')) -- Admin & CS bisa lihat semua
);

CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (
  (auth.uid() = id) OR -- User bisa update profil sendiri (jika diizinkan kolomnya)
  (get_my_role() = 'admin') -- Hanya admin bisa update profil orang lain
)
WITH CHECK (
  (auth.uid() = id) OR
  (get_my_role() = 'admin')
);

-- 4. Update juga kebijakan pada tabel tickets agar lebih efisien dan aman
DROP POLICY IF EXISTS "Customer service and admins can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customer service and admins can update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Customer service and admins can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can delete tickets" ON public.tickets;

CREATE POLICY "Customer service and admins can view all tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
  (auth.uid() = created_by) OR 
  (auth.email() = customer_email) OR -- Jika fungsi auth.email() tersedia, jika tidak bisa diganti
  (get_my_role() IN ('admin', 'customer_service'))
);

CREATE POLICY "Customer service and admins can update tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (
  (get_my_role() IN ('admin', 'customer_service'))
);

CREATE POLICY "Customer service and admins can create tickets" ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  (get_my_role() IN ('admin', 'customer_service'))
);

CREATE POLICY "Admins can delete tickets" ON public.tickets
FOR DELETE TO authenticated
USING (
  (get_my_role() = 'admin')
);