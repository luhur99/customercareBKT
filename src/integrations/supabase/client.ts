import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ailwfzdatuupqlrasoil.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbHdmemRhdHV1cHFscmFzb2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NDU0MDAsImV4cCI6MjA4NDMyMTQwMH0.tOdhCGonMjO4Wl3zMB-ftBLknTLoL48-eKVzpOPzdPY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
