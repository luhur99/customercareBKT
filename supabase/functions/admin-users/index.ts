// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with the user's JWT for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the user from the session to verify their role
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No active session or user found.' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Fetch the user's role from the profiles table to check if they are an admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: User is not an admin.' }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Create a Supabase client with the service role key for elevated privileges
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);

    if (req.method === 'GET') {
      // Fetch all users directly from profiles table
      // Now simpler because email is in profiles!
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          first_name,
          last_name,
          role,
          created_at,
          email
        `);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        return new Response(JSON.stringify({ error: usersError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      // No need to map joined data anymore
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
        headers: corsHeaders,
      });
    } else if (req.method === 'POST') {
      const { email, password, first_name, last_name, role: newRole } = await req.json();

      // Create user in auth.users using admin privileges
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Automatically confirm email
        user_metadata: { first_name, last_name },
      });

      if (createUserError) {
        console.error('Error creating user:', createUserError);
        return new Response(JSON.stringify({ error: createUserError.message }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // The handle_new_user trigger automatically inserts the profile.
      // We explicitly set the role here if it's not the default.
      if (newUser?.user?.id && newRole !== 'sales') {
        const { error: updateProfileError } = await supabaseAdmin
          .from('profiles')
          .update({ role: newRole })
          .eq('id', newUser.user.id);

        if (updateProfileError) {
          console.error('Error updating profile role after creation:', updateProfileError);
          // Don't fail the whole request if user creation succeeded but role update failed
          // Just log it or return a warning if needed
        }
      }

      return new Response(JSON.stringify({ message: 'User created successfully', user: newUser?.user }), {
        status: 201,
        headers: corsHeaders,
      });
    } else if (req.method === 'PUT') {
      const userId = url.searchParams.get('id');
      const newRole = url.searchParams.get('role');

      if (!userId || !newRole) {
        return new Response(JSON.stringify({ error: 'User ID and new role are required.' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Update the user's role in the profiles table using admin privileges
      const { data, error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user role:', updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      return new Response(JSON.stringify({ message: 'User role updated successfully' }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});