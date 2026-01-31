'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { getTaskLogsByUser, getLotsByUser, getUser } from '@/services/firestore';
import { calculateLevel, xpProgress, formatDateBR } from '@/lib/utils';
import { BADGES } from '@/lib/constants';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import type { AppUser, TaskLog, Lot, DailyXp, UserStats } from '@/types';
import {
  Zap,
  Package,
  ClipboardCheck,
  Flame,
  TrendingUp,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function buildDailyXpData(taskLogs: TaskLog[], lots: Lot[]): DailyXp[] {
  const { start, end } = getMonthRange();
  const dailyMap = new Map<string, number>();

  // Initialize all days of the month
  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().split('T')[0];
    dailyMap.set(key, 0);
    current.setDate(current.getDate() + 1);
  }

  // Add XP from task logs
  for (const log of taskLogs) {
    const date = log.occurredAt.toDate();
    if (date >= start && date <= end) {
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, (dailyMap.get(key) || 0) + log.xp);
    }
  }

  // Add XP from completed lots
  for (const lot of lots) {
    if (lot.status === 'DONE' && lot.xpEarned && lot.endAt) {
      const date = lot.endAt.toDate();
      if (date >= start && date <= end) {
        const key = date.toISOString().split('T')[0];
        dailyMap.set(key, (dailyMap.get(key) || 0) + (lot.xpEarned || 0));
      }
    }
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, xp]) => ({ date, xp }));
}

function computeStats(
  taskLogs: TaskLog[],
  lots: Lot[],
  appUser: AppUser | null,
): UserStats {
  const { start, end } = getMonthRange();

  const monthTaskLogs = taskLogs.filter((t) => {
    const d = t.occurredAt.toDate();
    return d >= start && d <= end;
  });
  const monthLots = lots.filter((l) => {
    const d = l.createdAt.toDate();
    return d >= start && d <= end;
  });

  const doneLots = monthLots.filter((l) => l.status === 'DONE');
  const xpTasks = monthTaskLogs.reduce((sum, t) => sum + t.xp, 0);
  const xpPicking = doneLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
  const xpTotal = xpTasks + xpPicking;

  const ordersSealed = doneLots.reduce((sum, l) => sum + l.totals.orders, 0);
  const itemsSeparated = doneLots.reduce((sum, l) => sum + l.totals.items, 0);
  const totalDurationMs = doneLots.reduce((sum, l) => sum + (l.durationMs || 0), 0);
  const avgLotDurationMs = doneLots.length > 0 ? totalDurationMs / doneLots.length : 0;
  const totalMinutes = totalDurationMs / 60000;
  const itemsPerMinute = totalMinutes > 0 ? itemsSeparated / totalMinutes : 0;
  const totalHours = totalDurationMs / 3600000;
  const ordersPerHour = totalHours > 0 ? ordersSealed / totalHours : 0;

  const fastLots = doneLots.filter((l) => {
    if (!l.durationMs || l.durationMs <= 0) return false;
    const mins = l.durationMs / 60000;
    const speed = l.totals.items / mins;
    return speed >= 5;
  }).length;

  return {
    xpTotal,
    xpTasks,
    xpPicking,
    tasksCompleted: monthTaskLogs.length,
    lotsCompleted: doneLots.length,
    ordersSealed,
    itemsSeparated,
    avgLotDurationMs,
    itemsPerMinute: Math.round(itemsPerMinute * 100) / 100,
    ordersPerHour: Math.round(ordersPerHour * 100) / 100,
    streak: appUser?.streak || 0,
    fastLots,
    level: calculateLevel(appUser?.xpTotal || 0),
  };
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-8 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Level bar skeleton */}
      <Card>
        <CardContent className="pt-6">
          <div className="h-4 w-48 bg-muted rounded mb-3" />
          <div className="h-2 w-full bg-muted rounded-full" />
        </CardContent>
      </Card>
      {/* Chart skeleton */}
      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full bg-muted rounded" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') {
    return <AdminDashboard />;
  }

  return <EstoquistaDashboard />;
}

