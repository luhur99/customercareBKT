import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send, UploadCloud, XCircle } from 'lucide-react';

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
import { showSuccess, showError, showWarning } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB, uploadFilesToStorage } from '@/utils/fileUpload';

const MAX_FILES = 5;

// Define available complaint categories
const COMPLAINT_CATEGORIES = [
  'Technical Issue',
  'Billing Inquiry',
  'Service Interruption',
  'Product Feedback',
  'General Inquiry',
  'Other',
] as const;

// Define form schema for submitting a new complaint
const submitComplaintFormSchema = z.object({
  title: z.string().min(1, { message: 'Judul keluhan diperlukan.' }),
  description: z.string().optional(),
  customer_name: z.string().min(1, { message: 'Nama pelanggan diperlukan.' }),
  customer_whatsapp: z.string().optional(),
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'Kategori keluhan diperlukan.' }),
});

const SubmitComplaint = () => {
  const { session, loading, user, role } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Redirect if not logged in or unauthorized role
  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk mengajukan keluhan.');
      navigate('/login');
    }
    if (!loading && session && !['admin', 'customer_service', 'sales'].includes(role || '')) {
      showError('Anda tidak memiliki izin untuk mengakses halaman ini.');
      navigate('/');
    }
  }, [session, loading, navigate, role]);

  const form = useForm<z.infer<typeof submitComplaintFormSchema>>({
    resolver: zodResolver(submitComplaintFormSchema),
    defaultValues: {
      title: '',
      description: '',
      customer_name: '',
      customer_whatsapp: '',
      category: 'General Inquiry',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;

    const newFiles = Array.from(event.target.files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Check total file limit
    if (selectedFiles.length + newFiles.length > MAX_FILES) {
      showError(`Maksimal ${MAX_FILES} file diperbolehkan.`);
      return;
    }

    for (const file of newFiles) {
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: tipe file tidak didukung`);
        continue;
      }
      // Validate file size
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        errors.push(`${file.name}: ukuran melebihi ${MAX_FILE_SIZE_MB}MB`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      showError(`File tidak valid: ${errors.join(', ')}`);
    }

    if (validFiles.length > 0) {
      setSelectedFiles((prevFiles) => [...prevFiles, ...validFiles]);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  // Mutation for submitting a new complaint (two-step: create ticket, then upload files)
  const submitComplaintMutation = useMutation({
    mutationFn: async (formData: z.infer<typeof submitComplaintFormSchema>) => {
      if (!user) throw new Error('Pengguna tidak terautentikasi.');

      // Step 1: Create ticket without attachments
      const { data: newTicket, error: insertError } = await supabase
        .from('tickets')
        .insert({
          title: formData.title,
          description: formData.description,
          customer_name: formData.customer_name,
          customer_whatsapp: formData.customer_whatsapp,
          category: formData.category,
          status: 'open',
          priority: 'medium',
          created_by: user.id,
          attachments: [],
        })
        .select()
        .single();

      if (insertError) throw new Error(insertError.message);
      if (!newTicket) throw new Error('Gagal membuat tiket.');

      // Step 2: Upload files and attach to ticket
      if (selectedFiles.length > 0) {
        let filePaths: string[];
        try {
          filePaths = await uploadFilesToStorage(selectedFiles, user.id, newTicket.id);
        } catch (uploadError) {
          showWarning('Tiket dibuat, tetapi lampiran gagal diunggah. Silakan edit tiket untuk menambahkan lampiran.');
          return newTicket;
        }

        const { error: updateError } = await supabase
          .from('tickets')
          .update({ attachments: filePaths })
          .eq('id', newTicket.id);

        if (updateError) {
          showWarning('Tiket dibuat, tetapi gagal menyimpan referensi lampiran.');
        }
      }

      return newTicket;
    },
    onSuccess: () => {
      showSuccess('Keluhan Anda berhasil diajukan!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['latestTickets'] });
      queryClient.invalidateQueries({ queryKey: ['activeTickets'] });
      form.reset();
      setSelectedFiles([]);
      navigate('/');
    },
    onError: (error: Error) => {
      showError(`Gagal mengajukan keluhan: ${error.message}`);
    },
  });

  const onSubmit = async (values: z.infer<typeof submitComplaintFormSchema>) => {
    submitComplaintMutation.mutate(values);
  };

  if (loading || !session || !['admin', 'customer_service', 'sales'].includes(role || '')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">
          {loading ? 'Memuat...' : 'Mengalihkan...'}
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Ajukan Keluhan Baru</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Silakan isi detail keluhan atau masalah Anda di bawah ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori Keluhan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMPLAINT_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
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
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Judul Keluhan</FormLabel>
                    <FormControl>
                      <Input placeholder="Ringkasan singkat masalah Anda" {...field} />
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
                    <FormLabel>Deskripsi (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Jelaskan masalah Anda secara rinci" rows={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Pelanggan</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama lengkap Anda" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customer_whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor WhatsApp (Opsional)</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Contoh: 081234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File Upload Section */}
              <FormItem>
                <FormLabel>Lampiran (Opsional)</FormLabel>
                <FormControl>
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.txt"
                      aria-label="Upload files"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <UploadCloud className="mr-2 h-4 w-4" /> Pilih File
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      Maksimal {MAX_FILES} file, masing-masing maks {MAX_FILE_SIZE_MB}MB. 
                      Format: JPG, PNG, GIF, PDF, TXT.
                    </p>
                  </>
                </FormControl>
                <FormMessage />
                {selectedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">File Terpilih:</p>
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded-md text-sm">
                        <span>{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="h-auto p-1"
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </FormItem>

              <Button type="submit" className="w-full" disabled={submitComplaintMutation.isPending}>
                {submitComplaintMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" /> Ajukan Keluhan
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmitComplaint;