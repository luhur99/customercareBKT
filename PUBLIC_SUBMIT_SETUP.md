# Public Ticket Submission Feature - Setup Guide

## 📋 Overview
Fitur ini memungkinkan pelanggan untuk submit tiket tanpa login menggunakan form publik dengan Turnstile CAPTCHA dan rate limiting.

## 🔧 Environment Variables Required

### Frontend (.env.local atau .env)
```env
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key-here
```

### Supabase Edge Function (supabase/.env.local)
```env
TURNSTILE_SECRET_KEY=your-turnstile-secret-key-here
```

**SUPABASE_URL** dan **SUPABASE_SERVICE_ROLE_KEY** harus sudah tersetting di Supabase dashboard.

## 🛡️ Turnstile Setup (Cloudflare)

1. Buka https://dash.cloudflare.com/
2. Login dengan akun Cloudflare (atau signup gratis)
3. Navigate ke **Turnstile** di left sidebar
4. Klik **Create Site**
5. Isi form:
   - **Domain**: customercarebkt.vercel.app (dan localhost untuk development)
   - **Mode**: Managed Challenge (recommended)
6. Copy **Site Key** → `VITE_TURNSTILE_SITE_KEY`
7. Copy **Secret Key** → `TURNSTILE_SECRET_KEY`

### Development Testing
Tambah domain ke Turnstile setting:
- localhost
- localhost:5173
- localhost:8080
- localhost:3000

## 📁 File Structure
```
supabase/
└── functions/
    └── public-submit-ticket/
        ├── index.ts          (Main Edge Function handler)
        └── deno.json         (Dependencies config)

src/
└── pages/
    └── PublicSubmitComplaint.tsx  (Public form component)
```

## 🚀 Deployment Steps

### 1. Local Testing
```bash
# Terminal 1 - Start Vite dev server
pnpm dev

# Terminal 2 - Start Supabase local
supabase start

# Terminal 3 - Deploy Edge Function locally
cd supabase
supabase edge-deploy public-submit-ticket
```

Akses form di: http://localhost:5173/public-submit

### 2. Production Deployment
```bash
# Set environment variables di Vercel dashboard
# - VITE_TURNSTILE_SITE_KEY
# - NEXT_PUBLIC_TURNSTILE_SITE_KEY (jika pakai Next.js)

# Set Supabase Edge Function secrets
supabase secrets set TURNSTILE_SECRET_KEY "your-secret-key"

# Deploy function
supabase functions deploy public-submit-ticket

# Push ke repo, Vercel auto-deploys
git push origin main
```

Form akan accessible di: https://customercarebkt.vercel.app/public-submit

## 📊 Rate Limiting Policy

**Per IP limit**: 5 requests per 10 minutes

Jika exceed limit:
- Edge Function return HTTP 429 (Too Many Requests)
- Pesan error: "Terlalu banyak permintaan. Coba lagi nanti."

⚠️ **Note**: In-memory rate limiter. Jika ingin persistent per deployment, migrate ke table-based approach.

## ✅ Validation Rules

### Frontend + Server validation parity:

| Field | Rules |
|-------|-------|
| Title | Required, 1-255 chars |
| Description | Optional, max 5000 chars |
| Customer Name | Required, 1-255 chars |
| Customer WhatsApp | Optional, validated format |
| Category | Required, specific enum only |
| No Plat Kendaraan | Required, alphanumeric, max 10 chars |
| No Simcard GPS | Required, start with 0812, max 12 digits |
| Turnstile Token | Required |

## 🔐 Security Features

1. **Turnstile CAPTCHA**: Bot prevention
2. **Server-side validation**: All fields re-validated on backend
3. **Rate limiting**: Prevent spam/DOS
4. **CORS controls**: Only allowed origins can submit
5. **No Direct Insert**: Public forms use Edge Function (not anon key direct insert)

## 🐛 Debugging

Check Supabase function logs:
```bash
supabase functions logs public-submit-ticket
```

Check browser console for errors:
```javascript
// PublicSubmitComplaint.tsx will log responses
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Turnstile tidak render" | VITE_TURNSTILE_SITE_KEY missing/invalid | Add to .env.local, restart dev server |
| "Form submit returns 403" | Invalid/missing Turnstile token | Cloudflare secret key wrong or Turnstile expired |
| "Form submit returns 429" | Rate limit exceeded | Wait 10 min, or submit from different IP |
| "Form submit returns 500" | Function error | Check `supabase functions logs` |
| "CORS error in browser" | Origin not in allowed list | Add localhost to Turnstile domain settings |

## 📝 Ticket Details - Public Submissions

Tickets dari public form memiliki:
- `created_by`: NULL (untuk tracking publik submission)
- `status`: 'open'
- `priority`: 'medium'
- Visible di Dashboard dan Tickets list untuk tim CS
- No file attachments (security feature)

## 🔄 Workflow

1. Customer akses `/public-submit` (tanpa login)
2. Fill form dengan required fields
3. Turnstile CAPTCHA solve
4. Submit → invoke `public-submit-ticket` function
5. Function verifies Turnstile token
6. Function validates payload
7. Function checks rate limit per IP
8. Insert ke `tickets` table dengan `created_by = null`
9. Return `ticket_number` ke frontend
10. Show success message dengan ticket number untuk tracking
11. Ticket muncul di Dashboard untuk tim CS next refresh

## 📞 Support

Untuk testing:
- Situs publik: https://customercarebkt.vercel.app/public-submit
- Form fields sudah auto-validated dengan regex
- Turnstile widget shows "Not a robot" challenge
- Error messages in Indonesian untuk customer clarity
