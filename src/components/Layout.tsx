import { useEffect, useState, ReactNode } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query"; // Import useQuery

interface LayoutProps {
  children?: ReactNode;
}

interface UserProfileHeader {
  first_name: string | null;
  last_name: string | null;
}

const Layout = ({ children }: LayoutProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchRole(session.user.id);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      // Handle "No rows found" (PGRST116) gracefully
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching role:', error);
        return;
      }
      
      if (data) {
        setRole(data.role);
      } else {
        setRole(null); // Set role to null if no profile found
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Fetch user profile for first_name and last_name in the header
  const { data: profileHeader } = useQuery<UserProfileHeader, Error>({
    queryKey: ['userProfileHeader', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return { first_name: null, last_name: null };
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();

      if (error) {
        // Handle "No rows found" (PGRST116) gracefully
        if (error.code === 'PGRST116') {
          return { first_name: null, last_name: null };
        }
        console.error('Error fetching profile for header:', error);
        throw new Error(error.message);
      }
      return data || { first_name: null, last_name: null };
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // Cache data for 5 minutes
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const fullNameHeader = [profileHeader?.first_name, profileHeader?.last_name].filter(Boolean).join(' ');
  const displayUserName = fullNameHeader || session?.user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
              <span className="bg-primary text-white p-1 rounded">TS</span>
              TicketingSystem
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Dashboard</Link>
              {session && (role === 'admin' || role === 'customer_service') && (
                <Link to="/tickets" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Tickets</Link>
              )}
              {session && (role === 'sales' || role === 'admin' || role === 'customer_service') && (
                <Link to="/submit-complaint" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Ajukan Keluhan</Link>
              )}
              {session && role === 'admin' && ( // NEW: Manage Roles link for admin
                <Link to="/manage-roles" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Manage Roles</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <div className="text-sm hidden md:flex items-center gap-2">
                  <span className="text-gray-600">
                    Hello, <span className="font-medium text-gray-900">{displayUserName}</span> {/* Use displayUserName here */}
                  </span>
                  {role && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      role === 'admin'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : role === 'customer_service'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {role.replace('_', ' ')}
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
              </>
            ) : (
              <Link to="/login">
                <Button size="sm">Login</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        {children || <Outlet context={{ session, role }} />}
      </main>
      
      <footer className="bg-white border-t py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Ticketing System. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Layout;