/**
 * Formats a WhatsApp number to the international format required by wa.me links.
 * Strips non-digits, removes a leading '0', and prepends '62' (Indonesia country code)
 * if not already present.
 */
export const formatWhatsappNumber = (number: string | null | undefined): string | null => {
  if (!number) return null;
  let cleaned = number.replace(/\D/g, ''); // Remove all non-digits

  // Remove leading '0' if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Prepend '62' if not already starting with it
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  return cleaned || null;
};

interface BuildTicketWhatsappLinkParams {
  phoneNumber?: string | null;
  audience?: 'internal' | 'customer';
  ticket: {
    id: string;
    ticket_number: string;
    title: string;
    description?: string | null;
    customer_whatsapp?: string | null;
    status: string;
    priority: string;
    no_plat_kendaraan?: string | null;
    no_simcard_gps?: string | null;
  };
  origin?: string;
}

export const buildTicketWhatsappLink = ({
  phoneNumber,
  audience = 'internal',
  ticket,
  origin = window.location.origin,
}: BuildTicketWhatsappLinkParams): string => {
  const formattedWhatsapp = formatWhatsappNumber(phoneNumber);
  const ticketDetailUrl = `${origin}/tickets/${ticket.id}`;
  const ticketDescription = (ticket.description || '-').trim();
  const truncatedDescription =
    ticketDescription.length > 300
      ? `${ticketDescription.slice(0, 300)}...`
      : ticketDescription;

  const internalMessage =
    `Halo, berikut detail tiket yang ingin saya bagikan:\n\n` +
    `No. Tiket: ${ticket.ticket_number}\n` +
    `Judul: ${ticket.title}\n` +
    `Deskripsi: ${truncatedDescription}\n` +
    `No WA Konsumen: ${ticket.customer_whatsapp || '-'}\n` +
    `Status: ${ticket.status.replaceAll('_', ' ')}\n` +
    `Prioritas: ${ticket.priority}\n` +
    `NO Plat Kendaraan: ${ticket.no_plat_kendaraan || '-'}\n` +
    `No Simcard GPS: ${ticket.no_simcard_gps || '-'}\n` +
    `Link Tiket: ${ticketDetailUrl}`;

  const customerMessage =
    `Terima kasih Bapak/Ibu, tiket sudah kami terima dengan status: ${ticket.status.replaceAll('_', ' ')}.\n\n` +
    `Detail tiket:\n` +
    `No. Tiket: ${ticket.ticket_number}\n` +
    `Judul: ${ticket.title}\n` +
    `Deskripsi: ${truncatedDescription}\n` +
    `No WA Konsumen: ${ticket.customer_whatsapp || '-'}\n` +
    `Prioritas: ${ticket.priority}\n` +
    `NO Plat Kendaraan: ${ticket.no_plat_kendaraan || '-'}\n` +
    `No Simcard GPS: ${ticket.no_simcard_gps || '-'}\n` +
    `Link Tiket: ${ticketDetailUrl}`;

  const whatsappMessage = encodeURIComponent(audience === 'customer' ? customerMessage : internalMessage);

  if (formattedWhatsapp) {
    return `https://wa.me/${formattedWhatsapp}?text=${whatsappMessage}`;
  }

  return `https://wa.me/?text=${whatsappMessage}`;
};
