import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showSuccess, showError } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize fetchUserProfile to prevent unnecessary re-creations
  const fetchUserProfile = useCallback(async (userId: string) => {
    console.log('Fetching user profile for userId:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      setRole(null);
    } else if (data) {
      console.log('User role fetched:', data.role);
      setRole(data.role);
    }
  }, [setRole]); // setRole is a stable setter function, supabase is an imported constant.

  useEffect(() => {
    // Handler for auth state changes
    const handleAuthStateChange = async (event: string, currentSession: Session | null) => {
      console.log('Auth state change event:', event, 'Session:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);

      if (currentSession?.user) {
        await fetchUserProfile(currentSession.user.id);
      } else {
        setRole(null);
      }

      if (event === 'SIGNED_IN') {
        showSuccess('Logged in successfully!');
        if (location.pathname === '/login') {
          console.log('Redirecting from /login to /');
          navigate('/');
        }
      } else if (event === 'SIGNED_OUT') {
        showSuccess('Logged out successfully!');
        console.log('Redirecting to /login after sign out');
        navigate('/login');
      }
    };

    // Subscribe to auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('Initial session check:', initialSession);
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);
      if (initialSession?.user) {
        await fetchUserProfile(initialSession.user.id);
      } else {
        setRole(null);
        if (location.pathname !== '/login') {
          console.log('No initial session, redirecting to /login');
          navigate('/login');
        }
      }
    });

    // Cleanup function to unsubscribe from auth changes
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserProfile, navigate, location.pathname]); // Dependencies for useEffect

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