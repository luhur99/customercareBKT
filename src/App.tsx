import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index"; // Renamed to Welcome for now
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard"; // Import the new Dashboard page
import { SessionContextProvider } from "./components/SessionContextProvider";
import Layout from "./components/Layout"; // Import the new Layout component
import ManageRoles from "./pages/ManageRoles"; // Import ManageRoles
import Tickets from "./pages/Tickets"; // Import the new Tickets page
import SubmitComplaint from "./pages/SubmitComplaint"; // Import the new SubmitComplaint page
import TicketDetail from "./pages/TicketDetail"; // Import the new TicketDetail page

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Layout> {/* Wrap all routes with the Layout component */}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/welcome" element={<Index />} /> {/* Index page moved to /welcome */}
              <Route path="/manage-roles" element={<ManageRoles />} /> {/* Manage Roles page */}
              <Route path="/tickets" element={<Tickets />} /> {/* New Tickets page */}
              <Route path="/tickets/:id" element={<TicketDetail />} /> {/* New TicketDetail page */}
              <Route path="/submit-complaint" element={<SubmitComplaint />} /> {/* New SubmitComplaint page */}
              <Route path="/" element={<Dashboard />} /> {/* Set Dashboard as the default route */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;