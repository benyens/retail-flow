import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthState, Branch, CashRegister, CashSession } from '@/types';
import { apiClient } from '@/api';

interface AppContextType {
  // Auth
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
  });
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [selectedCashRegister, setSelectedCashRegister] = useState<CashRegister | null>(null);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Rehidratar sesión al montar (ej. tras recargar la página). Sin esto,
  // un token válido en localStorage quedaba "huérfano": las requests
  // seguían autenticadas correctamente, pero la UI mostraba al usuario
  // como no-logueado hasta el próximo login manual.
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    const payload = decodeJwtPayload(token);
    if (!payload) {
      localStorage.removeItem('auth_token');
      return;
    }
    setAuth({
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
    });
  }, []);

  // Load branches on auth
  useEffect(() => {
    if (auth.isAuthenticated) {
      apiClient.getBranches().then(setBranches);
    }
  }, [auth.isAuthenticated]);

  // Load cash registers when branch changes
  useEffect(() => {
    if (selectedBranch) {
      apiClient.getCashRegisters(selectedBranch.id).then(setCashRegisters);
      setSelectedCashRegister(null);
      setCurrentSession(null);
    }
  }, [selectedBranch]);

  // Check for existing session when register changes
  useEffect(() => {
    if (selectedCashRegister) {
      apiClient.getCurrentSession(selectedCashRegister.id).then(setCurrentSession);
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

  const logout = useCallback(() => {
    setAuth({ user: null, token: null, isAuthenticated: false });
    setSelectedBranch(null);
    setSelectedCashRegister(null);
    setCurrentSession(null);
    localStorage.removeItem('auth_token');
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
