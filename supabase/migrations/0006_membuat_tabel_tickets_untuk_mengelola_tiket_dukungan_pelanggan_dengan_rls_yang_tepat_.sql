-- Create tickets table
CREATE TABLE public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' NOT NULL, -- e.g., 'open', 'in_progress', 'closed'
  priority TEXT DEFAULT 'medium' NOT NULL, -- e.g., 'low', 'medium', 'high', 'urgent'
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User who created the ticket
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Customer service agent assigned
  customer_email TEXT, -- Email of the customer reporting the issue
  customer_name TEXT -- Name of the customer
);

-- Enable RLS (REQUIRED for security)
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Policies for tickets table:
-- Customer service agents can view all tickets
CREATE POLICY "Customer service and admins can view all tickets" ON public.tickets
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'customer_service')
);

-- Authenticated users (customers) can view their own tickets
CREATE POLICY "Users can view their own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = created_by OR auth.email() = customer_email);

-- Customer service agents can create tickets
CREATE POLICY "Customer service and admins can create tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'customer_service')
);

-- Customer service agents can update tickets
CREATE POLICY "Customer service and admins can update tickets" ON public.tickets
FOR UPDATE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'customer_service')
);

-- Admins can delete tickets (optional, can be restricted further)
CREATE POLICY "Admins can delete tickets" ON public.tickets
FOR DELETE TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);