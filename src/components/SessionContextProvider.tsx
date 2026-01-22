import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
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

  // useRef untuk melacak apakah sedang mengambil profil untuk mencegah pengambilan ganda
  const isFetchingProfileRef = useRef(false);
  // useRef untuk melacak ID pengguna yang terakhir kali profilnya diambil
  const currentProfileUserIdRef = useRef<string | null>(null);
  // useRef untuk melacak apakah komponen sudah di-mount
  const isMounted = useRef(true);

  // Fungsi untuk mengambil peran pengguna, di-memoize dengan useCallback
  const fetchUserProfile = useCallback(async (userId: string) => {
    // Jika sudah ada permintaan pengambilan profil untuk user ini, atau user ID sama, abaikan
    if (isFetchingProfileRef.current || currentProfileUserIdRef.current === userId) {
      return;
    }

    isFetchingProfileRef.current = true;
    currentProfileUserIdRef.current = userId; // Set user ID yang sedang diambil

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      // Pastikan komponen masih di-mount sebelum memperbarui state
      if (isMounted.current) {
        if (error && error.code !== 'PGRST116') { // PGRST116 = "No rows found"
          console.error('Error fetching user profile:', error);
          setRole(null);
        } else if (data) {
          setRole(data.role);
        } else {
          setRole(null); // Set role ke null jika tidak ada profil ditemukan
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
  }, []); // Dependensi kosong karena isMounted dan isFetchingProfileRef adalah ref

  useEffect(() => {
    // Cleanup function untuk menandai komponen tidak lagi di-mount
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let authSubscription: any = null; // Variabel untuk menyimpan langganan auth

    const setupAuthListener = async () => {
      // Ambil sesi awal
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (isMounted.current) {
        setSession(initialSession);
        setUser(initialSession?.user || null);

        if (initialSession?.user) {
          await fetchUserProfile(initialSession.user.id);
        } else {
          setRole(null);
          // Redirect ke login jika tidak ada sesi dan bukan di halaman login
          if (location.pathname !== '/login') {
            navigate('/login');
          }
        }
        setLoading(false); // Set loading false setelah sesi awal dan peran ditentukan
      }

      // Siapkan listener perubahan status auth
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted.current) return; // Jangan perbarui state jika komponen sudah di-unmount

          setSession(currentSession);
          setUser(currentSession?.user || null);

          if (currentSession?.user) {
            // Reset ref untuk memungkinkan pengambilan profil baru jika user berubah
            if (currentProfileUserIdRef.current !== currentSession.user.id) {
              currentProfileUserIdRef.current = null;
            }
            await fetchUserProfile(currentSession.user.id);
          } else {
            setRole(null);
          }

          if (event === 'SIGNED_IN') {
            showSuccess('Logged in successfully!');
            if (location.pathname === '/login') {
              navigate('/'); // Redirect ke home setelah login
            }
          } else if (event === 'SIGNED_OUT') {
            showSuccess('Logged out successfully!');
            navigate('/login'); // Redirect ke login setelah logout
          }
        }
      );
      authSubscription = subscription;
    };

    setupAuthListener();

    // Cleanup function untuk meng-unsubscribe listener
    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [navigate, location.pathname, fetchUserProfile]); // fetchUserProfile sebagai dependensi karena useCallback

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