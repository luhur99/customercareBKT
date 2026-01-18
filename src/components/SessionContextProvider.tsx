import React, { useState, useEffect, createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: string | null; // Added role to the context type
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null); // State for user role
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchUserProfile = async (userId: string) => {
      console.log('Fetching user profile for userId:', userId); // Added log
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        setRole(null);
      } else if (data) {
        console.log('User role fetched:', data.role); // Added log
        setRole(data.role);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state change event:', event, 'Session:', currentSession); // Added log
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setLoading(false);

        if (currentSession?.user) {
          fetchUserProfile(currentSession.user.id);
        } else {
          setRole(null);
        }

        if (event === 'SIGNED_IN') {
          showSuccess('Logged in successfully!');
          if (location.pathname === '/login') {
            console.log('Redirecting from /login to /'); // Added log
            navigate('/'); // Redirect to home after login
          }
        } else if (event === 'SIGNED_OUT') {
          showSuccess('Logged out successfully!');
          console.log('Redirecting to /login after sign out'); // Added log
          navigate('/login'); // Redirect to login after logout
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session); // Added log
      setSession(session);
      setUser(session?.user || null);
      setLoading(false);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setRole(null);
        if (location.pathname !== '/login') {
          console.log('No initial session, redirecting to /login'); // Added log
          navigate('/login');
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ session, user, loading, role }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};