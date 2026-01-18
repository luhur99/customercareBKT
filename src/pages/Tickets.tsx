import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle, Edit, Search } from 'lucide-react'; // Menambahkan ikon Search

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';

// Define ticket status and priority enums
const TICKET_STATUSES = ['open', 'in_progress', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const USER_ROLES = ['admin', 'customer_service', 'sales'] as const; // Assuming these roles can be assigned

type TicketStatus = typeof TICKET_STATUSES[number];
type TicketPriority = typeof TICKET_PRIORITIES[number];
type UserRole = typeof USER_ROLES[number];

// Interface for the raw profile data returned by Supabase select with auth.users join
interface RawProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  auth_users: { email: string } | null;
}

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string; // This is the email from auth.users
  role: UserRole;
}

interface Ticket {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  created_by: string | null;
  assigned_to: string | null;
  customer_email: string | null;
  customer_name: string | null;
  // Joined data for display
  created_by_user?: { email: string; first_name: string | null; last_name: string | null };
  assigned_to_user?: { email: string; first_name: string | null; last_name: string | null };
}

// Interface for the raw ticket data returned by Supabase select with profile joins
interface RawTicketData extends Omit<Ticket, 'created_by_user' | 'assigned_to_user'> {
  created_by_user: {
    first_name: string | null;
    last_name: string | null;
    auth_users: { email: string } | null;
  } | null;
  assigned_to_user: {
    first_name: string | null;
    last_name: string | null;
    auth_users: { email: string } | null;
  } | null;
}


// Form schema for creating a new ticket
const createTicketFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required.' }),
  description: z.string().optional(),
  status: z.enum(TICKET_STATUSES, { message: 'Please select a valid status.' }).default('open'),
  priority: z.enum(TICKET_PRIORITIES, { message: 'Please select a valid priority.' }).default('medium'),
  customer_email: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  customer_name: z.string().optional(),
});

// Form schema for editing an existing ticket
const editTicketFormSchema = z.object({
  title: z.string().min(1, { message: 'Title is required.' }),
  description: z.string().optional(),
  status: z.enum(TICKET_STATUSES, { message: 'Please select a valid status.' }),
  priority: z.enum(TICKET_PRIORITIES, { message: 'Please select a valid priority.' }),
  assigned_to: z.string().nullable().optional(), // UUID of the assigned user
  customer_email: z.string().email({ message: 'Invalid email address.' }).optional().or(z.literal('')),
  customer_name: z.string().optional(),
});

