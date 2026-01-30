'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  Package,
  Settings,
  Users,
  Sliders,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Boxes,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const mainNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leaderboard', label: 'Ranking', icon: Trophy },
  { href: '/tarefas', label: 'Tarefas', icon: ClipboardList },
  { href: '/lotes', label: 'Lotes', icon: Package },
];

const adminNav = [
  { href: '/admin/tarefas', label: 'Gerenciar Tarefas', icon: Settings },
  { href: '/admin/regras-xp', label: 'Regras de XP', icon: Sliders },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/relatorios', label: 'Relatórios', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[240px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Boxes className="h-6 w-6 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight">StockFlow</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <>
            <Separator className="my-3" />
            <div className="mb-2 px-3">
              {!collapsed && (
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin
                </span>
              )}
            </div>
            <div className="space-y-1">
              {adminNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 w-full"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
