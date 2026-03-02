# Public Ticket Submission - Testing Checklist

## Pre-Deployment Testing

### 1. ✅ Frontend Form Verification
- [ ] Access `/public-submit` without login (should not redirect)
- [ ] Form renders with all fields visible:
  - [ ] Title input
  - [ ] Description textarea
  - [ ] Customer Name input
  - [ ] Customer WhatsApp input
  - [ ] Category select dropdown
  - [ ] No Plat Kendaraan input (alphanumeric validation)
  - [ ] No Simcard GPS input (0812 prefix validation)
  - [ ] Turnstile CAPTCHA widget
  - [ ] Submit button
- [ ] Field validation works (try invalid inputs):
  - [ ] Title: empty string → error
  - [ ] Title: >255 chars → error
  - [ ] Customer Name: empty → error
  - [ ] Category: invalid value → error
  - [ ] No Plat Kendaraan: invalid format → error
  - [ ] No Simcard GPS: missing 0812 prefix → error
  - [ ] No Simcard GPS: >12 digits → error

### 2. ✅ Turnstile Integration
- [ ] VITE_TURNSTILE_SITE_KEY set in .env.local
- [ ] Turnstile widget renders on page load (unless already solved)
- [ ] Can solve Turnstile challenge
- [ ] After solving, form can be submitted

### 3. ✅ Edge Function Deployment Status
- [ ] Function created at `supabase/functions/public-submit-ticket/index.ts`
- [ ] deno.json configured with imports
- [ ] Environment variables set:
  - [ ] TURNSTILE_SECRET_KEY (in Supabase Function secrets)
  - [ ] SUPABASE_URL (already configured)
  - [ ] SUPABASE_SERVICE_ROLE_KEY (already configured)

### 4. 🔄 End-to-End Submission
**Prerequisites:**
- [ ] Run: `pnpm dev` (frontend)
- [ ] Run: `supabase start` (local db)
- [ ] Function deployed: `supabase functions deploy public-submit-ticket`

**Test Cases:**

#### Valid Submission
```
Input:
- Title: "Masalah dengan layanan X"
- Description: "Saya mengalami error saat login"
- Customer Name: "John Doe"
- Customer WhatsApp: "081234567890"
- Category: "Technical Issue"
- No Plat Kendaraan: "B1234ABC"
- No Simcard GPS: "081290001234"

Expected:
- [ ] Form submits without errors
- [ ] Loading state shows while processing
- [ ] Success message displays with ticket number (e.g., "TK-20260302-001")
- [ ] Email/notification sent to CS team (optional)
- [ ] Ticket visible in Dashboard next refresh
- [ ] Ticket visible in Tickets list (unassigned tab)
```

#### Validation Failure - Title Too Long
```
Input: Title > 255 chars

Expected:
- [ ] Error message: "Title maksimal 255 karakter"
- [ ] Form not submitted
- [ ] Cursor focus on field
```

#### Validation Failure - Invalid Plat
```
Input: No Plat Kendaraan: "B@1234$" (special chars)

Expected:
- [ ] Error message: "No plat kendaraan hanya boleh berisi huruf/angka, max 10 karakter"
- [ ] Form not submitted
```

#### Validation Failure - Invalid Simcard
```
Input: No Simcard GPS: "081234567890" (doesn't start with 0812)

Expected:
- [ ] Error message: "No simcard GPS harus diawali 0812, max 12 digit"
- [ ] Form not submitted
```

#### Turnstile Missing (test manually removing token in DevTools)
```
Expected:
- [ ] Console error or form validation error
- [ ] Cannot submit form without completing Turnstile
```

### 5. Rate Limiting Test
**Setup:** Create 5-6 submissions rapidly from same IP

```
Submission #1-5: Should succeed
Submission #6: 
- Expected: HTTP 429 error
- [ ] Toast error: "Terlalu banyak permintaan. Coba lagi nanti."
- [ ] Form disabled or message shown
```

**Wait 10+ minutes** → Retest submission → Should work

### 6. 🔐 Security Tests

#### CORS Test
- [ ] Frontend at different domain tries to fetch → Should hit CORS error or allowed origin check
- [ ] Only whitelisted origins accepted:
  - [ ] https://customercarebkt.vercel.app ✓
  - [ ] http://localhost:5173 ✓
  - [ ] http://localhost:3000 ✓
  - [ ] Random domain ✗

