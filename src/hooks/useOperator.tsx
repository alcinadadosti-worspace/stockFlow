'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Operator } from '@/types';

interface OperatorSession {
  code: string;
  name: string;
}

interface OperatorContextValue {
  operator: OperatorSession | null;
  isAdminMode: boolean;
  setOperator: (operator: OperatorSession) => void;
  setAdminMode: (enabled: boolean) => void;
  clearOperator: () => void;
}

const OperatorContext = createContext<OperatorContextValue | null>(null);

const STORAGE_KEY = 'stockflow-operator';
const ADMIN_MODE_KEY = 'stockflow-admin-mode';

export function OperatorProvider({ children }: { children: ReactNode }) {
  const [operator, setOperatorState] = useState<OperatorSession | null>(null);
  const [isAdminMode, setAdminModeState] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Carregar do sessionStorage na montagem
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setOperatorState(JSON.parse(stored));
      }
      const adminMode = sessionStorage.getItem(ADMIN_MODE_KEY);
      if (adminMode === 'true') {
        setAdminModeState(true);
      }
    } catch (e) {
      console.error('Erro ao carregar operador:', e);
    }
    setMounted(true);
  }, []);

  function setOperator(op: OperatorSession) {
    setOperatorState(op);
    setAdminModeState(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(op));
      sessionStorage.removeItem(ADMIN_MODE_KEY);
    } catch (e) {
      console.error('Erro ao salvar operador:', e);
    }
  }

  function setAdminMode(enabled: boolean) {
    setAdminModeState(enabled);
    if (enabled) {
      setOperatorState(null);
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.setItem(ADMIN_MODE_KEY, 'true');
      } catch (e) {
        console.error('Erro ao salvar modo admin:', e);
      }
    } else {
      try {
        sessionStorage.removeItem(ADMIN_MODE_KEY);
      } catch (e) {
        console.error('Erro ao limpar modo admin:', e);
      }
    }
  }

  function clearOperator() {
    setOperatorState(null);
    setAdminModeState(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ADMIN_MODE_KEY);
    } catch (e) {
      console.error('Erro ao limpar operador:', e);
    }
  }

  // Evitar hidratação incorreta
  if (!mounted) {
    return null;
  }

  return (
    <OperatorContext.Provider
      value={{
        operator,
        isAdminMode,
        setOperator,
        setAdminMode,
        clearOperator,
      }}
    >
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperator(): OperatorContextValue {
  const context = useContext(OperatorContext);
  if (!context) {
    throw new Error('useOperator deve ser usado dentro de OperatorProvider');
  }
  return context;
}
