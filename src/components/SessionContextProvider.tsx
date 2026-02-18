import { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { showSuccess } from '@/utils/toast';

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

  // Refs to prevent duplicate fetches and track mount state
  const isFetchingProfileRef = useRef(false);
  const currentProfileUserIdRef = useRef<string | null>(null);
  const isMounted = useRef(true);

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (isFetchingProfileRef.current || currentProfileUserIdRef.current === userId) {
      return;
    }

    isFetchingProfileRef.current = true;
    currentProfileUserIdRef.current = userId;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (isMounted.current) {
        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching user profile:', error);
          setRole(null);
        } else if (data) {
          setRole(data.role);
        } else {
          setRole(null);
        }
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      if (isMounted.current) {
        setRole(null);
      }
    } finally {
      if (isMounted.current) {
        isFetchingProfileRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auth listener — set up ONCE, never re-runs on navigation
  useEffect(() => {
    let authSubscription: { unsubscribe: () => void } | null = null;

    const setupAuthListener = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();

      if (isMounted.current) {
        setSession(initialSession);
        setUser(initialSession?.user || null);

        if (initialSession?.user) {
          await fetchUserProfile(initialSession.user.id);
        } else {
          setRole(null);
        }
        setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted.current) return;

          setSession(currentSession);
          setUser(currentSession?.user || null);

          if (currentSession?.user) {
            if (currentProfileUserIdRef.current !== currentSession.user.id) {
              currentProfileUserIdRef.current = null;
            }
            await fetchUserProfile(currentSession.user.id);
          } else {
            setRole(null);
          }

          if (event === 'SIGNED_IN') {
            showSuccess('Logged in successfully!');
          } else if (event === 'SIGNED_OUT') {
            showSuccess('Logged out successfully!');
            navigate('/login');
          }
        }
      );
      authSubscription = subscription;
    };

    setupAuthListener();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps — auth listener is set up once only

  // Redirect logic — separate effect that reacts to session/loading/pathname changes
  useEffect(() => {
    if (!loading && !session && location.pathname !== '/login') {
      navigate('/login');
    }
  }, [loading, session, location.pathname, navigate]);

  // Redirect to home after login if on login page
  useEffect(() => {
    if (!loading && session && location.pathname === '/login') {
      navigate('/');
    }
  }, [loading, session, location.pathname, navigate]);

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
