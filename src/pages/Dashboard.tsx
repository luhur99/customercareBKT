import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Ticket as TicketIcon, CheckCircle, UserCheck, TrendingUp, Eye, PieChart, Share2 } from 'lucide-react';

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
import { showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla';

interface LatestTicket {
  id: string;
  ticket_number: string;
  created_at: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  resolved_at: string | null;
  assigned_to_profile: { first_name: string | null; last_name: string | null; email: string | null; }[] | null;
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

  // Query for all tickets count (for sales role) - using count
  const { data: allTicketsCount, isLoading: isLoadingAllTickets } = useQuery<number, Error>({
    queryKey: ['allTicketsCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && role === 'sales',
  });

  // Query for active tickets count (for admin/customer_service roles) - using count
  const { data: activeTicketsCount, isLoading: isLoadingActiveTickets } = useQuery<number, Error>({
    queryKey: ['activeTicketsCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'closed');
      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  // Query for resolved tickets by the current agent - using count
  const { data: resolvedTicketsByAgentCount, isLoading: isLoadingResolvedTicketsByAgent } = useQuery<number, Error>({
    queryKey: ['resolvedTicketsByAgentCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .eq('status', 'resolved');

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service') && !!user?.id,
  });

  // Query: Tickets assigned to the current agent that are in_progress - using count
  const { data: assignedActiveTicketsCount, isLoading: isLoadingAssignedActiveTickets } = useQuery<number, Error>({
    queryKey: ['assignedActiveTicketsCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .eq('status', 'in_progress');

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service') && !!user?.id,
  });

  // Query for the 15 latest tickets (still needs full data for display)
  const { data: latestTickets, isLoading: isLoadingLatestTickets } = useQuery<LatestTicket[], Error>({
    queryKey: ['latestTickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          id,
          ticket_number,
          created_at,
          title,
          status,
          priority,
          assigned_to,
          resolved_at,
          assigned_to_profile:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  // Query: Calculate SLA Performance Percentage - only select needed columns
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

  // Query: Calculate Ticket Status Percentages - only select status column
  const { data: ticketStatusPercentages, isLoading: isLoadingTicketStatusPercentages } = useQuery<{ open: number; inProgress: number; resolved: number }, Error>({
    queryKey: ['ticketStatusPercentages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('status');

      if (error) throw new Error(error.message);

      const totalTickets = data.length;
      if (totalTickets === 0) return { open: 0, inProgress: 0, resolved: 0 };

      const openCount = data.filter(ticket => ticket.status === 'open').length;
      const inProgressCount = data.filter(ticket => ticket.status === 'in_progress').length;
      const resolvedCount = data.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed').length;

      return {
        open: (openCount / totalTickets) * 100,
        inProgress: (inProgressCount / totalTickets) * 100,
        resolved: (resolvedCount / totalTickets) * 100,
      };
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  const isLoading = loading || isLoadingAllTickets || isLoadingActiveTickets || isLoadingResolvedTicketsByAgent || isLoadingLatestTickets || isLoadingAssignedActiveTickets || isLoadingSlaPerformance || isLoadingTicketStatusPercentages;

  if (isLoading) {
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
              {role === 'sales' ? allTicketsCount : activeTicketsCount}
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

        {/* Card: Ticket Status Percentages */}
        {(role === 'admin' || role === 'customer_service') && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Status Tiket
              </CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Open:</span>
                  <span className="font-bold">
                    {ticketStatusPercentages?.open !== undefined ? `${ticketStatusPercentages.open.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>In Progress:</span>
                  <span className="font-bold">
                    {ticketStatusPercentages?.inProgress !== undefined ? `${ticketStatusPercentages.inProgress.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Resolved:</span>
                  <span className="font-bold">
                    {ticketStatusPercentages?.resolved !== undefined ? `${ticketStatusPercentages.resolved.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
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
                      
                      const profile = ticket.assigned_to_profile?.[0];
                      const assignedAgentName = profile 
                        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || profile.email 
                        : 'Belum Ditugaskan';

                      // WhatsApp share link
                      const ticketDetailUrl = `${window.location.origin}/tickets/${ticket.id}`;
                      const whatsappMessage = encodeURIComponent(
                        `Halo, saya ingin berbagi detail tiket ini dengan Anda:\n\n` +
                        `No. Tiket: ${ticket.ticket_number}\n` +
                        `Judul: ${ticket.title}\n` +
                        `Status: ${ticket.status.replaceAll('_', ' ')}\n` +
                        `Prioritas: ${ticket.priority}\n` +
                        `Lihat detail lengkap di: ${ticketDetailUrl}`
                      );
                      const whatsappShareLink = `https://wa.me/?text=${whatsappMessage}`;

                      return (
                        <TableRow key={ticket.id}>
                          {/* MED-02: Ticket number now links to detail page */}
                          <TableCell className="font-medium">
                            <Link 
                              to={`/tickets/${ticket.id}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {ticket.ticket_number}
                            </Link>
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
                              {ticket.status.replaceAll('_', ' ')}
                            </span>
                          </TableCell>
                          <TableCell>{assignedAgentName}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                              {slaStatus}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* WhatsApp share button */}
                              <a
                                href={whatsappShareLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-8 w-8 p-0 hover:bg-gray-100 rounded-md"
                                title="Bagikan via WhatsApp"
                              >
                                <Share2 className="h-4 w-4 text-green-600" />
                              </a>
                              {/* View detail button */}
                              <Link to={`/tickets/${ticket.id}`}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">Lihat Detail</span>
                                </Button>
                              </Link>
                            </div>
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