'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type FilialScope = 'palmeira' | 'matriz' | null; // null = ambas

interface FilialContextValue {
  filialScope: FilialScope;
  hasScope: boolean;
  isReady: boolean;
  setFilialScope: (scope: FilialScope) => void;
  clearFilialScope: () => void;
}

const FilialContext = createContext<FilialContextValue | null>(null);

const STORAGE_KEY = 'stockflow-filial-scope';
const SCOPE_SET_KEY = 'stockflow-filial-set';

const ACCESS_CODES: Record<string, FilialScope> = {
  '3030': 'palmeira',
  '7777': 'matriz',
  '7776': null,
};

export function getFilialByCode(code: string): { valid: boolean; scope: FilialScope } {
  if (code in ACCESS_CODES) {
    return { valid: true, scope: ACCESS_CODES[code] };
  }
  return { valid: false, scope: null };
}

export function FilialProvider({ children }: { children: ReactNode }) {
  const [filialScope, setFilialScopeState] = useState<FilialScope>(null);
  const [hasScope, setHasScope] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const scopeSet = sessionStorage.getItem(SCOPE_SET_KEY);
      if (scopeSet === 'true') {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        setFilialScopeState((stored || null) as FilialScope);
        setHasScope(true);
      }
    } catch {}
    setIsReady(true);
  }, []);

  function setFilialScope(scope: FilialScope) {
    setFilialScopeState(scope);
    setHasScope(true);
    try {
      sessionStorage.setItem(SCOPE_SET_KEY, 'true');
      if (scope) {
        sessionStorage.setItem(STORAGE_KEY, scope);
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }

  function clearFilialScope() {
    setFilialScopeState(null);
    setHasScope(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SCOPE_SET_KEY);
    } catch {}
  }

  return (
    <FilialContext.Provider value={{ filialScope, hasScope, isReady, setFilialScope, clearFilialScope }}>
      {children}
    </FilialContext.Provider>
  );
}

export function useFilial(): FilialContextValue {
  const context = useContext(FilialContext);
  if (!context) throw new Error('useFilial deve ser usado dentro de FilialProvider');
  return context;
}
