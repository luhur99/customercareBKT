import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, PlusCircle } from 'lucide-react';

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

type TicketStatus = typeof TICKET_STATUSES[number];
type TicketPriority = typeof TICKET_PRIORITIES[number];

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

const Tickets = () => {
  const { session, loading, role, user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateTicketDialogOpen, setIsCreateTicketDialogOpen] = useState(false);

  // Redirect if not authorized (only admin and customer_service can manage all tickets)
  useEffect(() => {
    if (!loading && !session) {
      showError('You need to be logged in to view tickets.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Fetch tickets
  const { data: tickets, isLoading: isLoadingTickets, error: ticketsError } = useQuery<Ticket[], Error>({
    queryKey: ['tickets'],
    queryFn: async () => {
      // RLS policies will ensure users only see what they are allowed to see
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session, // Only fetch if logged in
  });

  // Mutation for creating a new ticket
  const createTicketMutation = useMutation<any, Error, z.infer<typeof createTicketFormSchema>>({
    mutationFn: async (newTicketData) => {
      if (!user) throw new Error('User not authenticated.');

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          ...newTicketData,
          created_by: user.id,
          // assigned_to can be set later by a customer service agent
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Ticket created successfully!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setIsCreateTicketDialogOpen(false);
      createTicketForm.reset();
    },
    onError: (error) => {
      showError(`Failed to create ticket: ${error.message}`);
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

  if (loading || !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">
          {loading ? 'Loading...' : 'Redirecting...'}
        </p>
      </div>
    );
  }

  if (ticketsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Failed to load tickets: {ticketsError.message}
        </p>
      </div>
    );
  }

  const canCreateTicket = role === 'admin' || role === 'customer_service'; // Or if it's a customer creating their own ticket

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Tickets</h1>

      {canCreateTicket && (
        <div className="flex justify-end mb-4">
          <Dialog open={isCreateTicketDialogOpen} onOpenChange={setIsCreateTicketDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogDescription>
                  Fill in the details to create a new support ticket.
                </DialogDescription>
              </DialogHeader>
              <Form {...createTicketForm}>
                <form onSubmit={createTicketForm.handleSubmit(onSubmitCreateTicket)} className="space-y-4">
                  <FormField
                    control={createTicketForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Short summary of the issue" {...field} />
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Detailed description of the problem" {...field} />
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
                        <FormLabel>Customer Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Customer's name" {...field} />
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
                        <FormLabel>Customer Email (Optional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="customer@example.com" {...field} />
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
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
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
                      Create Ticket
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoadingTickets ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Loading tickets...</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">No tickets found.</TableCell>
                </TableRow>
              ) : (
                tickets?.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell className="capitalize">{ticket.status.replace('_', ' ')}</TableCell>
                    <TableCell className="capitalize">{ticket.priority}</TableCell>
                    <TableCell>{ticket.customer_name || ticket.customer_email || '-'}</TableCell>
                    <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{ticket.assigned_to || '-'}</TableCell> {/* Will need to fetch user email later */}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Tickets;