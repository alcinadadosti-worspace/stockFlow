'use client';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import { Moon, Sun, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calculateLevel } from '@/lib/utils';

export function Header() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const level = user?.xpTotal ? calculateLevel(user.xpTotal) : 1;

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
      <div>
        <h2 className="text-lg font-semibold">
          Olá, {user?.name || 'Estoquista'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {user?.role === 'ADMIN' ? 'Administrador' : 'Estoquista'}
        </p>
      </div>
      <div className="flex items-center gap-3">
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
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  );
}
