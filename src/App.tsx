import RegisterGate from "@/modules/pos/components/RegisterGate";
import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "@/state/AppContext";
import LoginPage from "@/pages/LoginPage";
import MainLayout from "@/components/layout/MainLayout";
import POSPage from "@/modules/pos/pages/POSPage";
import NotFound from "./pages/NotFound";
// Las páginas secundarias se cargan al abrirlas: el POS y el login abren más rápido
// (sobre todo en celular), y librerías pesadas como la de Excel no van en la carga inicial.
const AuditPage = lazy(() => import("@/modules/admin/pages/AuditPage"));
const SalesHistoryPage = lazy(() => import("./modules/pos/pages/SalesHistoryPage"));
const CashMovementsPage = lazy(() => import("@/modules/pos/pages/CashMovementsPage"));
const CashClosePage = lazy(() => import("@/modules/pos/pages/CashClosePage"));
const WholesalePage = lazy(() => import("@/modules/admin/pages/WholesalePage"));
const PriceManagementPage = lazy(() => import("@/modules/admin/pages/PriceManagmentPage"));
const ProductCatalogPage = lazy(() => import("@/modules/admin/pages/ProductCatalogPage"));
const PurchaseEntryPage = lazy(() => import("@/modules/purchases/pages/PurchaseEntryPage"));
const PurchaseListPage = lazy(() => import("@/modules/purchases/pages/PurchaseListPage"));
const ReportsPage = lazy(() => import("@/modules/admin/pages/ReportsPage"));
const StockPage = lazy(() => import("@/modules/admin/pages/StockPage"));
const EmployeesPage = lazy(() => import("@/modules/admin/pages/EmployeesPage"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const DashboardPage = lazy(() => import("@/modules/admin/pages/DashboardPage"));
const OrganizationPage = lazy(() => import("@/modules/admin/pages/OrganizationPage"));
const UsersPage = lazy(() => import("@/modules/admin/pages/UsersPage"));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { auth } = useApp();
  const location = useLocation();
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
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
  const location = useLocation();
  // Tras iniciar sesión vuelve a la página que se intentaba abrir (solo rutas internas).
  const from = (location.state as { from?: string } | null)?.from;
  const redirectAfterLogin = from && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/';
  const previousUser = useRef(auth.user?.id);
  useEffect(() => { if (previousUser.current !== auth.user?.id) { queryClient.clear(); previousUser.current = auth.user?.id; } }, [auth.user?.id]);

  return (
    <Routes>
      <Route path="/login" element={
        auth.isAuthenticated ? <Navigate to={redirectAfterLogin} replace /> : <LoginPage />
      } />
      
      {/* Fuera del menú lateral para que la impresión salga limpia. */}
      <Route path="/comprobante/:id" element={
        <ProtectedRoute>
          <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Cargando…</p>}>
            <ReceiptPage />
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        {/* Administración entra al resumen; cajeros, directo a vender. */}
        <Route index element={<Navigate to={auth.user?.role === 'CASHIER' ? '/pos' : '/inicio'} replace />} />
        <Route path="pos" element={<RegisterGate><POSPage /></RegisterGate>} />

        {/* aquí usamos la página de historial de ventas */}
        <Route path="pos/ventas" element={<SalesHistoryPage mode="sales" />} />

        <Route path="pos/devoluciones" element={<SalesHistoryPage mode="returns" />} />
        <Route path="pos/movimientos" element={<RegisterGate><CashMovementsPage /></RegisterGate>} />
        <Route path="pos/cerrar" element={<RegisterGate><CashClosePage /></RegisterGate>} />
    
        <Route element={<AdminRoute />}>
        <Route path="inicio" element={<DashboardPage />} />
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
          <Route path="admin/sucursales" element={<OrganizationPage />} />
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
