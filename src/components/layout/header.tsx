'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSound } from '@/hooks/useSound';
import { useOperator } from '@/hooks/useOperator';
import { useTheme } from 'next-themes';
import { Moon, Sun, Volume2, VolumeX, UserCircle, Shield, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateLevel } from '@/lib/utils';

export function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const { operator, isAdminMode, clearOperator } = useOperator();

  const level = user?.xpTotal ? calculateLevel(user.xpTotal) : 1;

  function handleChangeOperator() {
    clearOperator();
    router.push('/funcoes');
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        {operator ? (
          <>
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                Operador {operator.code} - {operator.name}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Trabalhando como operador
            </p>
          </>
        ) : isAdminMode ? (
          <>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">
                Modo Administrador
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Acesso completo ao sistema
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">
              Olá, {user?.name || 'Estoquista'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user?.role === 'ADMIN' ? 'Administrador' : 'Estoquista'}
            </p>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {(operator || isAdminMode) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleChangeOperator}
            className="gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Trocar
          </Button>
        )}
        <Badge variant="secondary" className="gap-1 px-3 py-1">
          <span className="text-xs font-medium">Nível {level}</span>
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1">
          <span className="text-xs font-bold text-amber-500">
            {(user?.xpTotal || 0).toLocaleString('pt-BR')} XP
          </span>
        </Badge>
        {user?.streak && user.streak > 0 ? (
          <Badge variant="outline" className="gap-1 px-3 py-1">
            <span className="text-xs">🔥 {user.streak} dias</span>
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSound}
          title={soundEnabled ? 'Desativar sons' : 'Ativar sons'}
        >
          {soundEnabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}
