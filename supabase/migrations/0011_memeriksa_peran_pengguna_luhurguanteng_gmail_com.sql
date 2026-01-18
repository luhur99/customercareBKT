SELECT p.role, u.email 
FROM public.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'luhurguanteng@gmail.com';