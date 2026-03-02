# Deploy Edge Function ke Supabase

## Via Supabase Dashboard (Paling Mudah)

### Method 1: Manual Re-deploy
1. Buka: https://supabase.com/dashboard/project/ailwfzdatuupqlrasoil/functions
2. Cari function **"public-submit-ticket"**
3. Klik menu (⋮) atau tombol **"..."** di samping nama function
4. Pilih **"Redeploy"** atau **"Deploy New Version"**
5. Tunggu beberapa detik sampai status berubah jadi **"Active"**

### Method 2: Deploy from GitHub (Jika sudah linked)
1. Buka: https://supabase.com/dashboard/project/ailwfzdatuupqlrasoil/settings/integrations
2. Pastikan GitHub Integration aktif
3. Setiap push ke `main` branch akan auto-deploy
4. Check di: Functions → public-submit-ticket → Version history

---

## Via CLI (Jika Supabase CLI sudah terinstall)

### Install Supabase CLI (One-time setup)
```powershell
# Via npm
npm install -g supabase

# Atau via scoop
scoop install supabase
```

### Login to Supabase
```powershell
supabase login
```

### Deploy Function
```powershell
# Deploy single function
supabase functions deploy public-submit-ticket --project-ref ailwfzdatuupqlrasoil

# Atau deploy semua functions
supabase functions deploy --project-ref ailwfzdatuupqlrasoil
```

### Set Secrets via CLI
```powershell
# Set secret
supabase secrets set TURNSTILE_SECRET_KEY=your-secret-key --project-ref ailwfzdatuupqlrasoil

# List all secrets
supabase secrets list --project-ref ailwfzdatuupqlrasoil

# Unset secret (if needed)
supabase secrets unset TURNSTILE_SECRET_KEY --project-ref ailwfzdatuupqlrasoil
```

---

## Troubleshooting

### Function tidak update setelah deploy?
- Clear cache browser (Ctrl+Shift+R)
- Tunggu 1-2 menit untuk propagasi
- Check version di Dashboard → Functions → Version history

### Error "No access token"?
```powershell
supabase login
```

### Deploy failed?
- Check file structure: `supabase/functions/public-submit-ticket/index.ts` exists
- Check deno.json valid
- Check no syntax errors in TypeScript

---

## Current Project Reference
```
Project Ref: ailwfzdatuupqlrasoil
Region: ap-southeast-1
Function: public-submit-ticket
```
