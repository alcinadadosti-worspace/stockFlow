'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFilial, getFilialByCode } from '@/hooks/useFilial';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Boxes } from 'lucide-react';

export default function SelecionarFilialPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { hasScope, isReady, setFilialScope } = useFilial();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !isReady) return;
    if (!user) router.replace('/login');
    else if (hasScope) router.replace('/dashboard');
  }, [user, authLoading, hasScope, isReady, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = getFilialByCode(code);
    if (!result.valid) {
      setError('Código inválido');
      setCode('');
      return;
    }
    setFilialScope(result.scope);
    router.push('/dashboard');
  }

  if (authLoading || !isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-2">
            <Boxes className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Logisticca</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Código de Acesso</CardTitle>
            <CardDescription>
              Digite o código para acessar seu estoque
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              {error && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={code.length < 4}>
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
