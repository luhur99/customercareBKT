import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowRight, PlusCircle, Ticket, CheckCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { getSlaStatus } from '@/utils/sla';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

interface Ticket {
  id: string;
  created_at: string;
  title: string;
  status: string;
  priority: string;
  customer_name: string | null;
  resolved_at: string | null;
}

const Dashboard = () => {
  const { session, loading: sessionLoading, role } = useSession();

  // Fetch user profile to get first_name and last_name
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<UserProfile, Error>({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('User ID is missing.');
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return { first_name: null, last_name: null };
        }
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch tickets based on role
  const { data: allTickets, isLoading: ticketsLoading, error: ticketsError } = useQuery<Ticket[], Error>({
    queryKey: ['dashboardTickets', session?.user?.id, role],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      let query = supabase.from('tickets').select('id, created_at, title, status, priority, customer_name, resolved_at');

      if (role === 'sales') {
        query = query.eq('created_by', session.user.id);
      }
      // For admin/customer_service, fetch all tickets to calculate various metrics
      // No specific filter for status here, as we'll filter client-side for cards
      // If no role or other roles, it will return an empty array due to initial check.

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session?.user?.id && !!role,
    staleTime: 60 * 1000, // Cache tickets for 1 minute
  });

  if (sessionLoading || profileLoading || ticketsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat dashboard...</p>
      </div>
    );
  }

  if (profileError || ticketsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Gagal memuat data: {profileError?.message || ticketsError?.message}
        </p>
      </div>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const displayName = fullName || session?.user?.email?.split('@')[0] || 'User';
  const displayRole = role ? role.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '';

  // Calculate metrics from allTickets
  const activeTickets = allTickets?.filter(t => t.status === 'open' || t.status === 'in_progress') || [];
  const resolvedTickets = allTickets?.filter(t => t.status === 'resolved' || t.status === 'closed') || [];
  
  const resolvedWithinSLA = resolvedTickets.filter(t => getSlaStatus(t.created_at, t.resolved_at) === 'green').length;
  const resolvedOutsideSLA = resolvedTickets.filter(t => getSlaStatus(t.created_at, t.resolved_at) === 'red').length;
  const totalResolvedCount = resolvedTickets.length;
  
  const slaPerformancePercentage = totalResolvedCount > 0 
    ? ((resolvedWithinSLA / totalResolvedCount) * 100).toFixed(1) 
    : 'N/A';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-8">
        Selamat Datang, {displayRole} {displayName}!
      </h1>
      <p className="text-center text-lg text-gray-700 dark:text-gray-300 mb-8">
        Ini adalah dashboard pribadi Anda.
      </p>
      {fullName === '' && session?.user?.email && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4 mb-8">
          Nama Anda belum diatur. Anda dapat memperbarui profil Anda di pengaturan.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {/* Card 1: Active Tickets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {role === 'sales' ? 'Keluhan Aktif Anda' : 'Tiket Aktif'}
            </CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeTickets.length}</div>
            <p className="text-xs text-muted-foreground">
              {role === 'sales' ? 'Keluhan yang sedang diproses' : 'Tiket yang belum diselesaikan'}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: SLA Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kinerja SLA</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {slaPerformancePercentage}%
            </div>
            <p className="text-xs text-muted-foreground">
              {resolvedWithinSLA} diselesaikan dalam SLA, {resolvedOutsideSLA} di luar SLA
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Individual Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kinerja Individu</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {role === 'sales' ? allTickets?.length : activeTickets.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {role === 'sales' ? 'Total keluhan diajukan' : 'Tiket aktif yang dikelola'}
            </p>
          </CardContent>
        </Card>
      </div>

      {role === 'sales' && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-bold">Keluhan Anda</CardTitle>
            <Link to="/submit-complaint">
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Ajukan Keluhan Baru
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {allTickets && allTickets.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioritas</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Dibuat Pada</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTickets.map((ticket) => {
                      const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at);
                      const slaBadgeClass =
                        slaStatus === 'green'
                          ? 'bg-green-100 text-green-800'
                          : slaStatus === 'red'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800';
                      return (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.title}</TableCell>
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
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              ticket.priority === 'low' ? 'bg-green-100 text-green-800' :
                              ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                              ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {ticket.priority}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                              {slaStatus}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Link to={`/tickets/${ticket.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ArrowRight className="h-4 w-4" />
                                <span className="sr-only">Lihat Detail</span>
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">Anda belum mengajukan keluhan apa pun.</p>
            )}
          </CardContent>
        </Card>
      )}

      {(role === 'admin' || role === 'customer_service') && (
        <Card className="mt-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xl font-bold">Tiket Aktif ({activeTickets.length})</CardTitle>
            <Link to="/tickets">
              <Button variant="outline" size="sm">
                <ArrowRight className="mr-2 h-4 w-4" /> Lihat Semua Tiket
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {activeTickets && activeTickets.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Pelanggan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioritas</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Dibuat Pada</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTickets.map((ticket) => {
                      const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at);
                      const slaBadgeClass =
                        slaStatus === 'green'
                          ? 'bg-green-100 text-green-800'
                          : slaStatus === 'red'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800';
                      return (
                        <TableRow key={ticket.id}>
                          <TableCell className="font-medium">{ticket.title}</TableCell>
                          <TableCell>{ticket.customer_name || '-'}</TableCell>
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
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              ticket.priority === 'low' ? 'bg-green-100 text-green-800' :
                              ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                              ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {ticket.priority}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                              {slaStatus}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <Link to={`/tickets/${ticket.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <ArrowRight className="h-4 w-4" />
                                <span className="sr-only">Lihat Detail</span>
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">Tidak ada tiket aktif yang ditemukan.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;