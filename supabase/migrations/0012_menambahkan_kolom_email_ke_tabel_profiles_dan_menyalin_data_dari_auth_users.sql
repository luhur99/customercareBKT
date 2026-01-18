-- 1. Tambahkan kolom email ke tabel profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update fungsi handle_new_user untuk menyimpan email saat pendaftaran
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role, email)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    CASE 
      WHEN new.email = 'luhurguanteng@gmail.com' THEN 'admin'::public.user_role
      ELSE 'customer_service'::public.user_role
    END,
    new.email
  );
  RETURN new;
END;
$$;

-- 3. Isi kolom email untuk user yang sudah ada (Backfill)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;