function EstoquistaDashboard() {
  const { user } = useAuth();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    async function loadData() {
      setLoading(true);
      try {
        const [fetchedUser, fetchedTaskLogs, fetchedLots] = await Promise.all([
          getUser(user!.uid),
          getTaskLogsByUser(user!.uid),
          getLotsByUser(user!.uid),
        ]);
        setAppUser(fetchedUser);
        setTaskLogs(fetchedTaskLogs);
        setLots(fetchedLots);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.uid]);

  const stats = useMemo(
    () => computeStats(taskLogs, lots, appUser),
    [taskLogs, lots, appUser],
  );

  const dailyXpData = useMemo(
    () => buildDailyXpData(taskLogs, lots),
    [taskLogs, lots],
  );

  const progress = useMemo(
    () => xpProgress(appUser?.xpTotal || 0),
    [appUser?.xpTotal],
  );

  const earnedBadges = useMemo(
    () => BADGES.filter((badge) => badge.condition(stats)),
    [stats],
  );

  const recentTaskLogs = useMemo(
    () => taskLogs.slice(0, 5),
    [taskLogs],
  );

  const recentLots = useMemo(
    () => lots.slice(0, 5),
    [lots],
  );

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  const statCards = [
    {
      title: 'XP do Mês',
      value: stats.xpTotal.toLocaleString('pt-BR'),
      icon: Zap,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
    {
      title: 'Lotes Concluídos',
      value: stats.lotsCompleted,
      icon: Package,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      title: 'Pedidos Encerrados',
      value: stats.ordersSealed,
      icon: ClipboardCheck,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
    {
      title: 'Streak',
      value: `${stats.streak} dias`,
      icon: Flame,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bem-vindo de volta, {appUser?.name || 'Usuário'}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* XP Level Progress */}
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-sm px-3 py-1">
                Level {progress.level}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {progress.current.toLocaleString('pt-BR')} / {progress.needed.toLocaleString('pt-BR')} XP
              </span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(progress.percent)}%
            </span>
          </div>
          <Progress value={progress.percent} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            XP total: {(appUser?.xpTotal || 0).toLocaleString('pt-BR')}
          </p>
        </CardContent>
      </Card>

      {/* XP Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">XP por Dia (Mês Atual)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyXpData}>
                <defs>
                  <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => {
                    const day = value.split('-')[2];
                    return day;
                  }}
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--card-foreground))',
                  }}
                  labelFormatter={(label: string) => {
                    const parts = label.split('-');
                    return `${parts[2]}/${parts[1]}`;
                  }}
                  formatter={(value: number) => [`${value} XP`, 'XP']}
                />
                <Area
                  type="monotone"
                  dataKey="xp"
                  stroke="hsl(var(--chart-1, 220 70% 50%))"
                  strokeWidth={2}
                  fill="url(#xpGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity and Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTaskLogs.length === 0 && recentLots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma atividade registrada ainda.
                </p>
              )}

              {recentTaskLogs.map((log) => (
                <div
                  key={`task-${log.id}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-amber-500/10">
                      <Zap className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {log.taskTypeName || 'Tarefa'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(log.occurredAt.toDate())}
                        {log.quantity > 1 && ` - Qty: ${log.quantity}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    +{log.xp} XP
                  </Badge>
                </div>
              ))}

              {recentLots.map((lot) => (
                <div
                  key={`lot-${lot.id}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                      <Package className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Lote {lot.lotCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(lot.createdAt.toDate())} -{' '}
                        {lot.totals.orders} pedidos, {lot.totals.items} itens
                      </p>
                    </div>
                  </div>
                  {lot.status === 'DONE' && lot.xpEarned ? (
                    <Badge variant="secondary" className="text-xs">
                      +{lot.xpEarned} XP
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {lot.status === 'DONE'
                        ? 'Concluído'
                        : lot.status === 'IN_PROGRESS'
                          ? 'Em andamento'
                          : lot.status === 'CLOSING'
                            ? 'Encerrando'
                            : 'Rascunho'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Badges */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Conquistas</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {earnedBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Complete atividades para desbloquear conquistas.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {earnedBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Award className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {badge.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Show remaining locked badges count */}
            {BADGES.length - earnedBadges.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                {BADGES.length - earnedBadges.length} conquista(s) restante(s) para desbloquear
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
