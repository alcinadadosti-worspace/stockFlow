'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function useRequireAdmin() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.role !== 'ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  return { user, loading };
}
