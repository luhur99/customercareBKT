import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface UserProfile {
  first_name: string | null;
  last_name: string | null;
}

const Dashboard = () => {
  const { session, loading: sessionLoading, role } = useSession();

  // Fetch user profile to get first_name and last_name
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<UserProfile, Error>({
    queryKey: ['userProfile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) throw new Error('User ID is missing.');
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', session.user.id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!session?.user?.id, // Only run query if session and user ID exist
  });

  if (sessionLoading || profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-700 dark:text-gray-300">Memuat dashboard...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Error</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Gagal memuat profil: {profileError.message}
        </p>
      </div>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const displayName = fullName || session?.user?.email?.split('@')[0] || 'User';
  const displayRole = role ? role.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : '';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-8">
        Welcome, {displayRole} {displayName}!
      </h1>
      <p className="text-center text-lg text-gray-700 dark:text-gray-300">
        Ini adalah dashboard pribadi Anda.
      </p>
      {/* Anda bisa menambahkan konten dashboard lainnya di sini */}
    </div>
  );
};

export default Dashboard;