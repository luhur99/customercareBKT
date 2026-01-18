SELECT
  au.id AS auth_id,
  au.email,
  p.first_name,
  p.last_name,
  p.role,
  au.created_at AS auth_created_at,
  p.updated_at AS profile_updated_at
FROM
  auth.users AS au
LEFT JOIN
  public.profiles AS p ON au.id = p.id
WHERE
  au.email = 'luhurguanteng@gmail.com';