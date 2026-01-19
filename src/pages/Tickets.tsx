import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Eye } from 'lucide-react';

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'; // Import Tabs components
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla'; // Import the SLA utility

// Define ticket status and priority enums
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

interface Ticket {
  id: string;
  ticket_number: string; // Added ticket_number
  created_at: string;
  title: string;
  description: string | null;
  status: typeof TICKET_STATUSES[number];
  priority: typeof TICKET_PRIORITIES[number];
  created_by: string;
  assigned_to: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  resolved_at: string | null;
  category: string;
  assigned_to_profile: { first_name: string | null; last_name: string | null; email: string | null; } | null; // Added for assigned agent's profile
}

const Tickets = () => {
  const { session, loading, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('unsolved'); // State for active tab

  // Redirect if not admin or customer_service
  useEffect(() => {
    if (!loading && (!session || (role !== 'admin' && role !== 'customer_service'))) {
      showError('Anda tidak memiliki izin untuk mengakses halaman ini.');
      navigate('/');
    }
  }, [session, loading, role, navigate]);

  // Fetch tickets based on active tab
  const { data: tickets, isLoading, error } = useQuery<Ticket[], Error>({
    queryKey: ['tickets', activeTab], // Query key now depends on activeTab
    queryFn: async () => {
      let query = supabase.from('tickets').select('*, ticket_number, assigned_to_profile:profiles!tickets_assigned_to_fkey(first_name, last_name, email)');

      if (activeTab === 'unsolved') {
        query = query.neq('status', 'closed'); // Filter for unsolved tickets
      } else if (activeTab === 'solved') {
        query = query.eq('status', 'closed'); // Filter for solved tickets
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  if (loading || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat tiket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Gagal memuat tiket: {error.message}
        </p>
      </div>
    );
  }

  const canManageTickets = role === 'admin' || role === 'customer_service';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Daftar Tiket</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unsolved">Unsolved</TabsTrigger>
          <TabsTrigger value="solved">Solved</TabsTrigger>
        </TabsList>
        <TabsContent value="unsolved">
          {/* Content for Unsolved tickets */}
        </TabsContent>
        <TabsContent value="solved">
          {/* Content for Solved tickets */}
        </TabsContent>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No Tiket</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Ditugaskan Kepada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Dibuat Pada</TableHead>
              {canManageTickets && <TableHead className="text-right">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageTickets ? 9 : 8} className="text-center py-8 text-gray-500">
                  Tidak ada tiket yang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              tickets?.map((ticket) => {
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
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                        {ticket.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      {ticket.customer_whatsapp ? (
                        <a
                          href={`https://wa.me/${ticket.customer_whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {ticket.customer_name || ticket.customer_whatsapp}
                        </a>
                      ) : (
                        ticket.customer_name || '-'
                      )}
                    </TableCell>
                    <TableCell>{assignedAgentName}</TableCell>
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
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                        {slaStatus}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    {canManageTickets && (
                      <TableCell className="text-right">
                        <Link to={`/tickets/${ticket.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">Lihat Detail</span>
                          </Button>
                        </Link>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Tickets;