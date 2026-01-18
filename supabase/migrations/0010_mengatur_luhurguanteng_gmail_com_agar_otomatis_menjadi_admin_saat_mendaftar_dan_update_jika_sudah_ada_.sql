-- 1. Perbarui fungsi handle_new_user untuk memberikan peran 'admin' khusus untuk email ini
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    CASE 
      WHEN new.email = 'luhurguanteng@gmail.com' THEN 'admin'::public.user_role
      ELSE 'customer_service'::public.user_role
    END
  );
  RETURN new;
END;
$$;

-- 2. Coba update pengguna jika sudah terdaftar sebelumnya
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Mencari ID pengguna dari tabel auth.users (memerlukan hak akses superuser/admin database)
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'luhurguanteng@gmail.com';
  
  -- Jika pengguna ditemukan, update perannya di tabel profiles
  IF target_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'admin'::public.user_role
    WHERE id = target_user_id;
  END IF;
END $$;