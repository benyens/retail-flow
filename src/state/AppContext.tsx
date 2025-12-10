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
