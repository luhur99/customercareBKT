import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { getSlaStatus } from '@/utils/sla';

interface Ticket {
  id: string;
  ticket_number: string;
  created_at: string;
  title: string;
  no_plat_kendaraan: string | null;
  no_simcard_gps: string | null;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customer_name: string | null;
  customer_whatsapp: string | null;
  resolved_at: string | null;
  attachments: string[] | null;
}

const PublicTicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Fetch ticket details - allow anonymous access
  const { data: ticket, isLoading: isLoadingTicket, error: ticketError } = useQuery<Ticket, Error>({
    queryKey: ['publicTicket', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
  });

  // Generate signed URLs for attachments
  const { data: signedAttachmentUrls = {} } = useQuery<Record<string, string>, Error>({
    queryKey: ['publicTicketAttachments', id, ticket?.attachments],
    queryFn: async () => {
      if (!ticket?.attachments || ticket.attachments.length === 0) {
        return {};
      }

      const entries = await Promise.all(
        ticket.attachments.map(async (filePath) => {
          let pathToUse = filePath;
          const legacyMarker = '/object/public/ticket-attachments/';
          if (filePath.includes(legacyMarker)) {
            pathToUse = filePath.split(legacyMarker)[1] ?? filePath;
          }

          const { data, error } = await supabase.storage
            .from('ticket-attachments')
            .createSignedUrl(pathToUse, 60 * 60 * 24);

          if (error || !data?.signedUrl) return [filePath, '#'] as const;
          return [filePath, data.signedUrl] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: !!ticket?.attachments && ticket.attachments.length > 0,
  });

  if (isLoadingTicket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat detail tiket...</p>
      </div>
    );
  }

  if (ticketError || !ticket) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Tiket tidak ditemukan atau tidak dapat diakses.
          </p>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
          </Button>
        </div>
      </div>
    );
  }

  const slaStatus = getSlaStatus(ticket.created_at, ticket.resolved_at, ticket.status);
  const slaBadgeClass =
    slaStatus === 'green'
      ? 'bg-green-100 text-green-800'
      : slaStatus === 'yellow'
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';

  const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const priorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'urgent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detail Tiket #{ticket.ticket_number}</h1>
        <div className="w-20"></div> {/* Spacing for layout balance */}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Tiket</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">No Tiket</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{ticket.ticket_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Judul</p>
                <p className="text-gray-900 dark:text-white">{ticket.title}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Deskripsi</p>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{ticket.description || '-'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Dibuat Pada</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(ticket.created_at).toLocaleString('id-ID', dateTimeFormatOptions)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                    ticket.status === 'open' ? 'bg-yellow-100 text-yellow-800' :
                    ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    ticket.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {ticket.status.replaceAll('_', ' ')}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Prioritas</p>
                <p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${priorityBadgeClass(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail Kendaraan & Layanan</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">NO Plat Kendaraan</p>
                <p className="text-gray-900 dark:text-white font-medium">{ticket.no_plat_kendaraan || '-'}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">No Simcard GPS</p>
                <p className="text-gray-900 dark:text-white font-medium">{ticket.no_simcard_gps || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SLA and Resolved Info */}
        {(slaStatus || ticket.resolved_at) && (
          <Card>
            <CardHeader>
              <CardTitle>Status Penyelesaian</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">SLA Status</p>
                <p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold capitalize ${slaBadgeClass}`}>
                    {slaStatus}
                  </span>
                </p>
              </div>
              {ticket.resolved_at && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Diselesaikan Pada</p>
                  <p className="text-gray-900 dark:text-white">
                    {new Date(ticket.resolved_at).toLocaleString('id-ID', dateTimeFormatOptions)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileIcon className="h-5 w-5" /> Lampiran
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ticket.attachments.map((filePath, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
                    <a
                      href={signedAttachmentUrls[filePath] || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400 flex-1 truncate"
                    >
                      {filePath.split('/').pop()}
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Hubungi Kami</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-gray-700 dark:text-gray-300">
                Jika Anda memiliki pertanyaan tentang tiket ini, silakan hubungi tim customer service kami dengan menyebutkan <strong>No. Tiket: {ticket.ticket_number}</strong>
              </p>
              {ticket.customer_whatsapp && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">WhatsApp yang terdaftar:</p>
                  <a
                    href={`https://wa.me/6285219416002?text=${encodeURIComponent(`Tim CS Jawara Tracker , mohon dibantu update keluhan saya dengan No tiket : ${ticket.ticket_number}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:underline dark:text-green-400 font-medium"
                  >
                    Hubungi via WhatsApp
                  </a>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicTicketDetail;
