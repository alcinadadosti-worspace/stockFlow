'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOperator } from '@/hooks/useOperator';
import {
  LayoutDashboard,
  Trophy,
  ClipboardList,
  Package,
  Users,
  UserCog,
  Sliders,
  BarChart3,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Monitor,
  Layers,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { OperatorSelectDialog } from '@/components/operators/operator-select-dialog';
import { AdminPinDialog } from '@/components/admin/admin-pin-dialog';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresOperator?: boolean;
  requiresAdminPin?: boolean;
  external?: boolean;
};

const mainNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leaderboard', label: 'Ranking', icon: Trophy },
  { href: '/funcoes', label: 'Funcoes', icon: Layers },
  { href: '/lotes', label: 'Lotes', icon: Package, requiresOperator: true },
  { href: '/pedido-avulso', label: 'Pedido Avulso', icon: FileText, requiresOperator: true },
];

const adminNav: NavItem[] = [
  { href: '/admin/lotes', label: 'Gerenciar Lotes', icon: Package, requiresAdminPin: true },
  { href: '/admin/operadores', label: 'Operadores', icon: UserCog, requiresAdminPin: true },
  { href: '/admin/regras-xp', label: 'Regras de XP', icon: Sliders, requiresAdminPin: true },
  { href: '/admin/tarefas', label: 'Tarefas', icon: ClipboardList, requiresAdminPin: true },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users, requiresAdminPin: true },
  { href: '/admin/relatorios', label: 'Relatórios', icon: BarChart3, requiresAdminPin: true },
  { href: '/telao', label: 'Telão', icon: Monitor, external: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { operator, isAdminMode } = useOperator();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  // Dialog states
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [operatorDialogRedirect, setOperatorDialogRedirect] = useState('');
  const [operatorDialogTitle, setOperatorDialogTitle] = useState('');
  const [adminPinDialogOpen, setAdminPinDialogOpen] = useState(false);
  const [adminPinDialogRedirect, setAdminPinDialogRedirect] = useState('');

  function handleNavClick(item: NavItem, e: React.MouseEvent) {
    // Se requer operador e nao tem operador nem admin mode
    if (item.requiresOperator && !operator && !isAdminMode) {
      e.preventDefault();
      setOperatorDialogRedirect(item.href);
      setOperatorDialogTitle(item.label);
      setOperatorDialogOpen(true);
      return;
    }

    // Se requer admin PIN e nao esta em admin mode
    if (item.requiresAdminPin && !isAdminMode) {
      e.preventDefault();
      setAdminPinDialogRedirect(item.href);
      setAdminPinDialogOpen(true);
      return;
    }
  }

  return (
    <>
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
                  onClick={(e) => handleNavClick(item, e)}
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
                  const isExternal = item.external;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={isExternal ? '_blank' : undefined}
                      onClick={(e) => !isExternal && handleNavClick(item, e)}
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

      {/* Operator Selection Dialog */}
      <OperatorSelectDialog
        open={operatorDialogOpen}
        onClose={() => setOperatorDialogOpen(false)}
        redirectTo={operatorDialogRedirect}
        title={operatorDialogTitle}
      />

      {/* Admin PIN Dialog */}
      <AdminPinDialog
        open={adminPinDialogOpen}
        onClose={() => setAdminPinDialogOpen(false)}
        redirectTo={adminPinDialogRedirect}
      />
    </>
  );
}
