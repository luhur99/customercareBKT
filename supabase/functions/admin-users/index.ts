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
    console.log(`[admin-users] SUPABASE_URL: ${Deno.env.get('SUPABASE_URL')?.substring(0, 20)}...`); // Log partial URL for debugging
    console.log(`[admin-users] SUPABASE_ANON_KEY: ${Deno.env.get('SUPABASE_ANON_KEY')?.substring(0, 10)}...`); // Log partial key

    // 1. Authenticate User
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[admin-users] Missing Authorization header');
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[admin-users] Initializing Supabase client with user auth...');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    console.log('[admin-users] Auth getUser result:', { user: user?.id, email: user?.email, userError });

    if (userError || !user) {
      console.error('[admin-users] Auth error:', userError?.message || 'User not found');
      return new Response(JSON.stringify({ error: 'Unauthorized', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verify Admin Role
    console.log(`[admin-users] Fetching profile for user ID: ${user.id}`);
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('[admin-users] Profile fetch result:', { profile, profileError });

    if (profileError) {
      console.error('[admin-users] Profile fetch error:', profileError.message);
      return new Response(JSON.stringify({ error: 'Failed to verify role', details: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (profile?.role !== 'admin') {
      console.error(`[admin-users] Access denied. User ${user.email} has role: ${profile?.role}`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Initialize Admin Client (Service Role)
    console.log('[admin-users] Initializing Supabase admin client...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Handle Requests
    if (req.method === 'GET') {
      console.log('[admin-users] Handling GET request: Fetching all users...');
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, role, updated_at, email'); // Changed created_at to updated_at

      console.log('[admin-users] GET users data result:', { count: usersData?.length, usersError });

      if (usersError) {
        console.error('[admin-users] DB GET Error:', usersError.message);
        throw usersError;
      }

      const formattedUsers = usersData.map(p => ({
        id: p.id,
        email: p.email || 'N/A',
        first_name: p.first_name,
        last_name: p.last_name,
        role: p.role,
        created_at: p.updated_at, // Mapped to updated_at for display
      }));

      return new Response(JSON.stringify({ users: formattedUsers }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    else if (req.method === 'POST') {
      const body = await req.json();
      console.log('[admin-users] Handling POST request: Creating user:', body.email);
      const { email, password, first_name, last_name, role: newRole } = body;

      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name },
      });

      console.log('[admin-users] Create User result:', { newUser: newUser?.user?.id, createUserError });

      if (createUserError) {
        console.error('[admin-users] Create User Error:', createUserError.message);
        return new Response(JSON.stringify({ error: createUserError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update role if needed
      if (newUser?.user?.id && newRole !== 'sales') {
        console.log(`[admin-users] Updating role for new user ${newUser.user.id} to ${newRole}`);
        const { error: updateProfileError } = await supabaseAdmin
          .from('profiles')
          .update({ role: newRole })
          .eq('id', newUser.user.id);
        
        if (updateProfileError) {
          console.error('[admin-users] Role update warning:', updateProfileError.message);
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
      console.log(`[admin-users] Handling PUT request: Updating role for ${userId} to ${newRole}`);

      if (!userId || !newRole) {
        console.error('[admin-users] Missing id or role for PUT request');
        return new Response(JSON.stringify({ error: 'Missing id or role' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      console.log('[admin-users] Update role result:', { updateError });

      if (updateError) {
        console.error('[admin-users] Update error:', updateError.message);
        throw updateError;
      }

      return new Response(JSON.stringify({ message: 'User role updated successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[admin-users] Method Not Allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[admin-users] Unhandled Exception:', error.message || 'Internal Server Error', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});