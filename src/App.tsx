import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Layout from "./components/Layout";
import ManageRoles from "./pages/ManageRoles";
import Tickets from "./pages/Tickets";
import SubmitComplaint from "./pages/SubmitComplaint";
import TicketDetail from "./pages/TicketDetail";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider>
            <Layout>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/welcome" element={<Index />} />
                <Route path="/manage-roles" element={<ManageRoles />} />
                <Route path="/tickets" element={<Tickets />} />
                <Route path="/tickets/:id" element={<TicketDetail />} />
                <Route path="/submit-complaint" element={<SubmitComplaint />} />
                <Route path="/" element={<Dashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
