CREATE POLICY "Admins and CS can view other profiles" ON public.profiles
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'customer_service')
);