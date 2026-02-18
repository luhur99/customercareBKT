/// <reference types="https://deno.land/x/supabase/edge-runtime.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ALLOWED_ORIGINS = [
  'https://customercarebkt.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:5173',
];

const getCorsHeaders = (origin: string) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Vary': 'Origin',
});

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || '';
  const corsHeaders = getCorsHeaders(origin);

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

      return new Response(JSON.stringify({ users: formattedUsers }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } 
    
    else if (req.method === 'POST') {
      const body = await req.json();
      
      // Check if this is a delete action
      if (body.action === 'delete') {
        const userId = body.userId;
        console.log(`[admin-users] Handling POST delete request: Deleting user ${userId}`);
        
        if (!userId) {
          console.error('[admin-users] Missing userId for delete request');
          return new Response(JSON.stringify({ error: 'Missing user id' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Prevent deleting yourself
        if (userId === user.id) {
          console.error('[admin-users] Cannot delete self');
          return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Delete from auth.users
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          console.error('[admin-users] Delete user error:', deleteError.message);
          return new Response(JSON.stringify({ error: 'Failed to delete user', details: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Also delete from profiles table (in case cascade doesn't work)
        await supabaseAdmin.from('profiles').delete().eq('id', userId);
        
        console.log('[admin-users] User deleted successfully');
        return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Otherwise, create a new user
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
      console.log(`[admin-users] Handling PUT request for ${userId}`);
      
      // If role is provided, update role (backward compatibility)
      if (userId && newRole) {
        console.log(`[admin-users] Updating role for ${userId} to ${newRole}`);
        
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
      
      // Otherwise, handle user details update (edit user)
      if (!userId) {
        console.error('[admin-users] Missing id for PUT request');
        return new Response(JSON.stringify({ error: 'Missing user id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json();
      const { first_name, last_name, email } = body;
      console.log(`[admin-users] Updating user details for ${userId}:`, { first_name, last_name, email });
      
      // Update profile table
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
          return new Response(JSON.stringify({ error: 'Failed to update profile', details: updateProfileError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Update email in auth if provided
      if (email) {
        const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: email,
        });
        
        if (updateEmailError) {
          console.error('[admin-users] Email update error:', updateEmailError.message);
          return new Response(JSON.stringify({ error: 'Failed to update email', details: updateEmailError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Also update email in profiles table
        const { error: updateProfileEmailError } = await supabaseAdmin
          .from('profiles')
          .update({ email: email })
          .eq('id', userId);
        
        if (updateProfileEmailError) {
          console.error('[admin-users] Profile email update error:', updateProfileEmailError.message);
        }
      }
      
      console.log('[admin-users] User details updated successfully');
      return new Response(JSON.stringify({ message: 'User details updated successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    else if (req.method === 'PATCH') {
      const userId = url.searchParams.get('id');
      console.log(`[admin-users] Handling PATCH request: Updating user details for ${userId}`);
      
      if (!userId) {
        console.error('[admin-users] Missing id for PATCH request');
        return new Response(JSON.stringify({ error: 'Missing user id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const body = await req.json();
      const { first_name, last_name, email } = body;
      
      // Update profile table
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
          return new Response(JSON.stringify({ error: 'Failed to update profile', details: updateProfileError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      // Update email in auth if provided
      if (email) {
        const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email: email,
        });
        
        if (updateEmailError) {
          console.error('[admin-users] Email update error:', updateEmailError.message);
          return new Response(JSON.stringify({ error: 'Failed to update email', details: updateEmailError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // Also update email in profiles table
        const { error: updateProfileEmailError } = await supabaseAdmin
          .from('profiles')
          .update({ email: email })
          .eq('id', userId);
        
        if (updateProfileEmailError) {
          console.error('[admin-users] Profile email update error:', updateProfileEmailError.message);
        }
      }
      
      console.log('[admin-users] User details updated successfully');
      return new Response(JSON.stringify({ message: 'User details updated successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    else if (req.method === 'DELETE') {
      const userId = url.searchParams.get('id');
      console.log(`[admin-users] Handling DELETE request: Deleting user ${userId}`);
      
      if (!userId) {
        console.error('[admin-users] Missing id for DELETE request');
        return new Response(JSON.stringify({ error: 'Missing user id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Prevent deleting yourself
      if (userId === user.id) {
        console.error('[admin-users] Cannot delete self');
        return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Delete from auth.users (this will cascade to profiles if foreign key is set up)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error('[admin-users] Delete user error:', deleteError.message);
        return new Response(JSON.stringify({ error: 'Failed to delete user', details: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Also delete from profiles table (in case cascade doesn't work)
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      
      console.log('[admin-users] User deleted successfully');
      return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[admin-users] Method Not Allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    console.error('[admin-users] Unhandled Exception:', message, err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});