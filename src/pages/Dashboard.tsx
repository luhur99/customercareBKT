import React from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-elmony';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const { session, loading, role } = useSession();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <p className="text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!session) {
    // This case should ideally be handled by SessionContextProvider redirecting to login,
    // but as a fallback, we can show a message.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">Please log in to view the dashboard.</p>
        <Button onClick={() => supabase.auth.signOut()}>Go to Login</Button>
      </div>
    );
  }

  const renderRoleSpecificContent = () => {
    switch (role) {
      case 'admin':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-blue-600 dark:text-blue-400 mb-4">Admin Dashboard</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Welcome, Administrator! You have full access to all features.
            </p>
            <p className="text-md text-gray-500 dark:text-gray-400 mt-2">
              Use the "Manage Roles" link in the header to manage users.
            </p>
          </div>
        );
      case 'customer_service':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-green-600 dark:text-green-400 mb-4">Customer Service Portal</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Hello, Customer Service! Here you can view and manage customer inquiries.
            </p>
          </div>
        );
      case 'sales':
        return (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-purple-600 dark:text-purple-400 mb-4">Sales Overview</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Greetings, Sales Team! Your sales performance and leads are displayed here.
            </p>
          </div>
        );
      default:
        return (
          <div className="text-center">
            <h2 className="text-3xl font-semibold text-yellow-600 dark:text-yellow-400 mb-4">User Dashboard</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Welcome to your personalized dashboard!
            </p>
            <p className="text-md text-gray-500 dark:text-gray-400 mt-2">
              Your role: <span className="font-semibold capitalize">{role ? role.replace('_', ' ') : 'Not assigned'}</span>
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Your Application Dashboard
        </h1>
        {renderRoleSpecificContent()}
        <Button onClick={() => supabase.auth.signOut()} className="mt-8">Logout</Button>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;