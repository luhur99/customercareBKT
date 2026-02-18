import { ReactNode } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/components/SessionContextProvider";

interface LayoutProps {
  children?: ReactNode;
}

interface UserProfileHeader {
  first_name: string | null;
  last_name: string | null;
}

const Layout = ({ children }: LayoutProps) => {
  // Consume session from context — no duplicate auth state management here
  const { session, role } = useSession();
  const navigate = useNavigate();

  // Fetch user profile name for the header display
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
        if (error.code === 'PGRST116') {
          return { first_name: null, last_name: null };
        }
        console.error('Error fetching profile for header:', error);
        throw new Error(error.message);
      }
      return data || { first_name: null, last_name: null };
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000,
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
              {session && role === 'admin' && (
                <Link to="/manage-roles" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Manage Roles</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <div className="text-sm hidden md:flex items-center gap-2">
                  <span className="text-gray-600">
                    Hello, <span className="font-medium text-gray-900">{displayUserName}</span>
                  </span>
                  {role && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      role === 'admin'
                        ? 'bg-red-100 text-red-800 border border-red-200'
                        : role === 'customer_service'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {role.replaceAll('_', ' ')}
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
