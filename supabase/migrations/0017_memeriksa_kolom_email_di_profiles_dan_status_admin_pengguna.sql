-- 1. Pastikan kolom email ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Pastikan data email terisi dari tabel auth.users (sinkronisasi ulang)
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE public.profiles.id = auth.users.id AND public.profiles.email IS NULL;

-- 3. Cek status admin untuk luhurguanteng@gmail.com
-- (Mengatur ulang untuk memastikan hak akses)
UPDATE public.profiles
SET role = 'admin'::public.user_role
FROM auth.users
WHERE public.profiles.id = auth.users.id 
AND auth.users.email = 'luhurguanteng@gmail.com';

-- 4. Verifikasi hasil
SELECT p.email, p.role 
FROM public.profiles p 
JOIN auth.users u ON p.id = u.id 
WHERE u.email = 'luhurguanteng@gmail.com';