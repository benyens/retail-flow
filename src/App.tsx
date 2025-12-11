import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/state/AppContext";
import LoginPage from "@/pages/LoginPage";
import MainLayout from "@/components/layout/MainLayout";
import POSPage from "@/modules/pos/pages/POSPage";
import NotFound from "./pages/NotFound";
import SalesHistoryPage from "./modules/pos/pages/SalesHistoryPage";  
import CashMovementsPage from "@/modules/pos/pages/CashMovementsPage";
import CashClosePage from "@/modules/pos/pages/CashClosePage";
import WholesalePage from "@/modules/admin/pages/WholesalePage";
import PriceManagementPage from "@/modules/admin/pages/PriceManagmentPage";
import ProductCatalogPage from "@/modules/admin/pages/ProductCatalogPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { auth } = useApp();
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { auth } = useApp();

  return (
    <Routes>
      <Route path="/login" element={
        auth.isAuthenticated ? <Navigate to="/pos" replace /> : <LoginPage />
      } />
      
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<POSPage />} />

        {/* aquí usamos la página de historial de ventas */}
        <Route path="pos/sales" element={<SalesHistoryPage mode="sales" />} />

        <Route path="pos/returns" element={<SalesHistoryPage mode="returns" />} />
        <Route path="pos/cash-movements" element={<CashMovementsPage />} />
        <Route path="pos/close" element={<CashClosePage />} />
    
        <Route path="admin/catalog" element={<ProductCatalogPage />} />
        <Route path="admin/pricing" element={<PriceManagementPage />} />
        <Route path="admin/wholesale" element={<WholesalePage />} />
        <Route path="admin/stock" element={<div className="p-8"><h1 className="text-2xl font-bold">Stock</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/purchases" element={<div className="p-8"><h1 className="text-2xl font-bold">Compras</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/employees" element={<div className="p-8"><h1 className="text-2xl font-bold">Empleados</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/reports" element={<div className="p-8"><h1 className="text-2xl font-bold">Reportes</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/audit" element={<div className="p-8"><h1 className="text-2xl font-bold">Auditoría</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/users" element={<div className="p-8"><h1 className="text-2xl font-bold">Usuarios</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
      </Route>
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
