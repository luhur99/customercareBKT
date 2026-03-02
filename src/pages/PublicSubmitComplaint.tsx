import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';

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

const COMPLAINT_CATEGORIES = [
  'Technical Issue',
  'Billing Inquiry',
  'Service Interruption',
  'Product Feedback',
  'General Inquiry',
  'Other',
] as const;

const publicSubmitComplaintSchema = z.object({
  title: z.string().min(1, { message: 'Judul keluhan diperlukan.' }),
  description: z.string().optional(),
  customer_name: z.string().min(1, { message: 'Nama pelanggan diperlukan.' }),
  customer_whatsapp: z.string().min(1, { message: 'Nomor WhatsApp diperlukan.' }),
  category: z.enum(COMPLAINT_CATEGORIES, { message: 'Kategori keluhan diperlukan.' }),
  no_plat_kendaraan: z
    .string()
    .min(1, { message: 'No plat kendaraan diperlukan.' })
    .max(15, { message: 'No plat kendaraan maksimal 15 karakter.' })
    .regex(/^[A-Za-z0-9 ]+$/, {
      message: 'No plat hanya boleh berisi huruf, angka, dan spasi.',
    }),
  no_simcard_gps: z
    .string()
    .min(1, { message: 'No simcard GPS diperlukan.' })
    .max(15, { message: 'No simcard GPS maksimal 15 digit.' })
    .regex(/^08\d{0,13}$/, {
      message: 'No simcard harus angka, diawali 08, maksimal 15 digit.',
    }),
  cf_turnstile_token: z.string().optional(), // Temporary: Optional for testing
});

const PublicSubmitComplaint = () => {
  const navigate = useNavigate();
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [successTicketNumber, setSuccessTicketNumber] = useState<string>('');

  const form = useForm<z.infer<typeof publicSubmitComplaintSchema>>({
    resolver: zodResolver(publicSubmitComplaintSchema),
    defaultValues: {
      title: '',
      description: '',
      customer_name: '',
      customer_whatsapp: '',
      category: 'General Inquiry',
      no_plat_kendaraan: '',
      no_simcard_gps: '',
      cf_turnstile_token: '',
    },
  });

  const submitComplaintMutation = useMutation({
    mutationFn: async (formData: z.infer<typeof publicSubmitComplaintSchema>) => {
      // Temporary: Skip Turnstile check for testing
      // if (!turnstileToken) {
      //   throw new Error('Silakan selesaikan verifikasi Turnstile.');
      // }

      const response = await supabase.functions.invoke('public-submit-ticket', {
        body: {
          title: formData.title,
          description: formData.description,
          customer_name: formData.customer_name,
          customer_whatsapp: formData.customer_whatsapp,
          category: formData.category,
          no_plat_kendaraan: formData.no_plat_kendaraan,
          no_simcard_gps: formData.no_simcard_gps,
          // Temporary: Bypass Turnstile for testing flow
          cf_turnstile_token: turnstileToken || 'bypass-test-token-local',
        },
      });

      if (response.error) {
        let errorMessage = response.error.message || 'Gagal mengajukan keluhan.';
        const context = (response.error as { context?: Response }).context;

        if (context) {
          try {
            const contentType = context.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const errorBody = await context.json();
              if (typeof errorBody?.error === 'string') {
                errorMessage = errorBody.error;
              } else if (typeof errorBody?.message === 'string') {
                errorMessage = errorBody.message;
              } else {
                errorMessage = JSON.stringify(errorBody);
              }
            } else {
              const textBody = await context.text();
              if (textBody) {
                errorMessage = textBody;
              }
            }
          } catch {
            // keep default error message
          }
        }

        throw new Error(errorMessage);
      }

      return response.data;
    },
    onSuccess: (data) => {
      setSuccessTicketNumber(data.ticket_number);
      showSuccess('Keluhan Anda berhasil diajukan!');
      form.reset();
      setTurnstileToken('');
    },
    onError: (error: Error) => {
      showError(`Gagal mengajukan keluhan: ${error.message}`);
    },
  });

  const onSubmit = async (values: z.infer<typeof publicSubmitComplaintSchema>) => {
    submitComplaintMutation.mutate(values);
  };

  if (successTicketNumber) {
    return (
      <div className="container mx-auto p-4 flex justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white text-center">Berhasil!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Terima kasih telah mengajukan keluhan. Tim kami akan segera menangani masalah Anda.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Nomor Tiket Anda:</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{successTicketNumber}</p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Silakan simpan nomor tiket ini untuk referensi Anda.
            </p>
            <Button onClick={() => window.location.href = '/'} className="w-full">
              Kembali ke Beranda
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Ajukan Keluhan</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Silakan isi detail keluhan Anda di bawah ini. Tim kami akan segera menangani.
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

              <p className="text-sm text-muted-foreground">
                Jika lebih dari 1 kendaraan, cukup 1 unit saja yang ditulis, sisanya di deskripsi.
              </p>

              <FormField
                control={form.control}
                name="no_plat_kendaraan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NO Plat Kendaraan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Contoh: B1234CD"
                        maxLength={10}
                        {...field}
                        onChange={(event) => {
                          const sanitized = event.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                          field.onChange(sanitized);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="no_simcard_gps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>No Simcard yang ada di GPS</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Contoh: 0812..."
                        maxLength={12}
                        {...field}
                        onChange={(event) => {
                          const sanitized = event.target.value.replace(/\D/g, '');
                          field.onChange(sanitized);
                        }}
                      />
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
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama Anda" {...field} />
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
                    <FormLabel>Nomor WhatsApp</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="Contoh: 081234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Verifikasi Keamanan</FormLabel>
                <FormControl>
                  {/* Temporarily disable Turnstile widget for localhost testing due to 400 errors */}
                  {/* Turnstile will be re-enabled in production */}
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded text-sm text-yellow-800 dark:text-yellow-200">
                    Verifikasi keamanan sedang dalam testing. Silakan lanjutkan.
                  </div>
                </FormControl>
                <FormMessage />
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

export default PublicSubmitComplaint;
