# 🔍 Code Audit Report — customercareBKT
**Date:** 2026-02-18  
**Auditor:** Cline AI  
**Scope:** Full codebase — frontend (React/TypeScript), Supabase Edge Functions, database migrations  

---

## Table of Contents
1. [Summary](#summary)
2. [Critical Issues](#critical-issues)
3. [High Severity Issues](#high-severity-issues)
4. [Medium Severity Issues](#medium-severity-issues)
5. [Low Severity / Code Quality Issues](#low-severity--code-quality-issues)
6. [Positive Observations](#positive-observations)

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 7 |
| 🟡 Medium | 11 |
| 🔵 Low / Code Quality | 8 |
| **Total** | **29** |

---

## Critical Issues

---

### 🔴 CRIT-01 — Hardcoded Supabase Credentials in Source Code
**File:** `src/integrations/supabase/client.ts`

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ailwfzdatuupqlrasoil.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Problem:**  
The Supabase project URL and anon key are hardcoded as fallback strings directly in source code. Since this project is version-controlled (GitHub), these credentials are now permanently exposed in git history, even if removed later.

Although the `anon` key itself is intentionally public, the full project URL combined with the key gives attackers enough information to craft targeted requests against your Supabase instance (e.g., brute-forcing RLS bypasses, storage abuse, enumeration attacks).

**Fix:**  
Remove the hardcoded fallbacks entirely. Rely only on env variables, and ensure `.env` is in `.gitignore`. Add input validation to fail fast if env variables are missing:

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

### 🔴 CRIT-02 — `sales` Role Has No INSERT RLS Policy for Tickets
**Files:** `src/pages/SubmitComplaint.tsx`, `supabase/migrations/0015_*.sql`

**Problem:**  
The UI allows users with the `sales` role to access `/submit-complaint` and submit new tickets. However, the RLS INSERT policy on the `tickets` table only permits `admin` and `customer_service` roles:

```sql
-- From migration 0015
CREATE POLICY "Customer service and admins can create tickets" ON public.tickets
FOR INSERT TO authenticated
WITH CHECK (
  (get_my_role() IN ('admin', 'customer_service'))
);
```

When a `sales` user tries to submit a complaint, Supabase will silently reject the INSERT due to RLS, and the user will see an error. The UI shows the form and lets them fill it in, only to fail at submission — a bad user experience and a functional bug.

**Fix:**  
Either add `'sales'` to the INSERT RLS policy:
```sql
WITH CHECK (get_my_role() IN ('admin', 'customer_service', 'sales'))
```
Or remove the `/submit-complaint` route from the `sales` navigation and redirect them away. Pick whichever reflects the intended design.

---

### 🔴 CRIT-03 — Unrestricted CORS in Edge Function
**File:** `supabase/functions/admin-users/index.ts`

```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
}
```

**Problem:**  
The admin edge function (which creates users, changes roles, and lists all users) accepts requests from **any origin**. An attacker could craft cross-site requests that impersonate an admin session if they can steal an auth token.

**Fix:**  
Restrict `Access-Control-Allow-Origin` to your known app origin(s):
```ts
const allowedOrigins = ['https://your-production-domain.com', 'http://localhost:8080'];

const corsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
});
```

---

## High Severity Issues

---

### 🟠 HIGH-01 — Duplicate Auth State Management (Layout + SessionContextProvider)
**Files:** `src/components/Layout.tsx`, `src/components/SessionContextProvider.tsx`

**Problem:**  
`Layout.tsx` independently manages its own `session`, `role` state with a dedicated `useEffect` and `fetchRole` function — completely duplicating the logic already in `SessionContextProvider`. This means:
- Two separate `supabase.auth.getSession()` calls on every page load
- Two separate `supabase.auth.onAuthStateChange()` subscriptions active simultaneously
- Two separate profile queries per login (`fetchRole` in Layout + `fetchUserProfile` in Provider)
- Auth state can diverge between the two, causing stale UI

**Fix:**  
`Layout.tsx` should consume the session context via `useSession()` instead of managing its own state:

```tsx
// Layout.tsx — replace state + effects with:
import { useSession } from '@/components/SessionContextProvider';

const Layout = ({ children }: LayoutProps) => {
  const { session, role } = useSession();
  // remove all useState, useEffect, fetchRole
  ...
};
```

---

### 🟠 HIGH-02 — `location.pathname` in `useEffect` Dependencies Causes Auth Re-subscription on Every Navigation
**File:** `src/components/SessionContextProvider.tsx`

```tsx
useEffect(() => {
  setupAuthListener();
  return () => { if (authSubscription) authSubscription.unsubscribe(); };
}, [navigate, location.pathname, fetchUserProfile]); // ← location.pathname here
```

**Problem:**  
`location.pathname` changes on every route change. Since it's in the dependency array, the `setupAuthListener` effect re-runs on every navigation — unsubscribing and re-subscribing to `onAuthStateChange` every time. This means:
- A new auth listener is created on every page visit
- `supabase.auth.getSession()` is called on every navigation
- Profile is re-fetched on every navigation

**Fix:**  
Move the `location.pathname` redirect logic outside of the effect, or use a separate effect with an empty dependency array for the auth listener:

```tsx
// Auth listener — only set up once
useEffect(() => {
  const setupAuthListener = async () => { /* ... */ };
  setupAuthListener();
  return () => { if (authSubscription) authSubscription.unsubscribe(); };
}, []); // ← empty deps, run once

// Redirect logic — separate effect
useEffect(() => {
  if (!loading && !session && location.pathname !== '/login') {
    navigate('/login');
  }
}, [loading, session, location.pathname, navigate]);
```

---

### 🟠 HIGH-03 — File Uploads Use Temporary Folder Path, Not Real Ticket ID
**File:** `src/pages/SubmitComplaint.tsx`

```tsx
// Generate a temporary ticket ID for the folder structure
const tempTicketIdForFolder = crypto.randomUUID();
uploadedUrls = await uploadFiles(selectedFiles, user.id, tempTicketIdForFolder);
```

**Problem:**  
Files are uploaded to storage **before** the ticket is created (because we need to insert attachment URLs into the ticket). A `crypto.randomUUID()` is used as a fake ticket ID for the folder path. The actual ticket ID (returned from the INSERT) is never used to organize the files. This means:
- Storage paths (`userId/fakeId/file.ext`) do not match actual ticket IDs
- If the ticket INSERT fails after the files are uploaded, the files are orphaned in storage with no way to clean them up
- Searching for attachments by ticket ID in storage is impossible

**Fix:**  
Use a two-step approach: first create the ticket (without attachments), then upload files using the real ticket ID, then update the ticket with the attachment URLs:

```tsx
// 1. Create ticket first
const { data: newTicket } = await supabase.from('tickets').insert({...}).select().single();
// 2. Upload files with real ticket ID
const urls = await uploadFiles(files, user.id, newTicket.id);
// 3. Update ticket with attachment URLs
await supabase.from('tickets').update({ attachments: urls }).eq('id', newTicket.id);
```

---

### 🟠 HIGH-04 — `priority: 'urgent'` Exists in DB but Fails Form Validation in TicketDetail
**Files:** `src/pages/Tickets.tsx`, `src/pages/TicketDetail.tsx`

**Problem:**  
In `Tickets.tsx`, the `priority` type is defined as:
```ts
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
```

But in `TicketDetail.tsx`, the Zod schema only accepts:
```ts
priority: z.enum(['low', 'medium', 'high']),
```

If a ticket with `priority: 'urgent'` is opened in the detail view, the Zod validation will fail, the form will be in an invalid state, and saving will silently break or show unexpected errors.

**Fix:**  
Align the schema in `TicketDetail.tsx` to include `'urgent'`:
```ts
priority: z.enum(['low', 'medium', 'high', 'urgent']),
```
And add the `urgent` option to the `SelectItem` list in the status/priority section.

---

### 🟠 HIGH-05 — `SelectItem` with `null` as Value (Type Unsafe)
**File:** `src/pages/TicketDetail.tsx`

```tsx
<SelectItem value={null as any}>Belum Ditugaskan</SelectItem>
```

**Problem:**  
`SelectItem` expects a `string` value. Passing `null as any` bypasses TypeScript's type checking. At runtime, when the user selects "Belum Ditugaskan", the form field may receive `null`, `"null"` (string), or `undefined` depending on the Radix Select implementation — all of which can cause unexpected database writes (e.g., the string `"null"` stored in the `assigned_to` column instead of a proper SQL NULL).

**Fix:**  
Use a sentinel string value and convert it to `null` before saving:
```tsx
<SelectItem value="__unassigned__">Belum Ditugaskan</SelectItem>

// In mutationFn:
const finalAssignedTo = newAssignedToFromForm === '__unassigned__' ? null : newAssignedToFromForm;
```

---

### 🟠 HIGH-06 — Dashboard Fetches Full Row Data When Only Counts Are Needed
**File:** `src/pages/Dashboard.tsx`

**Problem:**  
Multiple queries fetch complete ticket rows just to get a count or percentage:

```ts
// Fetches ALL ticket rows just to count them
const { data: activeTickets } = useQuery({
  queryFn: async () => {
    const { data } = await supabase.from('tickets').select('*').neq('status', 'closed');
    return data; // Only .length is used
  }
});

// Fetches ALL tickets + status column just to compute 3 percentages
const { data: ticketStatusPercentages } = useQuery({
  queryFn: async () => {
    const { data } = await supabase.from('tickets').select('status');
    // computed in JS
  }
});
```

This is also done for `slaPerformancePercentage` (fetches `created_at, resolved_at, status` for ALL tickets). At scale, this transfers megabytes of data unnecessarily.

**Fix:**  
Use Supabase count queries and aggregation:
```ts
// For counts:
const { count } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).neq('status', 'closed');

// For status breakdown, consider a DB function or at minimum use select('status') only
```

---

### 🟠 HIGH-07 — No File Type or Size Validation on Uploads
**Files:** `src/pages/SubmitComplaint.tsx`, `src/pages/TicketDetail.tsx`

**Problem:**  
The file upload handlers accept any file of any size:
```tsx
<input type="file" ref={fileInputRef} multiple onChange={handleFileChange} />
```

There is no validation for:
- File type (e.g., executable files `.exe`, `.sh`, `.bat` could be uploaded)
- File size (a user could upload a 10GB file, exhausting storage quota)
- Number of files per ticket

**Fix:**  
Add validation before uploading:
```tsx
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'];
const MAX_FILE_SIZE_MB = 10;

const handleFileChange = (event) => {
  const files = Array.from(event.target.files || []);
  const invalid = files.filter(f => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
  if (invalid.length > 0) {
    showError(`Invalid files: check type (allowed: PDF, images) and size (max ${MAX_FILE_SIZE_MB}MB)`);
    return;
  }
  setSelectedFiles(prev => [...prev, ...files]);
};
```

---

## Medium Severity Issues

---

### 🟡 MED-01 — "Take Ticket" Button Disables All Rows When Any Mutation Is Pending
**File:** `src/pages/Tickets.tsx`

```tsx
<Button disabled={takeTicketMutation.isPending}>Take Ticket</Button>
```

**Problem:**  
`takeTicketMutation.isPending` is a single boolean for the entire component. When any "Take Ticket" button is clicked, ALL "Take Ticket" buttons across all rows become disabled. This prevents agents from acting on other tickets while one request is in flight.

**Fix:**  
Track pending state per ticket ID:
```tsx
const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);

// In mutation:
onMutate: (ticketId) => setPendingTicketId(ticketId),
onSettled: () => setPendingTicketId(null),

// In button:
disabled={pendingTicketId === ticket.id}
```

---

### 🟡 MED-02 — Ticket Number Cell Links to WhatsApp Instead of Ticket Detail
**File:** `src/pages/Dashboard.tsx`

```tsx
<TableCell className="font-medium">
  <a href={whatsappShareLink} target="_blank" ...>
    {ticket.ticket_number}
  </a>
</TableCell>
```

**Problem:**  
The ticket number, which users naturally expect to be a link to the ticket detail page, is wired to open a WhatsApp share dialog. The actual detail button is a separate eye icon at the far right. This is confusing UX and a mismatch of affordance.

**Fix:**  
Make the ticket number link to `/tickets/${ticket.id}` and place the WhatsApp share as a separate icon button.

---

### 🟡 MED-03 — WhatsApp Number Formatting Is Inconsistent Across Pages
**Files:** `src/pages/TicketDetail.tsx`, `src/pages/Tickets.tsx`

**Problem:**  
`Tickets.tsx` has a proper `formatWhatsappNumber` helper that strips non-digits and prepends `62`. But `TicketDetail.tsx` only strips non-digits without adding the country code:

```tsx
// TicketDetail.tsx — INCOMPLETE (missing country code)
const formattedWhatsapp = ticket.customer_whatsapp ? ticket.customer_whatsapp.replace(/\D/g, '') : '';
```

A number like `081234567890` would become `081234567890` in TicketDetail (invalid for `wa.me`) but `6281234567890` in Tickets (correct).

**Fix:**  
Extract `formatWhatsappNumber` to `src/utils/whatsapp.ts` and import it in both pages.

---

### 🟡 MED-04 — `profiles` Query in Dashboard Fetches Data That Is Never Rendered
**File:** `src/pages/Dashboard.tsx`

```tsx
// Query for profiles - still needed for agent count if desired elsewhere
const { data: profiles, isLoading: isLoadingProfiles } = useQuery<Profile[]>({
  queryFn: async () => {
    const { data } = await supabase.from('profiles').select('*'); // Fetches ALL profile data
    return data;
  },
  ...
});
```

**Problem:**  
`profiles` is fetched (all columns, all rows) but never referenced in the JSX. It contributes to the global loading spinner via `isLoadingProfiles` in the loading condition, needlessly blocking the entire dashboard render.

**Fix:**  
Remove this query entirely until it is actually needed.

---

### 🟡 MED-05 — Duplicate SELECT Policies on `tickets` Table
**File:** `supabase/migrations/0018_*.sql`

```sql
CREATE POLICY "Users can view their own tickets" ON public.tickets
FOR SELECT TO authenticated
USING (auth.uid() = created_by);

CREATE POLICY "Customer service and admins can view all tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
    (auth.uid() = created_by) OR
    (get_my_role() = ANY (ARRAY['admin'::user_role, 'customer_service'::user_role]))
);
```

**Problem:**  
Both policies cover `auth.uid() = created_by`. The first policy is entirely redundant since the second already includes that condition. Duplicate permissive policies create unnecessary overhead on every query as PostgreSQL evaluates both.

**Fix:**  
Drop the first policy and keep only the second (which is a superset):
```sql
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;
```

---

### 🟡 MED-06 — `existingAttachments` State and Form State Can Diverge in TicketDetail
**File:** `src/pages/TicketDetail.tsx`

**Problem:**  
There are two parallel sources of truth for the current attachments:
1. `existingAttachments` (local `useState`)
2. `form.getValues('attachments')` (react-hook-form state)

When `handleRemoveExistingAttachment` is called, both are manually updated. If either update fails or is missed, the two states diverge, potentially re-adding deleted attachments on save or losing attachments on save.

**Fix:**  
Use a single source of truth. Keep `existingAttachments` as the local state, and only set the form `attachments` field at the moment of submission (in `onSubmit`), not during individual removal events.

---

### 🟡 MED-07 — `getPublicUrl` Used for Private Storage Bucket
**Files:** `src/pages/SubmitComplaint.tsx`, `src/pages/TicketDetail.tsx`

```tsx
const { data: publicUrlData } = supabase.storage
  .from('ticket-attachments')
  .getPublicUrl(filePath);
uploadedFileUrls.push(publicUrlData.publicUrl);  // Stored in DB
```

**Problem:**  
The attachment URLs stored in the database are **public URLs**. However, `TicketDetail.tsx` then generates **signed URLs** to display them, implying the bucket is (or should be) private. If the bucket is private, the stored public URLs are invalid and will return 403 errors when accessed directly. If the bucket is public, the signed URL generation is unnecessary overhead.

**Fix:**  
Decide on one strategy:
- **Private bucket (recommended):** Store only the file path in the database (not the full URL). Generate signed URLs on demand for display.
- **Public bucket:** Store the public URL and display it directly without signed URLs.

---

### 🟡 MED-08 — Signed Attachment URLs Expire After 1 Hour With No Refresh Mechanism
**File:** `src/pages/TicketDetail.tsx`

```tsx
.createSignedUrl(filePath, 60 * 60); // 1 hour
```

**Problem:**  
If a user keeps the TicketDetail page open for more than 1 hour and then tries to download an attachment, the link will return a 403 error. There is no mechanism to refresh expired URLs.

**Fix:**  
Either increase the expiry duration, or add a refresh mechanism (re-generate signed URLs when the user hovers/clicks the link).

---

### 🟡 MED-09 — `admin-users` Edge Function Maps `created_at` to `updated_at`
**File:** `supabase/functions/admin-users/index.ts`

```ts
const formattedUsers = usersData.map(p => ({
  ...
  created_at: p.updated_at, // Mapped to updated_at for display
}));
```

**Problem:**  
The "Created At" column in the Manage Roles table actually shows the `updated_at` timestamp. This is silently misleading — an admin might think a user was created recently when they were actually just recently updated.

**Fix:**  
Add the actual `created_at` column to the profiles table (it's missing — only `updated_at` exists per migration 0000), or fetch `created_at` from `auth.users` via the admin client:
```ts
const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
// Merge with profiles data to get true created_at
```

---

### 🟡 MED-10 — `status.replace('_', ' ')` Only Replaces First Underscore
**Files:** `Dashboard.tsx`, `Tickets.tsx`, `TicketDetail.tsx`

```tsx
{ticket.status.replace('_', ' ')}
```

**Problem:**  
JavaScript's `String.replace` with a string pattern only replaces the **first** occurrence. While current status values only have one underscore (`in_progress`), this is fragile and should use `replaceAll` or a global regex.

**Fix:**  
```tsx
{ticket.status.replaceAll('_', ' ')}
// or
{ticket.status.replace(/_/g, ' ')}
```

---

### 🟡 MED-11 — No Error Boundary in the Application
**File:** `src/App.tsx`

**Problem:**  
There is no React Error Boundary anywhere in the component tree. If any component throws an uncaught runtime error (e.g., accessing a property of `undefined`), the entire app will unmount and show a blank white screen with no user feedback.

**Fix:**  
Wrap the app in an error boundary:
```tsx
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <h1>Something went wrong. Please refresh.</h1>;
    return this.props.children;
  }
}

// In App.tsx:
<ErrorBoundary><QueryClientProvider>...</QueryClientProvider></ErrorBoundary>
```

---

## Low Severity / Code Quality Issues

---

### 🔵 LOW-01 — Unnecessary `import React` Statements (React 17+ / Automatic JSX Transform)
**Files:** `Dashboard.tsx`, `Tickets.tsx`, `TicketDetail.tsx`, `SubmitComplaint.tsx`, `ManageRoles.tsx`, `SessionContextProvider.tsx`

With React 17+ and the automatic JSX transform (configured via `@vitejs/plugin-react-swc`), you do not need to `import React from 'react'` in every file. These are harmless but clutter the codebase. Remove them unless `React` is explicitly referenced (e.g., `React.ChangeEvent`, `React.FC`).

---

### 🔵 LOW-02 — `Index.tsx` (`/welcome` route) Is Dead Code
**File:** `src/pages/Index.tsx`, `src/App.tsx`

The `Index` component is mounted at `/welcome` — a route that is never linked to from anywhere in the navigation. It still contains placeholder text ("Welcome to Your Blank App") from the initial scaffold. This should either be repurposed or deleted.

---

### 🔵 LOW-03 — `// @ts-nocheck` in Edge Function
**File:** `supabase/functions/admin-users/index.ts`

The entire edge function disables TypeScript checking. This removes all type safety from the most security-sensitive part of the application (admin user management). The reason is likely due to Deno-specific globals (`Deno.serve`, `Deno.env`).

**Fix:**  
Add Deno type definitions instead:
```ts
// At top of file, remove @ts-nocheck and add:
/// <reference types="https://deno.land/x/supabase/edge-runtime.d.ts" />
```

---

### 🔵 LOW-04 — Stale / Misleading Comments in `App.tsx`
**File:** `src/App.tsx`

```tsx
import Index from "./pages/Index"; // Renamed to Welcome for now
import Dashboard from "./pages/Dashboard"; // Import the new Dashboard page
```

These inline comments add noise rather than signal. The component names are self-documenting. Remove them.

---

### 🔵 LOW-05 — Inconsistent UI Language (Indonesian vs English Mixed)
**Files:** Multiple

The application mixes Indonesian and English labels throughout the UI:
- `ManageRoles.tsx` is entirely in English ("Manage User Roles", "Create New User", "Loading...")
- `Dashboard.tsx`, `Tickets.tsx`, `SubmitComplaint.tsx` are predominantly Indonesian
- Tab labels in `Tickets.tsx`: "Unassigned", "My Tickets", "Resolved" (English), but header is "Daftar Tiket" (Indonesian)
- `SessionContextProvider.tsx` toast: "Logged in successfully!" (English), but `SubmitComplaint.tsx` error: "Anda perlu masuk..." (Indonesian)

**Fix:**  
Pick one language for the UI and apply it consistently. If the target audience is Indonesian, translate all remaining English strings. Consider using an i18n library (`react-i18next`) for maintainability.

---

### 🔵 LOW-06 — `assigned_to` Query Key Missing `user?.id` in `invalidateQueries`
**File:** `src/pages/Tickets.tsx`

```tsx
queryClient.invalidateQueries({ queryKey: ['tickets', 'unassigned'] });
queryClient.invalidateQueries({ queryKey: ['tickets', 'in_progress'] });
```

The actual query key includes `user?.id` as the third element: `['tickets', activeTab, user?.id]`. Invalidating with only `['tickets', 'unassigned']` may not correctly match and invalidate the cached query.

**Fix:**  
```tsx
queryClient.invalidateQueries({ queryKey: ['tickets'] }); // Invalidates all tickets queries
```

---

### 🔵 LOW-07 — Missing `priority` Input in `SubmitComplaint`
**File:** `src/pages/SubmitComplaint.tsx`

All tickets are created with `priority: 'medium'` hardcoded. The `sales` role (once CRIT-02 is fixed) and internal agents submitting complaints have no way to set urgency. Consider adding a priority selector to the form.

---

### 🔵 LOW-08 — `@dyad-sh/react-vite-component-tagger` Plugin in Production Build
**File:** `vite.config.ts`

```ts
plugins: [dyadComponentTagger(), react()],
```

`dyadComponentTagger` (a development/debugging tool) is included in the Vite plugins array without a `mode` guard, meaning it runs in **production builds** as well. This adds unnecessary code to the production bundle.

**Fix:**  
Guard it with the `mode` parameter:
```ts
export default defineConfig(({ mode }) => ({
  plugins: [
    mode === 'development' && dyadComponentTagger(),
    react(),
  ].filter(Boolean),
}));
```

---

## Positive Observations

The following aspects of the codebase are well-implemented and worth acknowledging:

- ✅ **RLS is enabled** on all tables (`profiles`, `tickets`), which is the most important Supabase security baseline.
- ✅ **`get_my_role()` SECURITY DEFINER function** correctly solves the infinite recursion problem in RLS policies that reference the same table.
- ✅ **`SessionContextProvider` prevents double-fetching** via `isFetchingProfileRef` and `currentProfileUserIdRef` — good use of refs to avoid race conditions.
- ✅ **Zod + react-hook-form** used consistently across all forms for type-safe validation.
- ✅ **`useMutation` with `onSuccess`/`onError`** used correctly with `queryClient.invalidateQueries` for cache management.
- ✅ **AlertDialog for destructive actions** (ticket deletion) is a good UX practice.
- ✅ **SLA utility function** (`getSlaStatus`) is cleanly extracted and reused across components.
- ✅ **Admin edge function** correctly verifies the admin role server-side before performing privileged operations, adding a server-side authorization layer on top of RLS.
- ✅ **Signed URLs for attachments** shows awareness of secure file access patterns.
- ✅ **`ticket_number` auto-generation** via PostgreSQL trigger and sequence is a robust approach.
- ✅ **Responsive design** with Tailwind and hidden breakpoints (`md:flex`, `md:hidden`) considered in the layout.

---

*End of Audit Report*
