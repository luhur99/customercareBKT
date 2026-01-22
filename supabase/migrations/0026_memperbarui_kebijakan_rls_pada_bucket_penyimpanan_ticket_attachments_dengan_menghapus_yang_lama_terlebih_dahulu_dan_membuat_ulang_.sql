-- Drop existing policies if they exist to avoid "already exists" errors
    DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow authenticated users to view their own files" ON storage.objects;
    DROP POLICY IF EXISTS "Allow admin and CS to view all ticket files" ON storage.objects;

    -- Policy for authenticated users to upload files to their own user_id/ticket_id folders
    CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid() = (storage.foldername(name))[1]::uuid);

    -- Policy for authenticated users to view their own user_id/ticket_id files
    CREATE POLICY "Allow authenticated users to view their own files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-attachments' AND auth.uid() = (storage.foldername(name))[1]::uuid);

    -- Policy for admin/customer_service to view all ticket files
    -- This assumes 'get_my_role()' function exists and returns 'admin' or 'customer_service'
    CREATE POLICY "Allow admin and CS to view all ticket files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-attachments' AND (get_my_role() = 'admin' OR get_my_role() = 'customer_service'));