const Tickets = () => {
  const { session, loading, role, user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);
  const [isEditTicketDialogOpen, setIsEditTicketDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // State for filters and search
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Redirect if not authorized (only admin and customer_service can manage all tickets)
  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk melihat tiket.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Fetch all customer service and admin users for assignment dropdown
  const { data: assignableUsers, isLoading: isLoadingAssignableUsers } = useQuery<UserProfile[], Error>({
    queryKey: ['assignableUsers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role, auth_users:auth.users(email)')
        .in('role', ['admin', 'customer_service']); // Only fetch admins and customer service for assignment

      if (error) throw new Error(error.message);
      if (!data) return []; // Handle null data case

      // Cast data to the expected raw type before mapping
      return (data as unknown as RawProfileData[]).map(p => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.auth_users?.email || 'N/A',
        role: p.role,
      }));
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  // Fetch tickets
  const { data: tickets, isLoading: isLoadingTickets, error: ticketsError } = useQuery<Ticket[], Error>({
    queryKey: ['tickets', statusFilter, priorityFilter, searchTerm], // Add filters to query key
    queryFn: async () => {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          created_by_user:profiles!created_by(first_name, last_name, auth_users:auth.users(email)),
          assigned_to_user:profiles!assigned_to(first_name, last_name, auth_users:auth.users(email))
        `);

      // Apply filters
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter);
      }
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw new Error(error.message);
      if (!data) return []; // Handle null data case

      // Cast data to the expected raw type before mapping
      return (data as unknown as RawTicketData[]).map(ticket => ({
        ...ticket,
        created_by_user: ticket.created_by_user ? {
          first_name: ticket.created_by_user.first_name,
          last_name: ticket.created_by_user.last_name,
          email: ticket.created_by_user.auth_users?.email || 'N/A'
        } : undefined,
        assigned_to_user: ticket.assigned_to_user ? {
          first_name: ticket.assigned_to_user.first_name,
          last_name: ticket.assigned_to_user.last_name,
          email: ticket.assigned_to_user.auth_users?.email || 'N/A'
        } : undefined,
      }));
    },
    enabled: !!session, // Only fetch if logged in
  });

  // Mutation for creating a new ticket
  const createTicketMutation = useMutation<any, Error, z.infer<typeof createTicketFormSchema>>({
    mutationFn: async (newTicketData) => {
      if (!user) throw new Error('Pengguna tidak terautentikasi.');

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          ...newTicketData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Tiket berhasil dibuat!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsCreateTicketDialogOpen(false);
      createTicketForm.reset();
    },
    onError: (error) => {
      showError(`Gagal membuat tiket: ${error.message}`);
    },
  });

  // Mutation for updating an existing ticket
  const updateTicketMutation = useMutation<any, Error, z.infer<typeof editTicketFormSchema>>({
    mutationFn: async (updatedTicketData) => {
      if (!selectedTicket) throw new Error('Tidak ada tiket yang dipilih untuk diperbarui.');

      const { data, error } = await supabase
        .from('tickets')
        .update(updatedTicketData)
        .eq('id', selectedTicket.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Tiket berhasil diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsEditTicketDialogOpen(false);
      setSelectedTicket(null);
    },
    onError: (error) => {
      showError(`Gagal memperbarui tiket: ${error.message}`);
    },
  });

  // Form for creating a new ticket
  const createTicketForm = useForm<z.infer<typeof createTicketFormSchema>>({
    resolver: zodResolver(createTicketFormSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      customer_email: '',
      customer_name: '',
    },
  });

  const onSubmitCreateTicket = (values: z.infer<typeof createTicketFormSchema>) => {
    createTicketMutation.mutate(values);
  };

  // Form for editing an existing ticket
  const editTicketForm = useForm<z.infer<typeof editTicketFormSchema>>({
    resolver: zodResolver(editTicketFormSchema),
  });

  useEffect(() => {
    if (selectedTicket) {
      editTicketForm.reset({
        title: selectedTicket.title,
        description: selectedTicket.description || '',
        status: selectedTicket.status,
        priority: selectedTicket.priority,
        assigned_to: selectedTicket.assigned_to || '',
        customer_email: selectedTicket.customer_email || '',
        customer_name: selectedTicket.customer_name || '',
      });
    }
  }, [selectedTicket, editTicketForm]);

  const onSubmitEditTicket = (values: z.infer<typeof editTicketFormSchema>) => {
    updateTicketMutation.mutate(values);
  };

  const handleAssignToMe = () => {
    if (user?.id) {
      editTicketForm.setValue('assigned_to', user.id);
      showSuccess('Tiket ditugaskan kepada Anda.');
    } else {
      showError('Tidak dapat menugaskan tiket: Pengguna tidak teridentifikasi.');
    }
  };

  if (loading || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">
          {loading ? 'Memuat...' : 'Mengalihkan...'}
        </p>
      </div>
    );
  }

  if (ticketsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Gagal memuat tiket: {ticketsError.message}
        </p>
      </div>
    );
  }

  const canManageTickets = role === 'admin' || role === 'customer_service';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Tiket</h1>

      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 space-y-4 sm:space-y-0 sm:space-x-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-1/3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul atau nama pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(value: TicketStatus | 'all') => setStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select value={priorityFilter} onValueChange={(value: TicketPriority | 'all') => setPriorityFilter(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter Prioritas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Prioritas</SelectItem>
            {TICKET_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManageTickets && (
          <Dialog open={isCreateTicketDialogOpen} onOpenChange={setIsCreateTicketDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Buat Tiket Baru
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Buat Tiket Baru</DialogTitle>
                <DialogDescription>
                  Isi detail untuk membuat tiket dukungan baru.
                </DialogDescription>
              </DialogHeader>
              <Form {...createTicketForm}>
                <form onSubmit={createTicketForm.handleSubmit(onSubmitCreateTicket)} className="space-y-4">
                  <FormField
                    control={createTicketForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Judul</FormLabel>
                        <FormControl>
                          <Input placeholder="Ringkasan singkat masalah" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTicketForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deskripsi (Opsional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Deskripsi rinci masalah" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTicketForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Pelanggan (Opsional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Nama pelanggan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTicketForm.control}
                    name="customer_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Pelanggan (Opsional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="pelanggan@contoh.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createTicketForm.control}
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
                  <DialogFooter>
                    <Button type="submit" disabled={createTicketMutation.isPending}>
                      {createTicketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Buat Tiket
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoadingTickets || isLoadingAssignableUsers ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Memuat tiket...</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioritas</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Dibuat Oleh</TableHead>
                <TableHead>Ditugaskan Ke</TableHead>
                <TableHead>Dibuat Pada</TableHead>
                {canManageTickets && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManageTickets ? 8 : 7} className="text-center">Tidak ada tiket ditemukan.</TableCell>
                </TableRow>
              ) : (
                tickets?.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell className="capitalize">{ticket.status.replace('_', ' ')}</TableCell>
                    <TableCell className="capitalize">{ticket.priority}</TableCell>
                    <TableCell>{ticket.customer_name || ticket.customer_email || '-'}</TableCell>
                    <TableCell>{ticket.created_by_user?.first_name || ticket.created_by_user?.email || '-'}</TableCell>
                    <TableCell>{ticket.assigned_to_user?.first_name || ticket.assigned_to_user?.email || '-'}</TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    {canManageTickets && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setIsEditTicketDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Ticket Dialog */}
      <Dialog open={isEditTicketDialogOpen} onOpenChange={setIsEditTicketDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Tiket</DialogTitle>
            <DialogDescription>
              Perbarui detail tiket dukungan ini.
            </DialogDescription>
          </DialogHeader>
          <Form {...editTicketForm}>
            <form onSubmit={editTicketForm.handleSubmit(onSubmitEditTicket)} className="space-y-4">
              <FormField
                control={editTicketForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Judul</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editTicketForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editTicketForm.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pelanggan (Opsional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editTicketForm.control}
                name="customer_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Pelanggan (Opsional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editTicketForm.control}
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
                control={editTicketForm.control}
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
                control={editTicketForm.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ditugaskan Ke</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih agen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Tidak Ditugaskan</SelectItem>
                        {assignableUsers?.map((assignee) => (
                          <SelectItem key={assignee.id} value={assignee.id}>
                            {assignee.first_name || assignee.email} ({assignee.role.replace('_', ' ')})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between sm:space-x-2 space-y-2 sm:space-y-0">
                {user?.id && (role === 'admin' || role === 'customer_service') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAssignToMe}
                    disabled={updateTicketMutation.isPending || editTicketForm.getValues('assigned_to') === user.id}
                    className="w-full sm:w-auto"
                  >
                    Tugaskan ke Saya
                  </Button>
                )}
                <Button type="submit" disabled={updateTicketMutation.isPending} className="w-full sm:w-auto">
                  {updateTicketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Perbarui Tiket
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tickets;