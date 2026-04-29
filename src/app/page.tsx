'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFilial } from '@/hooks/useFilial';

export default function Home() {
  const { user, loading } = useAuth();
  const { hasScope, isReady } = useFilial();
  const router = useRouter();

  useEffect(() => {
    if (loading || !isReady) return;
    if (!user) {
      router.replace('/login');
    } else if (!hasScope) {
      router.replace('/selecionar-filial');
    } else {
      router.replace('/dashboard');
    }
  }, [user, loading, hasScope, isReady, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    </div>
  );
}
