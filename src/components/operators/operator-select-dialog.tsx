'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getActiveOperators } from '@/services/firestore/operators';
import { useOperator } from '@/hooks/useOperator';
import { useFilial } from '@/hooks/useFilial';
import { useSound } from '@/hooks/useSound';
import type { Operator } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperatorSelectDialogProps {
  open: boolean;
  onClose: () => void;
  redirectTo: string;
  title?: string;
}

export function OperatorSelectDialog({
  open,
  onClose,
  redirectTo,
  title = 'Identificação',
}: OperatorSelectDialogProps) {
  const router = useRouter();
  const { setOperator, setAdminMode } = useOperator();
  const { filialScope } = useFilial();
  const { playSound } = useSound();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdminInput, setShowAdminInput] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (open) {
      loadOperators();
      setShowAdminInput(false);
      setAdminPin('');
      setPinError('');
    }
  }, [open]);

  async function loadOperators() {
    setLoading(true);
    try {
      const data = await getActiveOperators();
      const filtered = filialScope
        ? data.filter((op) => op.filial === filialScope)
        : data;
      setOperators(filtered);
    } catch (err) {
      console.error('Erro ao carregar operadores:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectOperator(op: Operator) {
    playSound('click');
    setOperator({ code: op.code, name: op.name });
    onClose();
    router.push(redirectTo);
  }

  function handleAdminAccess() {
    // PIN padrão: 1234 (pode ser alterado para algo configurável)
    if (adminPin === '1234') {
      playSound('success');
      setAdminMode(true);
      onClose();
      router.push(redirectTo);
    } else {
      playSound('error');
      setPinError('PIN incorreto');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {showAdminInput
              ? 'Digite o PIN de administrador'
              : 'Selecione seu código de operador'}
          </DialogDescription>
        </DialogHeader>

        {showAdminInput ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="PIN"
                maxLength={4}
                value={adminPin}
                onChange={(e) => {
                  setAdminPin(e.target.value.replace(/\D/g, ''));
                  setPinError('');
                }}
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              {pinError && (
                <p className="text-sm text-destructive text-center">{pinError}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowAdminInput(false)}
              >
                Voltar
              </Button>
              <Button
                className="flex-1"
                onClick={handleAdminAccess}
                disabled={adminPin.length < 4}
              >
                Entrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : operators.length === 0 ? (
              <div className="py-8 text-center">
                <User className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Nenhum operador cadastrado
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Acesse como admin para cadastrar
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {operators.map((op, index) => (
                  <button
                    key={op.code}
                    onClick={() => handleSelectOperator(op)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border p-3 transition-all',
                      'hover:border-primary hover:bg-primary/5 hover:scale-105',
                      'focus:outline-none focus:ring-2 focus:ring-primary',
                      'opacity-0 animate-scale-in',
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="text-2xl font-bold text-primary">{op.code}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-full">
                      {op.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowAdminInput(true)}
              >
                <Shield className="h-4 w-4" />
                Acesso Administrador
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
