-- 1. Cek apakah kolom email ada di tabel profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'email';

-- 2. Cek role pengguna saat ini (untuk debugging)
SELECT id, email, role FROM public.profiles WHERE id = auth.uid();