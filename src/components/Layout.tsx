import { useEffect, useState, ReactNode } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Session } from "@supabase/supabase-js";

interface LayoutProps {
  children?: ReactNode;
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
      
      if (error) {
        console.error('Error fetching role:', error);
        return;
      }
      
      if (data) {
        setRole(data.role);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

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
              <Link to="/tickets" className="text-sm font-medium text-gray-700 hover:text-primary transition-colors">Tickets</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <div className="text-sm hidden md:flex items-center gap-2">
                  <span className="text-gray-600">
                    Hello, <span className="font-medium text-gray-900">{session.user?.email?.split('@')[0]}</span>
                  </span>
                  {role && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      role === 'admin' 
                        ? 'bg-red-100 text-red-800 border border-red-200' 
                        : role === 'customer_service'
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-800 border border-gray-200'
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