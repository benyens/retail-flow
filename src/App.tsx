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
        <Route path="pos/sales" element={<div className="p-8"><h1 className="text-2xl font-bold">Ventas del Día</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="pos/returns" element={<div className="p-8"><h1 className="text-2xl font-bold">Devoluciones</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="pos/cash-movements" element={<div className="p-8"><h1 className="text-2xl font-bold">Movimientos de Caja</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="pos/close" element={<div className="p-8"><h1 className="text-2xl font-bold">Cierre de Caja</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        
        <Route path="admin/catalog" element={<div className="p-8"><h1 className="text-2xl font-bold">Catálogo</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
        <Route path="admin/wholesale" element={<div className="p-8"><h1 className="text-2xl font-bold">Mayorista</h1><p className="text-muted-foreground">Próximamente...</p></div>} />
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
