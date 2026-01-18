import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { showSuccess, showError } from '@/utils/toast';

const Dashboard = () => {
  const { session, loading, role } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      showError('You need to be logged in to view the dashboard.');
      navigate('/login');
    }
  }, [session, loading, navigate]);

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
            Selamat Datang , Mari bahagiakan Diri kita dan customer kita hari ini !
          </p>
          {/* Placeholder for customer service specific content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Open Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-bold text-blue-500">12</p>
                <p className="text-gray-500">Tickets awaiting your attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Resolved Today</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-bold text-green-500">8</p>
                <p className="text-gray-500">Tickets closed successfully</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Average Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-5xl font-bold text-yellow-500">3h 15m</p>
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