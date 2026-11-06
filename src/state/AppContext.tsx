import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { needsRefresh } from '@/utils/session';
import type { User, AuthState, Branch, CashRegister, CashSession } from '@/types';
import { apiClient } from '@/api';

interface AppContextType {
  // Auth
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // Location
  branches: Branch[];
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  cashRegisters: CashRegister[];
  selectedCashRegister: CashRegister | null;
  setSelectedCashRegister: (register: CashRegister | null) => void;
  
  // Cash Session
  currentSession: CashSession | null;
  setCurrentSession: (session: CashSession | null) => void;
  refreshSession: () => Promise<void>;
  
  // Loading
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

// Preferencias por navegador (sucursal y caja usadas por última vez). Solo IDs, sin
// datos sensibles; si el almacenamiento falla (modo privado), simplemente no se recuerda.
const BRANCH_PREF = 'pos_branch_id';
const REGISTER_PREF = 'pos_register_id';
function readPref(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ }
}

/**
 * Decodifica (sin verificar firma) el payload de un JWT para rehidratar la
 * UI al recargar la página. La verificación real sigue pasando por el
 * backend en cada request -- esto es puramente para no mostrar al usuario
 * como "deslogueado" cuando el token en localStorage sigue siendo válido.
 * Si el token no es un JWT real (ej. viene de MockApiClient) o está
 * vencido, devuelve null y AppProvider simplemente no rehidrata.
 */
function decodeJwtPayload(token: string): { sub: string; email: string; name: string; rut: string; role: string; branchIds: string[]; exp: number } | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function readStoredAuth(): AuthState {
  const empty: AuthState = { user: null, token: null, isAuthenticated: false };
  let token: string | null = null;
  try { token = localStorage.getItem('auth_token'); } catch { return empty; }
  if (!token) return empty;
  const payload = decodeJwtPayload(token);
  if (!payload) {
    try { localStorage.removeItem('auth_token'); } catch { /* sin almacenamiento */ }
    return empty;
  }
  return {
    token,
    isAuthenticated: true,
    user: {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      rut: payload.rut,
      role: payload.role as User['role'],
      branchIds: payload.branchIds,
      isActive: true,
    },
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  // La sesión se lee antes del primer render: si se hiciera en un efecto, al recargar
  // la app se vería un instante sin sesión, iría a /login y perdería la página actual.
  const [auth, setAuth] = useState<AuthState>(readStoredAuth);
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState<CashRegister | null>(null);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  // Load branches on auth; restaura la última sucursal usada en este navegador
  // (si el usuario aún tiene acceso), para que recargar no pida elegirla de nuevo.
  useEffect(() => {
    if (auth.isAuthenticated) {
      apiClient.getBranches().then((list) => {
        setBranches(list);
        const saved = readPref(BRANCH_PREF);
        const restored = list.find((b) => b.id === saved);
        if (restored) setSelectedBranch((current) => current ?? restored);
      });
    }
  }, [auth.isAuthenticated]);

  // Load cash registers when branch changes. Al cajero se le restaura la última caja;
  // admin y encargado entran sin caja y la eligen solo si van a vender.
  const restoreRegister = auth.user?.role === 'CASHIER';
  useEffect(() => {
    if (selectedBranch) {
      writePref(BRANCH_PREF, selectedBranch.id);
      setSelectedCashRegister(null);
      setCurrentSession(null);
      apiClient.getCashRegisters(selectedBranch.id).then((list) => {
        setCashRegisters(list);
        if (!restoreRegister) return;
        const restored = list.find((r) => r.id === readPref(REGISTER_PREF));
        if (restored) setSelectedCashRegister(restored);
      });
    }
  }, [selectedBranch, restoreRegister]);

  useEffect(() => {
    if (selectedCashRegister) writePref(REGISTER_PREF, selectedCashRegister.id);
  }, [selectedCashRegister]);

  // Check for existing session when register changes
  useEffect(() => {
    if (selectedCashRegister) {
      apiClient.getCurrentSession(selectedCashRegister.id).then(setCurrentSession);
    } else {
      setCurrentSession(null);
    }
  }, [selectedCashRegister]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.login({ email, password });
      setAuth({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
      });
      localStorage.setItem('auth_token', response.token);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSession = useCallback(() => {
    setAuth({ user: null, token: null, isAuthenticated: false });
    setSelectedBranch(null);
    setSelectedCashRegister(null);
    setCurrentSession(null);
    localStorage.removeItem('auth_token');
  }, []);

  // Cerrar sesión también revoca el token en el servidor; si la red falla, igual
  // se limpia localmente.
  const logout = useCallback(() => {
    apiClient.logout().catch(() => undefined).finally(clearSession);
  }, [clearSession]);

  // Renovación del token: el cliente HTTP la hace al usar la API; esto cubre la pestaña
  // abierta sin uso (al volver a ella y cada 15 min) y actualiza rol/sucursales.
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const check = () => {
      const token = localStorage.getItem('auth_token');
      if (!token || !needsRefresh(token) || document.visibilityState === 'hidden') return;
      apiClient.refreshToken().then((res) => {
        if (localStorage.getItem('auth_token') !== token) return;
        localStorage.setItem('auth_token', res.token);
        setAuth({ user: res.user, token: res.token, isAuthenticated: true });
      }).catch(() => undefined);
    };
    const onRefreshed = (e: Event) => {
      const res = (e as CustomEvent<{ token: string; user: User }>).detail;
      setAuth({ user: res.user, token: res.token, isAuthenticated: true });
    };
    check();
    const timer = window.setInterval(check, 15 * 60 * 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('auth:refreshed', onRefreshed);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('auth:refreshed', onRefreshed);
    };
  }, [auth.isAuthenticated]);

  useEffect(() => {
    const onExpired = () => {
      clearSession();
      toast.error('Tu sesión expiró. Ingresa de nuevo.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [clearSession]);

  // El servidor invalida los tokens anteriores al cambiar la contraseña y entrega
  // uno nuevo; se guarda para que esta pestaña siga conectada.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const { token } = await apiClient.changePassword(currentPassword, newPassword);
    localStorage.setItem('auth_token', token);
    setAuth((prev) => ({ ...prev, token }));
  }, []);

  const refreshSession = useCallback(async () => {
    if (selectedCashRegister) {
      const session = await apiClient.getCurrentSession(selectedCashRegister.id);
      setCurrentSession(session);
    }
  }, [selectedCashRegister]);

  return (
    <AppContext.Provider value={{
      auth,
      login,
      logout,
      changePassword,
      branches,
      selectedBranch,
      setSelectedBranch,
      cashRegisters,
      selectedCashRegister,
      setSelectedCashRegister,
      currentSession,
      setCurrentSession,
      refreshSession,
      isLoading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
