-- Allow anonymous users to view public ticket details
-- This policy enables consumers to access their ticket information via public links without authentication

CREATE POLICY "Anonymous users can view specific tickets for public access" ON public.tickets
FOR SELECT
TO anon, authenticated
USING (true);
