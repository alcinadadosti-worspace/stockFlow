'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSound } from '@/hooks/useSound';
import { useOperator } from '@/hooks/useOperator';
import { useOperatorData } from '@/hooks/useOperatorData';
import { useTheme } from 'next-themes';
import { Moon, Sun, Volume2, VolumeX, Shield, RefreshCw, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateLevel, cn } from '@/lib/utils';
import { getAvatarById } from '@/lib/avatars';

export function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { soundEnabled, toggleSound } = useSound();
  const { operator, isAdminMode, clearOperator } = useOperator();
  const { operatorData } = useOperatorData();

  // Usar dados do operador se estiver em modo operador, senao usar dados do usuario
  const displayXp = operator ? (operatorData?.xpTotal || 0) : (user?.xpTotal || 0);
  const displayStreak = operator ? (operatorData?.streak || 0) : (user?.streak || 0);
  const displayLevel = calculateLevel(displayXp);
  const avatar = operator ? getAvatarById(operatorData?.avatar) : null;

  function handleChangeOperator() {
    clearOperator();
    router.push('/funcoes');
  }

  function handleProfileClick() {
    if (operator) {
      router.push('/perfil');
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        {operator ? (
          <>
            {/* Avatar clicavel para ir ao perfil */}
            <button
              onClick={handleProfileClick}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform hover:scale-110',
                avatar?.bgColor || 'bg-primary'
              )}
              title="Ver perfil"
            >
              {avatar?.emoji || <User className="h-5 w-5 text-white" />}
            </button>
            <div>
              <h2 className="text-lg font-semibold">
                {operator.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Operador {operator.code}
              </p>
            </div>
          </>
        ) : isAdminMode ? (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Modo Administrador
              </h2>
              <p className="text-sm text-muted-foreground">
                Acesso completo ao sistema
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {user?.name || 'Estoquista'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {user?.role === 'ADMIN' ? 'Administrador' : 'Estoquista'}
              </p>
            </div>
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
          <span className="text-xs font-medium">Nivel {displayLevel}</span>
        </Badge>
        <Badge variant="outline" className="gap-1 px-3 py-1">
          <span className="text-xs font-bold text-amber-500">
            {displayXp.toLocaleString('pt-BR')} XP
          </span>
        </Badge>
        {displayStreak > 0 && (
          <Badge variant="outline" className="gap-1 px-3 py-1">
            <span className="text-xs">🔥 {displayStreak} dias</span>
          </Badge>
        )}
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
