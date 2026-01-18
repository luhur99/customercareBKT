// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    console.log(`[admin-users] Request received: ${req.method} ${url.pathname}`);

    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[admin-users] Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('[admin-users] Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify Admin Role
    // Menggunakan select single untuk efisiensi
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[admin-users] Profile fetch error:', profileError);
      return new Response(JSON.stringify({ error: 'Failed to verify role', details: profileError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile?.role !== 'admin') {
      console.error(`[admin-users] Access denied. User ${user.email} is ${profile?.role}`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Initialize Admin Client (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Handle Requests
    if (req.method === 'GET') {
      console.log('[admin-users] Fetching all users...');
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, created_at, email');

      if (usersError) {
        console.error('[admin-users] DB Error:', usersError);
        throw usersError;
      }

      const formattedUsers = usersData.map(p => ({
        id: p.id,
        email: p.email || 'N/A',
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.role,
        created_at: p.created_at,
      }));

      return new Response(JSON.stringify({ users: formattedUsers }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    else if (req.method === 'POST') {
      const body = await req.json();
      console.log('[admin-users] Creating user:', body.email);
      const { email, password, first_name, last_name, role: newRole } = body;

      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      if (createUserError) {
        console.error('[admin-users] Create User Error:', createUserError);
        return new Response(JSON.stringify({ error: createUserError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update role if needed
      if (newUser?.user?.id && newRole !== 'sales') {
        const { error: updateProfileError } = await supabaseAdmin
          .from('profiles')
          .update({ role: newRole })
          .eq('id', newUser.user.id);
        
        if (updateProfileError) {
          console.error('[admin-users] Role update warning:', updateProfileError);
        }
      }

      return new Response(JSON.stringify({ message: 'User created successfully', user: newUser?.user }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    else if (req.method === 'PUT') {
      const userId = url.searchParams.get('id');
      const newRole = url.searchParams.get('role');
      console.log(`[admin-users] Updating role for ${userId} to ${newRole}`);

      if (!userId || !newRole) {
        return new Response(JSON.stringify({ error: 'Missing id or role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) {
        console.error('[admin-users] Update error:', updateError);
        throw updateError;
      }

      return new Response(JSON.stringify({ message: 'User role updated successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[admin-users] Unhandled Exception:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});