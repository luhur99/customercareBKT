-- Enable RLS on the 'ticket-attachments' bucket
    -- This is done via the Supabase UI for Storage buckets, not SQL.
    -- Ensure the bucket is set to 'Private' when created.

    -- Policy for authenticated users to upload files to their own ticket folders
    CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid() = (storage.foldername(name))[1]::uuid);

    -- Policy for authenticated users to view their own ticket files
    CREATE POLICY "Allow authenticated users to view their own files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-attachments' AND auth.uid() = (storage.foldername(name))[1]::uuid);

    -- Policy for admin/customer_service to view all ticket files
    -- This assumes 'get_my_role()' function exists and returns 'admin' or 'customer_service'
    CREATE POLICY "Allow admin and CS to view all ticket files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'ticket-attachments' AND (get_my_role() = 'admin' OR get_my_role() = 'customer_service'));