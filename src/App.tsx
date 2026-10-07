import { useEffect, useRef } from "react";
import AuditPage from "@/modules/admin/pages/AuditPage";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
import PurchaseEntryPage from "@/modules/purchases/pages/PurchaseEntryPage";
import PurchaseListPage from "@/modules/purchases/pages/PurchaseListPage";
import ReportsPage from "@/modules/admin/pages/ReportsPage";
import StockPage from "@/modules/admin/pages/StockPage";
import EmployeesPage from "@/modules/admin/pages/EmployeesPage";
import UsersPage from "@/modules/admin/pages/UsersPage";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { auth } = useApp();
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ onlyAdmin = false }: { onlyAdmin?: boolean }) {
  const { auth } = useApp();
  const allowed = onlyAdmin ? auth.user?.role === 'ADMIN' : ['ADMIN', 'MANAGER'].includes(auth.user?.role ?? '');
  return allowed ? <Outlet /> : <div className="p-8" role="alert"><h1 className="text-xl font-bold">Acceso restringido</h1><p>No tienes permisos para esta sección.</p></div>;
}

function AppRoutes() {
  const { auth } = useApp();
  const previousUser = useRef(auth.user?.id);
  useEffect(() => { if (previousUser.current !== auth.user?.id) { queryClient.clear(); previousUser.current = auth.user?.id; } }, [auth.user?.id]);

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
        <Route path="pos/ventas" element={<SalesHistoryPage mode="sales" />} />

        <Route path="pos/devoluciones" element={<SalesHistoryPage mode="returns" />} />
        <Route path="pos/movimientos" element={<CashMovementsPage />} />
        <Route path="pos/cerrar" element={<CashClosePage />} />
    
        <Route element={<AdminRoute />}>
        <Route path="admin/catalogo" element={<ProductCatalogPage />} />
        <Route path="admin/precios" element={<PriceManagementPage />} />
        <Route path="admin/mayorista" element={<WholesalePage />} />
        <Route path="admin/ingresar-factura" element={<PurchaseEntryPage />} />
        <Route path="admin/stock" element={<StockPage />} />
        <Route path="admin/facturas" element={<PurchaseListPage />} />
        <Route path="admin/purchases" element={<Navigate to="/admin/facturas" replace />} />
        <Route path="admin/employees" element={<EmployeesPage />} />
        <Route path="admin/reports" element={<ReportsPage />} />
        </Route>
        <Route element={<AdminRoute onlyAdmin />}>
          <Route path="admin/audit" element={<AuditPage />} />
          <Route path="admin/users" element={<UsersPage />} />
        </Route>
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