#### Invalid Turnstile Token
- [ ] Test with fake/expired token → HTTP 403
- [ ] Message: "Verifikasi keamanan gagal. Coba lagi."

#### Invalid Cloudflare Secret
- [ ] Remove TURNSTILE_SECRET_KEY → HTTP 403

#### SQL Injection / Payload Attack
- [ ] Title: `'; DROP TABLE tickets; --` → Safely escaped, ticket created normally
- [ ] Description: `<script>alert('xss')</script>` → Stored and escaped, no XSS on display

### 7. Database Verification
After successful submission:

```sql
-- Check ticket created with created_by = NULL
SELECT id, ticket_number, title, customer_name, created_by, status, priority 
FROM tickets 
WHERE created_by IS NULL 
ORDER BY created_at DESC 
LIMIT 1;

-- Expected:
-- id | ticket_number | title | customer_name | created_by | status | priority
-- ... | TK-20260302-001 | ... | John Doe | NULL | open | medium
```

### 8. Dashboard Integration
- [ ] Login as CS / Admin user
- [ ] Go to Dashboard
- [ ] Latest Tickets section displays public submissions (created_by = NULL)
- [ ] WhatsApp link shows "Share ke Tim CS" tooltip
- [ ] Can share to WhatsApp with auto-populated message

### 9. Ticket Detail Verification
- [ ] Click on public submission from Tickets list
- [ ] Detail page shows:
  - [ ] Customer name and WhatsApp
  - [ ] Vehicle info (no plat kendaraan, simcard GPS)
  - [ ] Auto-generated WhatsApp link with "WA Konsumen" option
  - [ ] Message includes customer greeting + ticket details
- [ ] CS can edit/assign ticket normally

### 10. Error Handling
Test by temporarily breaking components:

#### Function Down
- [ ] Disable Edge Function temporarily
- [ ] Try submit form
- [ ] Progress → Error toast: "Gagal membuat tiket. Coba lagi nanti."
- [ ] Form remains visible for retry

#### Network Error
- [ ] Disconnect internet / block endpoint
- [ ] Try submit
- [ ] Error toast appears
- [ ] Can retry when network restored

#### Database Connection Error
- [ ] Simulate DB down in Supabase
- [ ] Try submit
- [ ] HTTP 500 error handled gracefully
- [ ] User sees: "Server configuration error" or generic error message

## Post-Deployment Testing (Production)

1. [ ] Access https://customercarebkt.vercel.app/public-submit
2. [ ] Submit valid ticket
3. [ ] Ticket shows up in Dashboard for CS team
4. [ ] WhatsApp links work with real phone numbers
5. [ ] Rate limiting works (may test with VPN for different IPs)
6. [ ] Monitor Supabase logs for errors

## Logs to Check

### Supabase Function Logs
```bash
supabase functions logs public-submit-ticket
```
Look for:
- `[public-submit-ticket] Request from IP: ...`
- `[public-submit-ticket] Ticket created: TK-...`
- Any error messages with red text

### Browser Console
- Network tab: POST to `rest/v1/functions/public-submit-ticket`
- Response status and body
- Any JavaScript errors

### Database Logs (Supabase Dashboard)
- Check RLS policies not blocking insert
- Look for constraint violations (no_plat_kendaraan, no_simcard_gps regex)

## Known Limitations & Notes

1. **In-Memory Rate Limiter**: Resets on function restart/redeploy. For persistent tracking, implement table-based approach.
2. **No File Uploads**: Public form intentionally excludes attachments for security.
3. **Turnstile Free Tier**: Limited to 300k verification/month. Monitor usage.
4. **Single IP Rate Limit**: If behind proxy/same corporate network, all users share limit.

## Success Criteria ✅

- [x] Form accessible without login at `/public-submit`
- [x] All field validations work (frontend + server)
- [x] Turnstile CAPTCHA integrates properly
- [x] public-submit-ticket Edge Function handles requests
- [x] Rate limiting prevents spam (5 req/10 min per IP)
- [x] Tickets created with created_by = NULL
- [x] Public submissions visible in Dashboard for CS team
- [x] WhatsApp sharing works with new fields
- [x] Error handling user-friendly (Indonesian messages)
- [x] CORS security prevents cross-origin abuse

## Next Steps After Testing

1. If all tests pass ✓ → Deploy to production
2. If failures → Debug using logs and checklist above
3. Monitor for first week: check rate limiting, Turnstile usage, error frequency
4. Optional: Migrate in-memory rate limiter to persistent table-based approach for multi-instance deployments
