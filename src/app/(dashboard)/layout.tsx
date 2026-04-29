'use client';

import { useAuth } from '@/hooks/useAuth';
import { useFilial } from '@/hooks/useFilial';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { hasScope, isReady } = useFilial();
  const router = useRouter();

  useEffect(() => {
    if (loading || !isReady) return;
    if (!user) router.replace('/login');
    else if (!hasScope) router.replace('/selecionar-filial');
  }, [user, loading, hasScope, isReady, router]);

  if (loading || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !hasScope) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
