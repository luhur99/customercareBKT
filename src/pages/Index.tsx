import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";

const Index = () => {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      navigate(session ? "/" : "/login", { replace: true });
    }
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <p className="text-gray-700 dark:text-gray-300">Memuat...</p>
    </div>
  );
};

export default Index;