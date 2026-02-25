'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { useSound } from '@/hooks/useSound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield } from 'lucide-react';

interface AdminPinDialogProps {
  open: boolean;
  onClose: () => void;
  redirectTo: string;
}

export function AdminPinDialog({ open, onClose, redirectTo }: AdminPinDialogProps) {
  const router = useRouter();
  const { setAdminMode } = useOperator();
  const { playSound } = useSound();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  function handleClose() {
    setPin('');
    setPinError('');
    onClose();
  }

  function handleSubmit() {
    // PIN padrao: 1234
    if (pin === '1234') {
      playSound('success');
      setAdminMode(true);
      handleClose();
      router.push(redirectTo);
    } else {
      playSound('error');
      setPinError('PIN incorreto');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && pin.length === 4) {
      handleSubmit();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Acesso Administrador
          </DialogTitle>
          <DialogDescription>
            Digite o PIN de administrador para continuar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Input
              type="password"
              placeholder="PIN"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setPinError('');
              }}
              onKeyDown={handleKeyDown}
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
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={pin.length < 4}
            >
              Entrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
