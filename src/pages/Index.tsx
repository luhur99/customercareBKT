import { MadeWithDyad } from "@/components/made-with-elmony";
import { useSession } from "@/components/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { session, loading, role } = useSession(); // Get role from useSession

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Welcome to Your Blank App
        </h1>
        {session ? (
          <>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
              You are logged in as {session.user?.email}!
            </p>
            {role && (
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
                Your role: <span className="font-semibold capitalize">{role.replace('_', ' ')}</span>
              </p>
            )}
            <Button onClick={() => supabase.auth.signOut()}>Logout</Button>
          </>
        ) : (
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Please log in to continue.
          </p>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;