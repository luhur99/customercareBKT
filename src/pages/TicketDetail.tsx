import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft } from 'lucide-react';

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla'; // Import the SLA utility

// Define ticket status and priority enums
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const COMPLAINT_CATEGORIES = [ // Re-define categories for consistency
  'Technical Issue',
  'Billing Inquiry',
  'Service Interruption',
  'Product Feedback',
  'General Inquiry',
  'Other',
] as const;

// Form schema for updating a ticket
const updateTicketFormSchema = z.object({
  status: z.enum(TICKET_STATUSES, { message: 'Please select a valid status.' }),
  priority: z.enum(TICKET_PRIORITIES, { message: 'Please select a valid priority.' }),
  description: z.string().optional(), // Allow description to be updated
  resolution_steps: z.string().optional(), // New field for resolution steps
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'Kategori keluhan diperlukan.' }), // Allow category to be updated
});

interface Ticket {
  id: string;
  ticket_number: string; // Add new field for automatic ticket number
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
  resolution_steps: string | null;
  category: typeof COMPLAINT_CATEGORIES[number]; // New field in interface
}

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const TicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, loading, role, user } = useSession();
  const queryClient = useQueryClient();

  // Redirect if not logged in or not authorized
  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk melihat detail tiket.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Fetch ticket details
  const { data: ticket, isLoading, error } = useQuery<Ticket, Error>({
    queryKey: ['ticket', id],
    queryFn: async () => {
      if (!id) throw new Error('Ticket ID is missing.');
      const { data, error } = await supabase
        .from('tickets')
        .select('*, ticket_number') // Select ticket_number
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && !!id,
  });

  // Fetch creator's profile
  const { data: creatorProfile, isLoading: isCreatorProfileLoading } = useQuery<UserProfile, Error>({
    queryKey: ['creatorProfile', ticket?.created_by],
    queryFn: async () => {
      if (!ticket?.created_by) throw new Error('Creator ID is missing.');
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', ticket.created_by)
        .single();

      if (error) {
        if (error.code === 'PGRST116') { // No rows found
          return { first_name: null, last_name: null };
        }
        throw new Error(error.message);
      }
      return data;
    },
    enabled: !!ticket?.created_by,
    staleTime: 5 * 60 * 1000, // Cache profile for 5 minutes
  });

  // Initialize form with ticket data
  const form = useForm<z.infer<typeof updateTicketFormSchema>>({
    resolver: zodResolver(updateTicketFormSchema),
    defaultValues: { // Use defaultValues
      status: 'open',
      priority: 'medium',
      description: '',
      resolution_steps: '',
      category: 'General Inquiry', // Initialize new field
    },
  });

  // Reset form values when ticket data is loaded or changes
  useEffect(() => {
    if (ticket) {
      form.reset({
        status: ticket.status,
        priority: ticket.priority,
        description: ticket.description || '',
        resolution_steps: ticket.resolution_steps || '',
        category: ticket.category, // Reset new field
      });
    }
  }, [ticket, form]); // Depend on ticket and form instance

  // Mutation for updating ticket
  const updateTicketMutation = useMutation<any, Error, z.infer<typeof updateTicketFormSchema>>({
    mutationFn: async (updatedData) => {
      if (!id) throw new Error('Ticket ID is missing.');
      const { data, error } = await supabase
        .from('tickets')
        .update({
          status: updatedData.status,
          priority: updatedData.priority,
          description: updatedData.description,
          resolution_steps: updatedData.resolution_steps,
          category: updatedData.category, // Include new field in update
          resolved_at: updatedData.status === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Tiket berhasil diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Invalidate list as well
    },
    onError: (err) => {
      showError(`Gagal memperbarui tiket: ${err.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof updateTicketFormSchema>) => {
    updateTicketMutation.mutate(values);
  };

  // Check if the current user is the creator of the ticket
  const isCreator = user?.id === ticket?.created_by;
  const canManageTickets = role === 'admin' || role === 'customer_service';
  const canViewTicket = isCreator || canManageTickets;

  if (loading || isLoading || isCreatorProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat detail tiket...</p>
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
        <Button onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
      </div>
    );
  }

  if (!ticket || !canViewTicket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Akses Ditolak</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Anda tidak memiliki izin untuk melihat tiket ini atau tiket tidak ditemukan.
        </p>
        <Button onClick={() => navigate(-1)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </Button>
      </div>
    );
  }

  const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at);
  const slaBadgeClass =
    slaStatus === 'green'
      ? 'bg-green-100 text-green-800'
      : slaStatus === 'red'
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-800';

  const creatorName = [creatorProfile?.first_name, creatorProfile?.last_name].filter(Boolean).join(' ') || 'Pengguna Tidak Dikenal';

  return (
    <div className="container mx-auto p-4">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Tiket
      </Button>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white">{ticket.title}</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            No Tiket: {ticket.ticket_number} | Dibuat pada: {new Date(ticket.created_at).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Detail Pelanggan</h3>
              <p><strong>Nama:</strong> {ticket.customer_name || '-'}</p>
              <p><strong>WhatsApp:</strong> {ticket.customer_whatsapp || '-'}</p>
              <p><strong>Dibuat Oleh:</strong> {creatorName}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Status & Prioritas</h3>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                  ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {ticket.status.replace('_', ' ')}
                </span>
              </p>
              <p>
                <strong>Prioritas:</strong>{' '}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  ticket.priority === 'low' ? 'bg-green-100 text-green-800' :
                  ticket.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                  ticket.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {ticket.priority}
                </span>
              </p>
              <p>
                <strong>Kategori:</strong>{' '}
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                  {ticket.category}
                </span>
              </p>
              <p>
                <strong>SLA:</strong>{' '}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                  {slaStatus}
                </span>
              </p>
              {ticket.resolved_at && (
                <p><strong>Diselesaikan pada:</strong> {new Date(ticket.resolved_at).toLocaleString()}</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Deskripsi</h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {ticket.description || 'Tidak ada deskripsi yang diberikan.'}
            </p>
          </div>

          {ticket.resolution_steps && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Langkah Penyelesaian</h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {ticket.resolution_steps}
              </p>
            </div>
          )}

          {canManageTickets && (
            <Card className="mt-8 bg-gray-50 dark:bg-gray-800">
              <CardHeader>
                <CardTitle className="text-xl">Perbarui Tiket</CardTitle>
                <CardDescription>Ubah status, prioritas, deskripsi, atau langkah penyelesaian tiket ini.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kategori</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih kategori" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COMPLAINT_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TICKET_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioritas</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih prioritas" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TICKET_PRIORITIES.map((p) => (
                                <SelectItem key={p} value={p}>
                                  {p.charAt(0).toUpperCase() + p.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deskripsi</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Perbarui deskripsi tiket" rows={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="resolution_steps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Langkah Penyelesaian (Opsional)</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Catat langkah-langkah yang diambil untuk menyelesaikan tiket ini" rows={5} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={updateTicketMutation.isPending}>
                      {updateTicketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Simpan Perubahan
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TicketDetail;