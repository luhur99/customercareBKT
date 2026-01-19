-- 1. Buat sequence untuk nomor tiket
CREATE SEQUENCE public.ticket_number_seq;

-- 2. Tambahkan kolom ticket_number ke tabel tickets
ALTER TABLE public.tickets
ADD COLUMN ticket_number TEXT UNIQUE;

-- 3. Buat fungsi untuk menghasilkan nomor tiket yang diformat
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_val BIGINT;
    formatted_date TEXT;
    padded_sequence TEXT;
BEGIN
    -- Dapatkan nilai berikutnya dari sequence
    SELECT nextval('public.ticket_number_seq') INTO next_val;

    -- Format tanggal saat ini sebagai YYYYMMDD
    SELECT TO_CHAR(NOW(), 'YYYYMMDD') INTO formatted_date;

    -- Tambahkan nol di depan ke nomor urut untuk memastikan 4 digit (misalnya, 0001)
    SELECT LPAD(next_val::TEXT, 4, '0') INTO padded_sequence;

    -- Gabungkan prefix, tanggal, dan urutan
    NEW.ticket_number := 'BKT-' || formatted_date || '-' || padded_sequence;

    RETURN NEW;
END;
$$;

-- 4. Buat trigger untuk memanggil fungsi sebelum memasukkan tiket baru
CREATE TRIGGER set_ticket_number
BEFORE INSERT ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.generate_ticket_number();