import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowLeft, MessageSquare, User, Phone, Mail, Calendar, Tag, Info, CheckCircle, XCircle, Clock, FileText, Edit, Save, Trash2, UploadCloud, File as FileIcon } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  assigned_to: string | null;
  customer_name: string | null;
  customer_whatsapp: string | null;
  resolved_at: string | null;
  resolution_steps: string | null;
  category: string | null;
  attachments: string[] | null; // Tambahkan kolom attachments
  creator_profile: { first_name: string | null; last_name: string | null; email: string | null; } | null;
  assigned_to_profile: { first_name: string | null; last_name: string | null; email: string | null; } | null;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string;
}

const ticketSchema = z.object({
  title: z.string().min(1, 'Judul tidak boleh kosong'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  priority: z.enum(['low', 'medium', 'high']),
  assigned_to: z.string().nullable().optional(),
  customer_name: z.string().optional(),
  customer_whatsapp: z.string().optional(),
  resolution_steps: z.string().optional(),
  category: z.string().optional(),
  attachments: z.array(z.string()).optional(), // Tambahkan attachments ke skema
});

const TicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loading, role, user } = useSession();
  const [isEditing, setIsEditing] = useState(false);

  // State untuk mengelola file yang diunggah
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk melihat detail tiket.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Fetch ticket details
  const { data: ticket, isLoading: isLoadingTicket, error: ticketError } = useQuery<Ticket, Error>({
    queryKey: ['ticket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          creator_profile:profiles!tickets_created_by_fkey(first_name, last_name, email),
          assigned_to_profile:profiles!tickets_assigned_to_fkey(first_name, last_name, email)
        `)
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session,
  });

  // Fetch agents (customer_service and admin roles) for assignment
  const { data: agents, isLoading: isLoadingAgents } = useQuery<Profile[], Error>({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .in('role', ['admin', 'customer_service']);
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session && (role === 'admin' || role === 'customer_service'),
  });

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      assigned_to: null,
      customer_name: '',
      customer_whatsapp: '',
      resolution_steps: '',
      category: '',
      attachments: [], // Default value untuk attachments
    },
    values: {
      title: ticket?.title || '',
      description: ticket?.description || '',
      status: ticket?.status || 'open',
      priority: ticket?.priority || 'medium',
      assigned_to: ticket?.assigned_to || null,
      customer_name: ticket?.customer_name || '',
      customer_whatsapp: ticket?.customer_whatsapp || '',
      resolution_steps: ticket?.resolution_steps || '',
      category: ticket?.category || '',
      attachments: ticket?.attachments || [], // Set nilai awal attachments
    },
  });

  useEffect(() => {
    if (ticket) {
      form.reset({
        title: ticket.title || '',
        description: ticket.description || '',
        status: ticket.status || 'open',
        priority: ticket.priority || 'medium',
        assigned_to: ticket.assigned_to || null,
        customer_name: ticket.customer_name || '',
        customer_whatsapp: ticket.customer_whatsapp || '',
        resolution_steps: ticket.resolution_steps || '',
        category: ticket.category || '',
        attachments: ticket.attachments || [],
      });
      setExistingAttachments(ticket.attachments || []); // Inisialisasi existingAttachments
    }
  }, [ticket, form]);

  // Fungsi untuk mengunggah file ke Supabase Storage
  const uploadFiles = async (files: File[], userId: string, ticketId: string): Promise<string[]> => {
    setIsUploadingFiles(true);
    const uploadedFileUrls: string[] = [];
    for (const file of files) {
      const fileExtension = file.name.split('.').pop();
      const filePath = `${userId}/${ticketId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.error('Error uploading file:', error);
        showError(`Gagal mengunggah file ${file.name}: ${error.message}`);
        setIsUploadingFiles(false);
        throw error;
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(filePath);
        uploadedFileUrls.push(publicUrlData.publicUrl);
      }
    }
    setIsUploadingFiles(false);
    return uploadedFileUrls;
  };

  // Fungsi untuk menghapus file dari Supabase Storage
  const deleteFileFromStorage = async (fileUrl: string) => {
    try {
      // Extract path from public URL
      const urlParts = fileUrl.split('/public/ticket-attachments/');
      if (urlParts.length < 2) {
        console.error('Invalid file URL for deletion:', fileUrl);
        return;
      }
      const filePath = urlParts[1]; // e.g., userId/ticketId/filename.ext

      const { error } = await supabase.storage
        .from('ticket-attachments')
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from storage:', error);
        showError(`Gagal menghapus file dari penyimpanan: ${error.message}`);
        throw error;
      }
      showSuccess('File berhasil dihapus dari penyimpanan.');
    } catch (error) {
      console.error('Error in deleteFileFromStorage:', error);
    }
  };

  // Update ticket mutation
  const updateTicketMutation = useMutation<any, Error, z.infer<typeof ticketSchema>>({
    mutationFn: async (updatedTicket) => {
      const { status: newStatusFromForm, assigned_to: newAssignedToFromForm, resolution_steps, attachments, ...rest } = updatedTicket;

      let finalStatus = newStatusFromForm;
      let finalAssignedTo = newAssignedToFromForm;

      // Check if assignment changed
      const wasAssigned = ticket?.assigned_to !== null;
      const isNowAssigned = newAssignedToFromForm !== null;

      // If ticket was unassigned and is now assigned, and its status was 'open', set to 'in_progress'
      if (!wasAssigned && isNowAssigned && ticket?.status === 'open') {
        finalStatus = 'in_progress';
      }
      // If ticket was assigned and is now unassigned, and its status was 'in_progress', set to 'open'
      else if (wasAssigned && !isNowAssigned && ticket?.status === 'in_progress') {
        finalStatus = 'open';
      }

      const payload: any = { ...rest, status: finalStatus, assigned_to: finalAssignedTo, attachments };

      if (finalStatus === 'resolved' && !ticket?.resolved_at) {
        payload.resolved_at = new Date().toISOString();
        payload.resolution_steps = resolution_steps;
      } else if (finalStatus !== 'resolved' && ticket?.resolved_at) {
        payload.resolved_at = null;
        payload.resolution_steps = null;
      } else if (finalStatus === 'resolved' && ticket?.resolved_at) {
        payload.resolution_steps = resolution_steps;
      }

      const { data, error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', id)
        .select();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Tiket berhasil diperbarui!');
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['latestTickets'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedTicketsByAgentCount'] });
      queryClient.invalidateQueries({ queryKey: ['assignedActiveTicketsCount'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Invalidate general tickets query for tab updates
      setIsEditing(false);
      setSelectedFiles([]); // Clear selected files after successful upload
    },
    onError: (error) => {
      showError(`Gagal memperbarui tiket: ${error.message}`);
    },
  });

  // Delete ticket mutation
  const deleteTicketMutation = useMutation<any, Error, string>({
    mutationFn: async (ticketId) => {
      // Before deleting the ticket, delete all associated files from storage
      if (ticket?.attachments && ticket.attachments.length > 0) {
        const filePathsToDelete = ticket.attachments.map(url => {
          const urlParts = url.split('/public/ticket-attachments/');
          return urlParts.length > 1 ? urlParts[1] : null;
        }).filter(Boolean) as string[];

        if (filePathsToDelete.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('ticket-attachments')
            .remove(filePathsToDelete);
          
          if (storageError) {
            console.error('Error deleting associated files from storage:', storageError);
            // Decide if you want to stop deletion or proceed. For now, we'll log and proceed.
            showError(`Gagal menghapus beberapa lampiran: ${storageError.message}`);
          } else {
            showSuccess('Lampiran tiket berhasil dihapus dari penyimpanan.');
          }
        }
      }

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw new Error(error.message);
      return true;
    },
    onSuccess: () => {
      showSuccess('Tiket berhasil dihapus!');
      queryClient.invalidateQueries({ queryKey: ['latestTickets'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
      queryClient.invalidateQueries({ queryKey: ['resolvedTicketsByAgentCount'] });
      queryClient.invalidateQueries({ queryKey: ['assignedActiveTicketsCount'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Invalidate general tickets query
      navigate('/tickets'); // Redirect to tickets list after deletion
    },
    onError: (error) => {
      showError(`Gagal menghapus tiket: ${error.message}`);
    },
  });

  const onSubmit = async (values: z.infer<typeof ticketSchema>) => {
    if (!isEditing) return; // Jangan submit jika tidak dalam mode edit

    try {
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        if (!user?.id || !id) {
          showError('Pengguna tidak terautentikasi atau ID tiket tidak tersedia untuk mengunggah file.');
          return;
        }
        uploadedUrls = await uploadFiles(selectedFiles, user.id, id);
      }
      
      // Gabungkan lampiran yang sudah ada (setelah dihapus) dengan yang baru diunggah
      const finalAttachments = [...existingAttachments, ...uploadedUrls];
      
      updateTicketMutation.mutate({ ...values, attachments: finalAttachments });
    } catch (error) {
      console.error('Error during file upload or form submission:', error);
      // Error sudah ditangani oleh showError di uploadFiles atau updateTicketMutation
    }
  };

  const handleDelete = () => {
    if (id) {
      deleteTicketMutation.mutate(id);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles((prevFiles) => [...prevFiles, ...Array.from(event.target.files || [])]);
    }
  };

  const handleRemoveSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleRemoveExistingAttachment = async (urlToRemove: string) => {
    if (!isEditing) return; // Hanya izinkan penghapusan saat mode edit

    // Hapus dari Supabase Storage
    await deleteFileFromStorage(urlToRemove);

    // Hapus dari state lokal
    setExistingAttachments((prevUrls) => prevUrls.filter((url) => url !== urlToRemove));
    // Perbarui form value juga
    form.setValue('attachments', form.getValues('attachments')?.filter(url => url !== urlToRemove) || []);
  };

  if (isLoadingTicket || loading || isLoadingAgents) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat detail tiket...</p>
      </div>
    );
  }

  if (ticketError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Gagal memuat tiket: {ticketError.message}
        </p>
        <Button onClick={() => navigate('/tickets')} className="mt-4">
          Kembali ke Daftar Tiket
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Tiket Tidak Ditemukan</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Tiket dengan ID "{id}" tidak ditemukan.
        </p>
        <Button onClick={() => navigate('/tickets')} className="mt-4">
          Kembali ke Daftar Tiket
        </Button>
      </div>
    );
  }

  const creatorName = ticket.creator_profile
    ? [ticket.creator_profile.first_name, ticket.creator_profile.last_name].filter(Boolean).join(' ') || ticket.creator_profile.email
    : 'N/A';

  const assignedAgentName = ticket.assigned_to_profile
    ? [ticket.assigned_to_profile.first_name, ticket.assigned_to_profile.last_name].filter(Boolean).join(' ') || ticket.assigned_to_profile.email
    : 'Belum Ditugaskan';

  const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at, ticket.status);
  const slaBadgeClass =
    slaStatus === 'green'
      ? 'bg-green-100 text-green-800'
      : slaStatus === 'yellow'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';

  const canEdit = role === 'admin' || role === 'customer_service';
  const canDelete = role === 'admin';

  // Format WhatsApp number for hyperlink
  const formattedWhatsapp = ticket.customer_whatsapp ? ticket.customer_whatsapp.replace(/\D/g, '') : ''; // Remove non-digits
  const whatsappLink = formattedWhatsapp ? `https://wa.me/${formattedWhatsapp}` : '#';

  // Date formatting options for Indonesian locale, 24-hour
  const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detail Tiket #{ticket.ticket_number}</h1>
        <div className="flex gap-2">
          {canEdit && (
            <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? 'secondary' : 'default'}>
              {isEditing ? (
                <>
                  <XCircle className="mr-2 h-4 w-4" /> Batal
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" /> Edit
                </>
              )}
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apakah Anda yakin?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini tidak dapat dibatalkan. Ini akan menghapus tiket ini secara permanen dan semua lampiran terkait.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleteTicketMutation.isPending}>
                    {deleteTicketMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Hapus
                  </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Informasi Tiket
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Judul</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} />
                      </FormControl>
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
                        <Textarea {...field} disabled={!isEditing} rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isEditing} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Moved and made always visible: Problem Solving / Resolution Steps */}
                <FormField
                  control={form.control}
                  name="resolution_steps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yang Sudah Dilakukan (Problem Solving)</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={!isEditing} rows={4} placeholder="Jelaskan langkah-langkah yang diambil untuk menyelesaikan tiket ini." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-2">
                <p><strong>No Tiket:</strong> {ticket.ticket_number}</p>
                <p><strong>Dibuat Pada:</strong> {new Date(ticket.created_at).toLocaleString('id-ID', dateTimeFormatOptions)}</p>
                <p><strong>Status:</strong>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </p>
                <p><strong>Prioritas:</strong>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    ticket.priority === 'low' ? 'bg-green-100 text-green-800' :
                    ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {ticket.priority}
                  </span>
                </p>
                <p><strong>SLA:</strong>
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${slaBadgeClass}`}>
                    {slaStatus}
                  </span>
                </p>
                {ticket.resolved_at && (
                  <p><strong>Diselesaikan Pada:</strong> {new Date(ticket.resolved_at).toLocaleString('id-ID', dateTimeFormatOptions)}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" /> Detail Pelanggan & Pembuat
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p><strong>Nama:</strong> {ticket.customer_name || '-'}</p>
                <p>
                  <strong>WhatsApp:</strong>{' '}
                  {ticket.customer_whatsapp ? (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {ticket.customer_whatsapp}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <p><strong>Dibuat Oleh:</strong> <span className="font-medium text-gray-900 dark:text-white">{creatorName}</span></p>
                <p><strong>Email Pembuat:</strong> {ticket.creator_profile?.email || '-'}</p>
              </div>
            </CardContent>
          </Card>

          {(role === 'admin' || role === 'customer_service') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" /> Penugasan & Status
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ditugaskan Kepada</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={!isEditing}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih agen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={null as any}>Belum Ditugaskan</SelectItem>
                            {agents?.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {[agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p><strong>Agen Saat Ini:</strong> {assignedAgentName}</p>
                </div>
                <div className="space-y-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Tiket</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon className="h-5 w-5 text-primary" /> Lampiran
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Tampilan Lampiran yang Sudah Ada */}
              {existingAttachments.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-sm font-medium">Lampiran Tersimpan:</p>
                  {existingAttachments.map((fileUrl, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded-md text-sm">
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline dark:text-blue-400 flex-1 truncate"
                      >
                        {fileUrl.split('/').pop()} {/* Tampilkan nama file dari URL */}
                      </a>
                      {isEditing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveExistingAttachment(fileUrl)}
                          className="h-auto p-1 ml-2"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Bagian Unggah File Baru (hanya terlihat saat mode edit) */}
              {isEditing && (
                <FormItem>
                  <FormLabel>Unggah Lampiran Baru (Opsional)</FormLabel>
                  <FormControl>
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        aria-label="Upload files"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full"
                        disabled={isUploadingFiles}
                      >
                        {isUploadingFiles ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="mr-2 h-4 w-4" />
                        )}
                        Pilih File Baru
                      </Button>
                    </>
                  </FormControl>
                  <FormMessage />
                  {selectedFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">File Baru Terpilih:</p>
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-md text-sm">
                          <span>{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveSelectedFile(index)}
                            className="h-auto p-1"
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </FormItem>
              )}
            </CardContent>
          </Card>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={updateTicketMutation.isPending || isUploadingFiles}>
                {(updateTicketMutation.isPending || isUploadingFiles) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> Simpan Perubahan
              </Button>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default TicketDetail;