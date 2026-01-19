import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';

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
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'Kategori keluhan diperlukan.' }), // New category field
});

const SubmitComplaint = () => {
  const { session, loading, user, role } = useSession(); // Get role from useSession
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !session) {
      showError('Anda perlu masuk untuk mengajukan keluhan.');
      navigate('/login');
    }
    // Allow access for admin, customer_service, and sales roles
    if (!loading && session && !['admin', 'customer_service', 'sales'].includes(role || '')) {
      showError('Anda tidak memiliki izin untuk mengakses halaman ini.');
      navigate('/');
    }
  }, [session, loading, navigate, role]); // Add role to dependencies

  const form = useForm<z.infer<typeof submitComplaintFormSchema>>({
    resolver: zodResolver(submitComplaintFormSchema),
    defaultValues: {
      title: '',
      description: '',
      customer_name: '',
      customer_whatsapp: '',
      category: 'General Inquiry', // Default category
    },
  });

  // Mutation for submitting a new complaint
  const submitComplaintMutation = useMutation<any, Error, z.infer<typeof submitComplaintFormSchema>>({
    mutationFn: async (newComplaintData) => {
      if (!user) throw new Error('Pengguna tidak terautentikasi.');

      const { data, error } = await supabase
        .from('tickets')
        .insert({
          title: newComplaintData.title,
          description: newComplaintData.description,
          customer_name: newComplaintData.customer_name,
          customer_whatsapp: newComplaintData.customer_whatsapp,
          category: newComplaintData.category, // Include category
          status: 'open', // Default status for new complaints
          priority: 'medium', // Default priority for new complaints
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      showSuccess('Keluhan Anda berhasil diajukan!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Invalidate tickets query to refresh list
      form.reset();
      navigate('/'); // Redirect to dashboard after submission
    },
    onError: (error) => {
      showError(`Gagal mengajukan keluhan: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof submitComplaintFormSchema>) => {
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