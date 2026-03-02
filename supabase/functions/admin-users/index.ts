/// <reference types="https://deno.land/x/supabase/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://customercarebkt.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:4174',
];

const VALID_ROLES = ['admin', 'customer_service', 'sales'] as const;
type ValidRole = typeof VALID_ROLES[number];

function isValidRole(role: string): role is ValidRole {
  return VALID_ROLES.includes(role as ValidRole);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const getCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Vary': 'Origin',
});

function jsonResponse(body: object, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Update user profile (name) and optionally email in both auth and profiles table.
 */
async function updateUserDetails(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  body: { first_name?: string; last_name?: string; email?: string },
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { first_name, last_name, email } = body;

  // Update profile table (name fields)
  const updateData: Record<string, string> = {};
  if (first_name !== undefined) updateData.first_name = first_name;
  if (last_name !== undefined) updateData.last_name = last_name;

  if (Object.keys(updateData).length > 0) {
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateProfileError) {
      console.error('[admin-users] Profile update error:', updateProfileError.message);
      return jsonResponse({ error: 'Failed to update profile', details: updateProfileError.message }, 500, corsHeaders);
    }
  }

  // Update email in auth + profiles if provided
  if (email) {
    if (!isValidEmail(email)) {
      return jsonResponse({ error: 'Invalid email format' }, 400, corsHeaders);
    }

    const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email });
    if (updateEmailError) {
      console.error('[admin-users] Email update error:', updateEmailError.message);
      return jsonResponse({ error: 'Failed to update email', details: updateEmailError.message }, 500, corsHeaders);
    }

    // Sync email to profiles table
    const { error: updateProfileEmailError } = await supabaseAdmin
      .from('profiles')
      .update({ email })
      .eq('id', userId);

    if (updateProfileEmailError) {
      console.error('[admin-users] Profile email sync error:', updateProfileEmailError.message);
    }
  }

  return jsonResponse({ message: 'User details updated successfully' }, 200, corsHeaders);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);

    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401, corsHeaders);
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized', details: userError?.message }, 401, corsHeaders);
    }

    // 2. Verify Admin Role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[admin-users] Profile fetch error:', profileError.message);
      return jsonResponse({ error: 'Failed to verify role', details: profileError.message }, 500, corsHeaders);
    }

    if (profile?.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden: Admin access required' }, 403, corsHeaders);
    }

    // 3. Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ──────────── GET: List all users ────────────
    if (req.method === 'GET') {
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, updated_at, email');

      if (usersError) {
        console.error('[admin-users] DB GET Error:', usersError.message);
        throw usersError;
      }

      // Fetch true created_at from auth.users and merge
      const { data: { users: authUsers }, error: authUsersError } = await supabaseAdmin.auth.admin.listUsers();
      const authCreatedAtMap: Record<string, string> = {};
      if (!authUsersError && authUsers) {
        for (const u of authUsers) {
          authCreatedAtMap[u.id] = u.created_at;
        }
      }

      const formattedUsers = usersData.map((p: { id: string; email?: string; first_name?: string; last_name?: string; role: string; updated_at?: string }) => ({
        id: p.id,
        email: p.email || 'N/A',
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.role,
        created_at: authCreatedAtMap[p.id] || p.updated_at || null,
      }));

      return jsonResponse({ users: formattedUsers }, 200, corsHeaders);
    } 
    
    // ──────────── POST: Create user OR delete (legacy) ────────────
    else if (req.method === 'POST') {
      const body = await req.json();
      
      // Legacy delete action via POST
      if (body.action === 'delete') {
        const userId = body.userId;
        
        if (!userId) {
          return jsonResponse({ error: 'Missing user id' }, 400, corsHeaders);
        }
        
        if (userId === user.id) {
          return jsonResponse({ error: 'Cannot delete your own account' }, 400, corsHeaders);
        }
        
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          console.error('[admin-users] Delete user error:', deleteError.message);
          return jsonResponse({ error: 'Failed to delete user', details: deleteError.message }, 500, corsHeaders);
        }
        
        await supabaseAdmin.from('profiles').delete().eq('id', userId);
        
        return jsonResponse({ message: 'User deleted successfully' }, 200, corsHeaders);
      }
      
      // Create new user — validate inputs
      const { email, password, first_name, last_name, role: newRole } = body;

      if (!email || !isValidEmail(email)) {
        return jsonResponse({ error: 'Valid email is required' }, 400, corsHeaders);
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return jsonResponse({ error: 'Password must be at least 6 characters' }, 400, corsHeaders);
      }

      if (password.length > 72) {
        return jsonResponse({ error: 'Password must be at most 72 characters' }, 400, corsHeaders);
      }

      if (newRole && !isValidRole(newRole)) {
        return jsonResponse({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400, corsHeaders);
      }

      if (first_name && (typeof first_name !== 'string' || first_name.length > 100)) {
        return jsonResponse({ error: 'First name must be a string of max 100 characters' }, 400, corsHeaders);
      }

      if (last_name && (typeof last_name !== 'string' || last_name.length > 100)) {
        return jsonResponse({ error: 'Last name must be a string of max 100 characters' }, 400, corsHeaders);
      }

      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      if (createUserError) {
        console.error('[admin-users] Create User Error:', createUserError.message);
        return jsonResponse({ error: createUserError.message }, 400, corsHeaders);
      }

      // Update role if not default (sales)
      const roleToSet = newRole || 'sales';
      if (newUser?.user?.id && roleToSet !== 'sales') {
        const { error: updateProfileError } = await supabaseAdmin
          .from('profiles')
          .update({ role: roleToSet })
          .eq('id', newUser.user.id);
        
        if (updateProfileError) {
          console.error('[admin-users] Role update warning:', updateProfileError.message);
        }
      }

      return jsonResponse({ message: 'User created successfully', user: newUser?.user }, 201, corsHeaders);
    }
    
    // ──────────── PUT: Update role OR user details ────────────
    else if (req.method === 'PUT') {
      const userId = url.searchParams.get('id');
      const newRole = url.searchParams.get('role');
      
      if (!userId) {
        return jsonResponse({ error: 'Missing user id' }, 400, corsHeaders);
      }

      // Role update via query param (PUT ?id=xxx&role=yyy)
      if (newRole) {
        if (!isValidRole(newRole)) {
          return jsonResponse({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, 400, corsHeaders);
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);

        if (updateError) {
          console.error('[admin-users] Update role error:', updateError.message);
          throw updateError;
        }

        return jsonResponse({ message: 'User role updated successfully' }, 200, corsHeaders);
      }
      
      // User details update via body
      const body = await req.json();
      return updateUserDetails(supabaseAdmin, userId, body, corsHeaders);
    }
    
    // ──────────── DELETE: Remove user ────────────
    else if (req.method === 'DELETE') {
      const userId = url.searchParams.get('id');
      
      if (!userId) {
        return jsonResponse({ error: 'Missing user id' }, 400, corsHeaders);
      }
      
      if (userId === user.id) {
        return jsonResponse({ error: 'Cannot delete your own account' }, 400, corsHeaders);
      }
      
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error('[admin-users] Delete user error:', deleteError.message);
        return jsonResponse({ error: 'Failed to delete user', details: deleteError.message }, 500, corsHeaders);
      }
      
      // Cascade cleanup
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      
      return jsonResponse({ message: 'User deleted successfully' }, 200, corsHeaders);
    }

    return jsonResponse({ error: 'Method Not Allowed' }, 405, corsHeaders);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[admin-users] Unhandled Exception:', message);
    return jsonResponse({ error: message }, 500, corsHeaders);
  }
});
