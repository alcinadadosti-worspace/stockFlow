'use client';

import { useEffect, useState } from 'react';
import { useOperator } from './useOperator';
import { getOperatorByCode } from '@/services/firestore/operators';
import type { Operator } from '@/types';

// Hook para buscar dados atualizados do operador do Firestore
export function useOperatorData() {
  const { operator } = useOperator();
  const [operatorData, setOperatorData] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!operator) {
      setOperatorData(null);
      return;
    }

    const operatorCode = operator.code;

    async function loadOperatorData() {
      setLoading(true);
      try {
        const data = await getOperatorByCode(operatorCode);
        setOperatorData(data);
      } catch (err) {
        console.error('Erro ao carregar dados do operador:', err);
      } finally {
        setLoading(false);
      }
    }

    loadOperatorData();
  }, [operator]);

  // Funcao para recarregar os dados
  async function refreshOperatorData() {
    if (!operator) return;

    try {
      const data = await getOperatorByCode(operator.code);
      setOperatorData(data);
    } catch (err) {
      console.error('Erro ao recarregar dados do operador:', err);
    }
  }

  return {
    operatorData,
    loading,
    refreshOperatorData,
  };
}
