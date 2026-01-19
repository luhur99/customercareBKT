import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket as TicketIcon, Users, CheckCircle } from 'lucide-react'; // Added CheckCircle

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

interface Ticket {
  id: string;
  created_at: string;
  title: string;
  status: string;
  priority: string;
  created_by: string;
  assigned_to: string | null;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  email: string;
}

const Dashboard = () => {
  const { session, loading, role, user } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk melihat dashboard.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Query for all tickets (for sales role)
  const { data: allTickets, isLoading: isLoadingAllTickets } = useQuery<Ticket[], Error>({
    queryKey: ['allTickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select('*');
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && role === 'sales',
  });

  // Query for active tickets (for admin/customer_service roles)
  const { data: activeTickets, isLoading: isLoadingActiveTickets } = useQuery<Ticket[], Error>({
    queryKey: ['activeTickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .neq('status', 'closed'); // Active tickets are not closed
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  // NEW: Query for resolved tickets by the current agent
  const { data: resolvedTicketsByAgentCount, isLoading: isLoadingResolvedTicketsByAgent } = useQuery<number, Error>({
    queryKey: ['resolvedTicketsByAgentCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('assigned_to', user.id)
        .eq('status', 'resolved'); // Count tickets resolved by the current agent

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service') && !!user?.id,
  });

  // Query for profiles (for admin/customer_service to see agents)
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery<Profile[], Error>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  if (loading || isLoadingAllTickets || isLoadingActiveTickets || isLoadingProfiles || isLoadingResolvedTicketsByAgent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card for Total/Active Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {role === 'sales' ? 'Total Tiket Dibuat' : 'Total Tiket Aktif'}
            </CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {role === 'sales' ? allTickets?.length : activeTickets?.length}
            </div>
          </CardContent>
        </Card>

        {/* NEW CARD: Tiket Diselesaikan Oleh Saya */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tiket Diselesaikan Oleh Saya
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resolvedTicketsByAgentCount}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card for Total Agents */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Agen</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {profiles?.filter(p => p.role === 'admin' || p.role === 'customer_service').length}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;