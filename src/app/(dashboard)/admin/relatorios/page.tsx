'use client';

import { useEffect, useState } from 'react';
import { getAllUsers } from '@/services/firestore/users';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import type { AppUser, TaskLog, Lot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { BarChart3, Users, Package, ClipboardList, Zap, Timer, Gauge } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { calculateLevel, formatDuration } from '@/lib/utils';

export default function RelatoriosPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, logsData, lotsData] = await Promise.all([
        getAllUsers(),
        getAllTaskLogs(),
        getAllLots(),
      ]);
      setUsers(usersData);
      setTaskLogs(logsData);
      setLots(lotsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = selectedUser === 'all' ? taskLogs : taskLogs.filter((l) => l.uid === selectedUser);
  const filteredLots = selectedUser === 'all' ? lots : lots.filter((l) => l.createdByUid === selectedUser);
  const completedLots = filteredLots.filter((l) => l.status === 'DONE');

  const totalXpTasks = filteredLogs.reduce((sum, l) => sum + (l.xp || 0), 0);
  const totalXpPicking = completedLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
  const totalItems = completedLots.reduce((sum, l) => sum + (l.totals?.items || 0), 0);
  const totalOrders = completedLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);
  const avgDuration = completedLots.length > 0
    ? completedLots.reduce((sum, l) => sum + (l.durationMs || 0), 0) / completedLots.length
    : 0;
  const totalDurationMin = completedLots.reduce((sum, l) => sum + (l.durationMs || 0), 0) / 60000;
  const itemsPerMin = totalDurationMin > 0 ? totalItems / totalDurationMin : 0;
  const ordersPerHour = totalDurationMin > 0 ? (totalOrders / totalDurationMin) * 60 : 0;

  // Chart data: XP by user
  const chartData = users.map((u) => {
    const userLogs = taskLogs.filter((l) => l.uid === u.uid);
    const userLots = lots.filter((l) => l.createdByUid === u.uid && l.status === 'DONE');
    return {
      name: u.name.split(' ')[0],
      tarefas: userLogs.reduce((sum, l) => sum + (l.xp || 0), 0),
      picking: userLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0),
    };
  }).sort((a, b) => (b.tarefas + b.picking) - (a.tarefas + a.picking)).slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral de produtividade e XP
          </p>
        </div>
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Usuários</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.uid} value={u.uid}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <Zap className="mb-2 h-5 w-5 text-amber-500" />
            <div className="text-2xl font-bold">{(totalXpTasks + totalXpPicking).toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">XP Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <ClipboardList className="mb-2 h-5 w-5 text-blue-500" />
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
            <p className="text-xs text-muted-foreground">Tarefas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Package className="mb-2 h-5 w-5 text-violet-500" />
            <div className="text-2xl font-bold">{completedLots.length}</div>
            <p className="text-xs text-muted-foreground">Lotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Users className="mb-2 h-5 w-5 text-emerald-500" />
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Timer className="mb-2 h-5 w-5 text-orange-500" />
            <div className="text-2xl font-bold">{avgDuration > 0 ? formatDuration(avgDuration) : '--'}</div>
            <p className="text-xs text-muted-foreground">Tempo Médio/Lote</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Gauge className="mb-2 h-5 w-5 text-cyan-500" />
            <div className="text-2xl font-bold">{itemsPerMin.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Itens/Min</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            XP por Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="tarefas" name="Tarefas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="picking" name="Picking" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* User Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Estoquista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-right font-medium">Nível</th>
                  <th className="px-3 py-2 text-right font-medium">XP Total</th>
                  <th className="px-3 py-2 text-right font-medium">Tarefas</th>
                  <th className="px-3 py-2 text-right font-medium">Lotes</th>
                  <th className="px-3 py-2 text-right font-medium">Pedidos</th>
                  <th className="px-3 py-2 text-right font-medium">Itens</th>
                  <th className="px-3 py-2 text-right font-medium">Streak</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const uLogs = taskLogs.filter((l) => l.uid === u.uid);
                  const uLots = lots.filter((l) => l.createdByUid === u.uid && l.status === 'DONE');
                  const xpT = uLogs.reduce((s, l) => s + (l.xp || 0), 0);
                  const xpP = uLots.reduce((s, l) => s + (l.xpEarned || 0), 0);
                  return (
                    <tr key={u.uid} className="border-b">
                      <td className="px-3 py-2 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-right">{calculateLevel(u.xpTotal || 0)}</td>
                      <td className="px-3 py-2 text-right font-bold text-amber-500">{(xpT + xpP).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right">{uLogs.length}</td>
                      <td className="px-3 py-2 text-right">{uLots.length}</td>
                      <td className="px-3 py-2 text-right">{uLots.reduce((s, l) => s + (l.totals?.orders || 0), 0)}</td>
                      <td className="px-3 py-2 text-right">{uLots.reduce((s, l) => s + (l.totals?.items || 0), 0)}</td>
                      <td className="px-3 py-2 text-right">{u.streak || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
