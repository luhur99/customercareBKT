import { supabase } from '@/integrations/supabase/client';

export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
export const MAX_FILE_SIZE_MB = 10;

export const uploadFilesToStorage = async (
  files: File[],
  userId: string,
  ticketId: string,
): Promise<string[]> => {
  const uploads = files.map(async (file) => {
    const fileExtension = file.name.split('.').pop();
    const filePath = `${userId}/${ticketId}/${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExtension}`;

    const { error } = await supabase.storage
      .from('ticket-attachments')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw new Error(`Gagal mengunggah file ${file.name}: ${error.message}`);
    return filePath;
  });

  return Promise.all(uploads);
};
