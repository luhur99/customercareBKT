import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket as TicketIcon, Users, CheckCircle, Eye } from 'lucide-react'; // Added Eye icon

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla'; // Import getSlaStatus

interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_by: string;
  assigned_to: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  resolved_at: string | null;
  category: string;
  assigned_to_profile: { first_name: string | null; last_name: string | null; email: string | null; } | null;
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

  // Query for resolved tickets by the current agent
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

  // NEW: Query for the 15 latest tickets
  const { data: latestTickets, isLoading: isLoadingLatestTickets } = useQuery<Ticket[], Error>({
    queryKey: ['latestTickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned_to_profile:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  if (loading || isLoadingAllTickets || isLoadingActiveTickets || isLoadingProfiles || isLoadingResolvedTicketsByAgent || isLoadingLatestTickets) {
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
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

      {/* NEW: Latest 15 Tickets List */}
      {(role === 'admin' || role === 'customer_service') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">15 Tiket Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No Tiket</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>Dibuat Pada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ditugaskan Kepada</TableHead>
                    <TableHead>SLA</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestTickets?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Tidak ada tiket terbaru yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    latestTickets?.map((ticket) => {
                      const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at, ticket.status);
                      const slaBadgeClass =
                        slaStatus === 'green'
                          ? 'bg-green-100 text-green-800'
                          : slaStatus === 'yellow'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800';
                      
                      const assignedAgentName = ticket.assigned_to_profile 
                        ? [ticket.assigned_to_profile.first_name, ticket.assigned_to_profile.last_name].filter(Boolean).join(' ') || ticket.assigned_to_profile.email 
                        : 'Belum Ditugaskan';

                      return (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.ticket_number}</TableCell>
                          <TableCell>{ticket.title}</TableCell>
                          <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                              ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell>{assignedAgentName}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                              {slaStatus}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link to={`/tickets/${ticket.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">Lihat Detail</span>
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;