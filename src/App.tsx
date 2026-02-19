import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { SessionContextProvider } from "./components/SessionContextProvider";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ManageRoles = lazy(() => import("./pages/ManageRoles"));
const Tickets = lazy(() => import("./pages/Tickets"));
const SubmitComplaint = lazy(() => import("./pages/SubmitComplaint"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SessionContextProvider>
            <Layout>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
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
              </Suspense>
            </Layout>
          </SessionContextProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
