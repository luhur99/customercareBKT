import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query'; // Import useQuery
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react'; // Import Loader2 icon

const Dashboard = () => {
  const { session, loading, role } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      showError('You need to be logged in to view the dashboard.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

  // Fetch count of open tickets for customer_service
  const { data: openTicketsCount, isLoading: isLoadingOpenTickets } = useQuery<number, Error>({
    queryKey: ['openTicketsCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('status', 'open');

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && role === 'customer_service', // Only fetch if logged in and is customer_service
  });

  // Fetch count of tickets resolved today for customer_service
  const { data: resolvedTodayCount, isLoading: isLoadingResolvedToday } = useQuery<number, Error>({
    queryKey: ['resolvedTodayCount'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1); // Start of tomorrow

      const { count, error } = await supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .eq('status', 'closed')
        .gte('created_at', today.toISOString()) // Assuming 'created_at' is updated on status change or we need a 'resolved_at' column
        .lt('created_at', tomorrow.toISOString()); // This might need adjustment if 'resolved_at' column is added

      if (error) throw new Error(error.message);
      return count || 0;
    },
    enabled: !!session && role === 'customer_service', // Only fetch if logged in and is customer_service
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!session) {
    return null; // Should redirect by useEffect
  }

  const userEmail = session.user?.email;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-extrabold text-center text-gray-900 dark:text-white mb-8">
        Welcome, {userEmail}!
      </h1>

      {role === 'admin' && (
        <div className="text-center mb-8">
          <h2 className="text-3xl font-semibold text-blue-600 dark:text-blue-400 mb-4">Admin Dashboard</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            As an administrator, you have full control over user roles and system settings.
          </p>
          <Button onClick={() => navigate('/manage-roles')} className="mt-4">
            Manage User Roles
          </Button>
        </div>
      )}

      {role === 'customer_service' && (
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-purple-600 dark:text-purple-400 mb-4">Customer Service Overview</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300">
            Selamat Datang, Mari bahagiakan Diri kita dan customer kita hari ini!
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Open Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingOpenTickets ? (
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                ) : (
                  <p className="text-5xl font-bold text-blue-500">{openTicketsCount}</p>
                )}
                <p className="text-gray-500">Tickets awaiting your attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resolved Today</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingResolvedToday ? (
                  <Loader2 className="h-8 w-8 animate-spin text-green-500 mx-auto" />
                ) : (
                  <p className="text-5xl font-bold text-green-500">{resolvedTodayCount}</p>
                )}
                <p className="text-gray-500">Tickets closed successfully</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                {/* This metric is more complex and requires additional data/logic */}
                <p className="text-5xl font-bold text-yellow-500">N/A</p>
                <p className="text-gray-500">Keep up the great work!</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;