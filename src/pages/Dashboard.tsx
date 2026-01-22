import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket as TicketIcon, CheckCircle, UserCheck, TrendingUp, Eye, Percent } from 'lucide-react'; // Added Percent icon

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
import { getSlaStatus } from '@/utils/sla';

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

  // Query: Tickets assigned to the current agent that are still active
  const { data: assignedActiveTicketsCount, isLoading: isLoadingAssignedActiveTickets } = useQuery<number, Error>({
    queryKey: ['assignedActiveTicketsCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('assigned_to', user.id)
        .eq('status', 'in_progress'); // Changed filter to explicitly count 'in_progress' tickets

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service') && !!user?.id,
  });

  // Query for profiles (for admin/customer_service to see agents) - still needed for agent count if desired elsewhere
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery<Profile[], Error>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  // Query for the 15 latest tickets
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

  // Query: Calculate SLA Performance Percentage
  const { data: slaPerformancePercentage, isLoading: isLoadingSlaPerformance } = useQuery<number, Error>({
    queryKey: ['slaPerformancePercentage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('created_at, resolved_at, status');

      if (error) throw new Error(error.message);

      const totalTickets = data.length;
      if (totalTickets === 0) return 0;

      const slaMetTickets = data.filter(ticket => getSlaStatus(ticket.created_at, ticket.resolved_at, ticket.status) === 'green').length;
      return (slaMetTickets / totalTickets) * 100;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  // NEW Query: Calculate Resolved Tickets Percentage
  const { data: resolvedTicketsPercentage, isLoading: isLoadingResolvedTicketsPercentage } = useQuery<number, Error>({
    queryKey: ['resolvedTicketsPercentage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('status');

      if (error) throw new Error(error.message);

      const totalTickets = data.length;
      if (totalTickets === 0) return 0;

      const resolvedCount = data.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed').length;
      return (resolvedCount / totalTickets) * 100;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });


  if (loading || isLoadingAllTickets || isLoadingActiveTickets || isLoadingProfiles || isLoadingResolvedTicketsByAgent || isLoadingLatestTickets || isLoadingAssignedActiveTickets || isLoadingSlaPerformance || isLoadingResolvedTicketsPercentage) {
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

        {/* Card: Tiket Diselesaikan Oleh Saya */}
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

        {/* Card: Tiket Ditugaskan Kepada Saya */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tiket Ditugaskan Kepada Saya
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignedActiveTicketsCount}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card: SLA Performance Percentage */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Performa SLA
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {slaPerformancePercentage !== undefined ? `${slaPerformancePercentage.toFixed(1)}%` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Tiket yang diselesaikan tepat waktu
              </p>
            </CardContent>
          </Card>
        )}

        {/* NEW Card: Resolved Tickets Percentage */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tiket Diselesaikan
              </CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {resolvedTicketsPercentage !== undefined ? `${resolvedTicketsPercentage.toFixed(1)}%` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Dari total tiket
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Latest 15 Tickets List */}
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

                      // Construct the WhatsApp share link
                      const ticketDetailUrl = `${window.location.origin}/tickets/${ticket.id}`;
                      const whatsappMessage = encodeURIComponent(
                        `Halo, saya ingin berbagi detail tiket ini dengan Anda:\n\n` +
                        `No. Tiket: ${ticket.ticket_number}\n` +
                        `Judul: ${ticket.title}\n` +
                        `Status: ${ticket.status.replace('_', ' ')}\n` +
                        `Prioritas: ${ticket.priority}\n` +
                        `Lihat detail lengkap di: ${ticketDetailUrl}`
                      );
                      const whatsappShareLink = `https://wa.me/?text=${whatsappMessage}`;

                      return (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">
                            <a 
                              href={whatsappShareLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {ticket.ticket_number}
                            </a>
                          </TableCell>
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