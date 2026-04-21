import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";
import SimulationPage from "@/pages/SimulationPage";
import OverviewPage from "@/pages/OverviewPage";
import VulnerabilityPage from "@/pages/VulnerabilityPage";
import ScenarioPage from "@/pages/ScenarioPage";
import ShortagePage from "@/pages/ShortagePage";
import InventoryPage from "@/pages/InventoryPage";
import ColdChainPage from "@/pages/ColdChainPage";
import CompliancePage from "@/pages/CompliancePage";
import ValidationReportPage from "@/pages/ValidationReportPage";
import SupplyChainFlowPage from "@/pages/SupplyChainFlowPage";
import BlogPage from "@/pages/BlogPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<SimulationPage />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/vulnerability" element={<VulnerabilityPage />} />
            <Route path="/scenarios" element={<ScenarioPage />} />
            <Route path="/shortage" element={<ShortagePage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/cold-chain" element={<ColdChainPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/supply-chain-flow" element={<SupplyChainFlowPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/validation" element={<ValidationReportPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
