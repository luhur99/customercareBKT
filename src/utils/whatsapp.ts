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
