'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllUsers } from '@/services/firestore/users';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import { formatDateTimeBR } from '@/lib/utils';
import type { AppUser, TaskLog, Lot, DailyXp } from '@/types';
import {
  Zap,
  Package,
  ClipboardCheck,
  Users,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().split('T')[0];
    dailyMap.set(key, 0);
    current.setDate(current.getDate() + 1);
  }

  for (const log of taskLogs) {
    const date = log.occurredAt.toDate();
    if (date >= start && date <= end) {
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, (dailyMap.get(key) || 0) + log.xp);
    }
  }

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

export function AdminDashboard() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedUsers, fetchedTaskLogs, fetchedLots] = await Promise.all([
          getAllUsers(),
          getAllTaskLogs(),
          getAllLots(),
        ]);
        setUsers(fetchedUsers);
        setTaskLogs(fetchedTaskLogs);
        setLots(fetchedLots);
      } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const { start, end } = useMemo(() => getMonthRange(), []);

  const monthTaskLogs = useMemo(
    () => taskLogs.filter((t) => {
      const d = t.occurredAt.toDate();
      return d >= start && d <= end;
    }),
    [taskLogs, start, end],
  );

  const monthLots = useMemo(
    () => lots.filter((l) => {
      const d = l.createdAt.toDate();
      return d >= start && d <= end;
    }),
    [lots, start, end],
  );

  const filteredTaskLogs = useMemo(
    () => selectedUser === 'all' ? monthTaskLogs : monthTaskLogs.filter((l) => l.uid === selectedUser),
    [monthTaskLogs, selectedUser],
  );

  const filteredLots = useMemo(
    () => selectedUser === 'all' ? monthLots : monthLots.filter((l) => l.createdByUid === selectedUser),
    [monthLots, selectedUser],
  );

  const doneLots = useMemo(
    () => filteredLots.filter((l) => l.status === 'DONE'),
    [filteredLots],
  );

  const teamStats = useMemo(() => {
    const xpTasks = filteredTaskLogs.reduce((sum, t) => sum + t.xp, 0);
    const xpPicking = doneLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
    const ordersSealed = doneLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);

    const activeUids = new Set<string>();
    monthTaskLogs.forEach((l) => activeUids.add(l.uid));
    monthLots.forEach((l) => activeUids.add(l.createdByUid));

    return {
      xpTotal: xpTasks + xpPicking,
      lotsCompleted: doneLots.length,
      ordersSealed,
      activeUsers: activeUids.size,
    };
  }, [filteredTaskLogs, doneLots, monthTaskLogs, monthLots]);

  // Chart data: per-user XP comparison (team mode) or daily XP (individual mode)
  const userXpChart = useMemo(() => {
    if (selectedUser !== 'all') return null;

    const estoquistas = users.filter((u) => u.role === 'ESTOQUISTA');
    return estoquistas.map((u) => {
      const userLogs = monthTaskLogs.filter((l) => l.uid === u.uid);
      const userLots = monthLots.filter((l) => l.createdByUid === u.uid && l.status === 'DONE');
      const xpTasks = userLogs.reduce((sum, l) => sum + l.xp, 0);
      const xpPicking = userLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
      return { name: u.name, xpTarefas: xpTasks, xpPicking };
    }).filter((d) => d.xpTarefas > 0 || d.xpPicking > 0)
      .sort((a, b) => (b.xpTarefas + b.xpPicking) - (a.xpTarefas + a.xpPicking))
      .slice(0, 10);
  }, [users, monthTaskLogs, monthLots, selectedUser]);

  const dailyXpData = useMemo(() => {
    if (selectedUser === 'all') return null;
    const userLogs = monthTaskLogs.filter((l) => l.uid === selectedUser);
    const userLots = monthLots.filter((l) => l.createdByUid === selectedUser);
    return buildDailyXpData(userLogs, userLots);
  }, [selectedUser, monthTaskLogs, monthLots]);

  // Recent activity (all users)
  const recentActivity = useMemo(() => {
    const activities: Array<{ type: 'task' | 'lot'; userName: string; description: string; xp: number; date: Date }> = [];

    const logsSource = selectedUser === 'all' ? taskLogs : taskLogs.filter((l) => l.uid === selectedUser);
    const lotsSource = selectedUser === 'all' ? lots : lots.filter((l) => l.createdByUid === selectedUser);

    for (const log of logsSource.slice(0, 30)) {
      activities.push({
        type: 'task',
        userName: log.userName || 'Usuário',
        description: log.taskTypeName || 'Tarefa',
        xp: log.xp,
        date: log.occurredAt.toDate(),
      });
    }

    for (const lot of lotsSource.filter((l) => l.status === 'DONE').slice(0, 30)) {
      activities.push({
        type: 'lot',
        userName: lot.createdByName || 'Usuário',
        description: `Lote ${lot.lotCode} (${lot.totals.orders} pedidos)`,
        xp: lot.xpEarned || 0,
        date: lot.endAt?.toDate() || lot.createdAt.toDate(),
      });
    }

    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 15);
  }, [taskLogs, lots, selectedUser]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const statCards = [
    {
      title: selectedUser === 'all' ? 'XP da Equipe (Mês)' : 'XP do Mês',
      value: teamStats.xpTotal.toLocaleString('pt-BR'),
      icon: Zap,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
    {
      title: 'Lotes Concluídos',
      value: teamStats.lotsCompleted,
      icon: Package,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      title: 'Pedidos Encerrados',
      value: teamStats.ordersSealed,
      icon: ClipboardCheck,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
    {
      title: 'Usuários Ativos',
      value: teamStats.activeUsers,
      icon: Users,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Admin</h1>
          <p className="text-muted-foreground">
            Visão geral da equipe no mês atual
          </p>
        </div>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos (Equipe)</SelectItem>
            {users.filter((u) => u.role === 'ESTOQUISTA').map((u) => (
              <SelectItem key={u.uid} value={u.uid}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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

      {/* Chart */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {selectedUser === 'all' ? 'XP por Usuário (Mês Atual)' : 'XP por Dia (Mês Atual)'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {selectedUser === 'all' && userXpChart ? (
                <BarChart data={userXpChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--card-foreground))',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="xpTarefas" name="XP Tarefas" fill="hsl(var(--chart-1, 220 70% 50%))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="xpPicking" name="XP Picking" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : dailyXpData ? (
                <AreaChart data={dailyXpData}>
                  <defs>
                    <linearGradient id="adminXpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1, 220 70% 50%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.split('-')[2]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
                    fill="url(#adminXpGradient)"
                  />
                </AreaChart>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Sem dados para exibir
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atividade registrada no período.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div
                  key={`${activity.type}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${activity.type === 'task' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                      {activity.type === 'task' ? (
                        <Zap className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Package className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.userName} &middot; {formatDateTimeBR(activity.date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    +{activity.xp} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
