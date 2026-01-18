-- Create user_role ENUM type
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'customer_service', 'sales');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add role column to profiles table if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'sales';