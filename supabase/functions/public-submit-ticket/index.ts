/// <reference types="https://deno.land/x/supabase/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ALLOWED_ORIGINS = [
  'https://customercarebkt.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
];

const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const getCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
  'Content-Type': 'application/json',
});

interface PublicSubmitPayload {
  title: string;
  description?: string;
  customer_name: string;
  customer_whatsapp?: string;
  category: string;
  no_plat_kendaraan: string;
  no_simcard_gps: string;
  cf_turnstile_token: string;
}

// Simple in-memory rate limiter (per IP, per 10 minutes max 5 requests)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(ip);

  if (!limit || now > limit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + 10 * 60 * 1000 });
    return true;
  }

  if (limit.count >= 5) {
    return false;
  }

  limit.count++;
  return true;
}

function validatePayload(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Payload harus berupa JSON object'] };
  }

  const payload = data as Record<string, unknown>;

  // Title
  if (typeof payload.title !== 'string' || payload.title.trim().length === 0) {
    errors.push('Title diperlukan dan harus string');
  } else if (payload.title.length > 255) {
    errors.push('Title maksimal 255 karakter');
  }

  // Description (optional)
  if (payload.description !== undefined && typeof payload.description !== 'string') {
    errors.push('Description harus string jika ada');
  } else if (typeof payload.description === 'string' && payload.description.length > 5000) {
    errors.push('Description maksimal 5000 karakter');
  }

  // Customer name
  if (typeof payload.customer_name !== 'string' || payload.customer_name.trim().length === 0) {
    errors.push('Customer name diperlukan dan harus string');
  } else if (payload.customer_name.length > 255) {
    errors.push('Customer name maksimal 255 karakter');
  }

  // Customer WhatsApp (optional)
  if (payload.customer_whatsapp !== undefined && typeof payload.customer_whatsapp !== 'string') {
    errors.push('Customer WhatsApp harus string jika ada');
  }

  // Category
  const validCategories = ['Technical Issue', 'Billing Inquiry', 'Service Interruption', 'Product Feedback', 'General Inquiry', 'Other'];
  if (typeof payload.category !== 'string' || !validCategories.includes(payload.category)) {
    errors.push('Category tidak valid');
  }

  // No plat kendaraan
  if (typeof payload.no_plat_kendaraan !== 'string' || payload.no_plat_kendaraan.trim().length === 0) {
    errors.push('No plat kendaraan diperlukan');
  } else if (!/^[A-Za-z0-9]{1,10}$/.test(payload.no_plat_kendaraan)) {
    errors.push('No plat kendaraan hanya boleh berisi huruf/angka, max 10 karakter');
  }

  // No simcard GPS
  if (typeof payload.no_simcard_gps !== 'string' || payload.no_simcard_gps.trim().length === 0) {
    errors.push('No simcard GPS diperlukan');
  } else if (!/^0812\d{0,8}$/.test(payload.no_simcard_gps)) {
    errors.push('No simcard GPS harus diawali 0812, max 12 digit');
  }

  // Turnstile token
  if (typeof payload.cf_turnstile_token !== 'string' || payload.cf_turnstile_token.trim().length === 0) {
    errors.push('Turnstile token diperlukan');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

async function verifyTurnstileToken(token: string): Promise<boolean> {
  // Development: Allow bypass token for localhost testing
  if (token === 'bypass-test-token-local') {
    console.warn('[public-submit-ticket] Using development bypass token');
    return true;
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
        response: token,
      }),
    });

    if (!response.ok) {
      console.error('[public-submit-ticket] Turnstile verification failed:', response.status);
      return false;
    }

    const data = await response.json();
    return data.success === true && data.error_codes?.length === 0;
  } catch (error) {
    console.error('[public-submit-ticket] Turnstile verification error:', error);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    console.log(`[public-submit-ticket] Request from IP: ${clientIp}`);

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.warn(`[public-submit-ticket] Rate limit exceeded for IP: ${clientIp}`);
      return new Response(JSON.stringify({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }), {
        status: 429,
        headers: corsHeaders,
      });
    }

    // Parse request body
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: 'Validasi gagal', details: validation.errors }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const data = payload as PublicSubmitPayload;

    // Verify Turnstile token
    const turnstileValid = await verifyTurnstileToken(data.cf_turnstile_token);
    if (!turnstileValid) {
      console.warn('[public-submit-ticket] Invalid Turnstile token');
      return new Response(JSON.stringify({ error: 'Verifikasi keamanan gagal. Coba lagi.' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('[public-submit-ticket] Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Insert ticket with created_by = null for public submissions
    const ticketData = {
      title: data.title.trim(),
      description: (data.description || '').trim(),
      customer_name: data.customer_name.trim(),
      customer_whatsapp: (data.customer_whatsapp || '').trim() || null,
      category: data.category,
      no_plat_kendaraan: data.no_plat_kendaraan.trim(),
      no_simcard_gps: data.no_simcard_gps.trim(),
      status: 'open',
      priority: 'medium',
      created_by: null, // Public submission
      attachments: [],
    };

    const { data: newTicket, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketData)
      .select('id, ticket_number')
      .single();

    if (insertError) {
      console.error('[public-submit-ticket] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Gagal membuat tiket. Coba lagi nanti.' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!newTicket) {
      console.error('[public-submit-ticket] No ticket returned after insert');
      return new Response(JSON.stringify({ error: 'Gagal membuat tiket.' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log(`[public-submit-ticket] Ticket created: ${newTicket.ticket_number}`);

    return new Response(JSON.stringify({
      success: true,
      ticket_number: newTicket.ticket_number,
      message: 'Tiket berhasil dibuat. Tim kami akan segera menangani.',
    }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[public-submit-ticket] Unhandled error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: getCorsHeaders(''),
    });
  }
});
