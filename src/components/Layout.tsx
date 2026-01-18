import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading, role } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading application layout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary text-primary-foreground p-4 shadow-md">
        <nav className="container mx-auto flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold">My App</Link>
          <div className="flex items-center space-x-4">
            {session ? (
              <>
                <Link to="/" className="hover:underline">Dashboard</Link>
                {role === 'admin' && (
                  <Link to="/manage-roles" className="hover:underline">Manage Roles</Link>
                )}
                <span className="text-sm hidden md:inline">Logged in as {session.user?.email} ({role?.replace('_', ' ') || 'User'})</span>
                <Button variant="secondary" size="sm" onClick={() => supabase.auth.signOut()}>Logout</Button>
              </>
            ) : (
              <Link to="/login">
                <Button variant="secondary" size="sm">Login</Button>
              </Link>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-grow">
        {children}
      </main>
    </div>
  );
};

export default Layout;