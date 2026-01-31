'use client';

import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';

export default function PromoteAdminPage() {
  const [status, setStatus] = useState('Aguardando autenticação...');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        setStatus('Você precisa estar logado. Faça login primeiro em / e depois volte aqui.');
        return;
      }

      try {
        setStatus('Atualizando role para ADMIN...');
        await updateDoc(doc(getFirebaseDb(), 'users', user.uid), { role: 'ADMIN' });
        setStatus('Pronto! Seu role foi atualizado para ADMIN. Faça logout e login novamente.');
      } catch (err) {
        setStatus('Erro: ' + (err instanceof Error ? err.message : String(err)));
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', fontSize: 18 }}>
      <p>{status}</p>
    </div>
  );
}
