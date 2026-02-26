'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllOperators } from '@/services/firestore/operators';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import type { Operator, TaskLog, Lot, DailyXp } from '@/types';
import {
  Zap,
  Package,
  ClipboardCheck,
  Users,
  TrendingUp,
  Timer,
  Gauge,
  ListChecks,
  CalendarDays,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const CHART_COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(160, 60%, 45%)',
  'hsl(280, 60%, 55%)',
  'hsl(30, 80%, 55%)',
  'hsl(350, 65%, 55%)',
  'hsl(190, 70%, 45%)',
  'hsl(100, 50%, 45%)',
  'hsl(45, 90%, 50%)',
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

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

// Helper functions for operator lot matching
function isOperatorInLot(lot: Lot, operatorCode: string): boolean {
  return lot.operatorCode === operatorCode ||
    lot.separatorOperatorCode === operatorCode ||
    lot.scannerOperatorCode === operatorCode ||
    lot.assignedGeneralUid === operatorCode ||
    lot.assignedSeparatorUid === operatorCode ||
    lot.assignedScannerUid === operatorCode;
}

function getOperatorXpFromLot(lot: Lot, operatorCode: string): number {
  if (lot.status !== 'DONE') return 0;

  const isSeparator = lot.separatorOperatorCode === operatorCode || lot.assignedSeparatorUid === operatorCode;
  const isScanner = lot.scannerOperatorCode === operatorCode || lot.assignedScannerUid === operatorCode;
  const isGeneral = lot.operatorCode === operatorCode || lot.assignedGeneralUid === operatorCode;

  const isSeparatedMode = lot.scannerOperatorCode &&
    lot.separatorOperatorCode !== lot.scannerOperatorCode;

  if (isSeparatedMode) {
    if (isSeparator && lot.separatorXpEarned) return lot.separatorXpEarned;
    if (isScanner && lot.scannerXpEarned) return lot.scannerXpEarned;
    return 0;
  }

  if (isGeneral || isSeparator) return lot.xpEarned || 0;
  return 0;
}

export function AdminDashboard() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedOperators, fetchedTaskLogs, fetchedLots] = await Promise.all([
          getAllOperators(),
          getAllTaskLogs(),
          getAllLots(),
        ]);
        setOperators(fetchedOperators.filter(op => op.active));
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

  const monthLots = useMemo(
    () => lots.filter((l) => {
      const d = l.createdAt.toDate();
      return d >= start && d <= end;
    }),
    [lots, start, end],
  );

  const filteredLots = useMemo(
    () => selectedOperator === 'all' ? monthLots : monthLots.filter((l) => isOperatorInLot(l, selectedOperator)),
    [monthLots, selectedOperator],
  );

  const doneLots = useMemo(
    () => filteredLots.filter((l) => l.status === 'DONE'),
    [filteredLots],
  );

  const teamStats = useMemo(() => {
    // Calcular XP total
    let xpPicking = 0;
    if (selectedOperator === 'all') {
      xpPicking = doneLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
    } else {
      xpPicking = doneLots.reduce((sum, l) => sum + getOperatorXpFromLot(l, selectedOperator), 0);
    }

    const ordersSealed = doneLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);
    const itemsSeparated = doneLots.reduce((sum, l) => sum + (l.totals?.items || 0), 0);

    return {
      xpTotal: xpPicking,
      lotsCompleted: doneLots.length,
      ordersSealed,
      itemsSeparated,
      activeOperators: operators.length,
    };
  }, [doneLots, operators.length, selectedOperator]);

  // ─── CHART 1: XP por Operador (team) / XP Diário (individual) ────────────────
  const operatorXpChart = useMemo(() => {
    if (selectedOperator !== 'all') return null;
    return operators.map((op) => {
      const opLots = monthLots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
      const xpPicking = opLots.reduce((sum, l) => sum + getOperatorXpFromLot(l, op.code), 0);
      return { name: op.name, code: op.code, xpPicking };
    }).filter((d) => d.xpPicking > 0)
      .sort((a, b) => b.xpPicking - a.xpPicking);
  }, [operators, monthLots, selectedOperator]);

  const dailyXpData = useMemo(() => {
    if (selectedOperator === 'all') return null;
    return buildOperatorDailyXpData(monthLots, selectedOperator);
  }, [selectedOperator, monthLots]);

  function buildOperatorDailyXpData(allLots: Lot[], operatorCode: string): DailyXp[] {
    const { start: s, end: e } = getMonthRange();
    const dailyMap = new Map<string, number>();

    const current = new Date(s);
    while (current <= e) {
      const key = current.toISOString().split('T')[0];
      dailyMap.set(key, 0);
      current.setDate(current.getDate() + 1);
    }

    for (const lot of allLots) {
      if (lot.status === 'DONE' && lot.endAt && isOperatorInLot(lot, operatorCode)) {
        const date = lot.endAt.toDate();
        if (date >= s && date <= e) {
          const key = date.toISOString().split('T')[0];
          const xp = getOperatorXpFromLot(lot, operatorCode);
          dailyMap.set(key, (dailyMap.get(key) || 0) + xp);
        }
      }
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, xp]) => ({ date, xp }));
  }

  // ─── CHART 2: Lotes concluídos por dia (line chart) ──────────────────────────
  const dailyLotsData = useMemo(() => {
    const { start: s, end: e } = getMonthRange();
    const dailyMap = new Map<string, { completed: number; orders: number; items: number }>();

    const current = new Date(s);
    while (current <= e) {
      const key = current.toISOString().split('T')[0];
      dailyMap.set(key, { completed: 0, orders: 0, items: 0 });
      current.setDate(current.getDate() + 1);
    }

    for (const lot of doneLots) {
      const date = lot.endAt?.toDate() || lot.createdAt.toDate();
      if (date >= s && date <= e) {
        const key = date.toISOString().split('T')[0];
        const prev = dailyMap.get(key) || { completed: 0, orders: 0, items: 0 };
        dailyMap.set(key, {
          completed: prev.completed + 1,
          orders: prev.orders + (lot.totals?.orders || 0),
          items: prev.items + (lot.totals?.items || 0),
        });
      }
    }

    return Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
  }, [doneLots]);

  // ─── CHART 3: Distribuição por operador (pie chart) ────────────────────────────
  const operatorDistribution = useMemo(() => {
    if (selectedOperator !== 'all') return [];
    return operators.map((op) => {
      const opLots = monthLots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
      return {
        name: op.name,
        value: opLots.length,
      };
    }).filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [operators, monthLots, selectedOperator]);

  // ─── CHART 4: Produtividade por operador - itens/min (horizontal bar) ─────────
  const productivityChart = useMemo(() => {
    if (selectedOperator !== 'all') return null;
    return operators.map((op) => {
      const opLots = monthLots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
      const totalItems = opLots.reduce((s, l) => s + (l.totals?.items || 0), 0);
      const totalMs = opLots.reduce((s, l) => s + (l.durationMs || 0), 0);
      const totalMin = totalMs / 60000;
      const itemsPerMin = totalMin > 0 ? Math.round((totalItems / totalMin) * 100) / 100 : 0;
      return { name: op.name, itemsPerMin, lotes: opLots.length };
    }).filter((d) => d.lotes > 0)
      .sort((a, b) => b.itemsPerMin - a.itemsPerMin);
  }, [operators, monthLots, selectedOperator]);

  // ─── CHART 5: Tempos médios por operador (grouped bar) ────────────────────────
  const avgTimesChart = useMemo(() => {
    if (selectedOperator !== 'all') return null;
    return operators.map((op) => {
      const opLots = monthLots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
      if (opLots.length === 0) return null;
      const avgPicking = opLots.reduce((s, l) => s + (l.durationMs || 0), 0) / opLots.length / 60000;
      const avgScanning = opLots.reduce((s, l) => s + (l.scanDurationMs || 0), 0) / opLots.length / 60000;
      return {
        name: op.name,
        separacao: Math.round(avgPicking * 10) / 10,
        bipagem: Math.round(avgScanning * 10) / 10,
      };
    }).filter(Boolean) as Array<{ name: string; separacao: number; bipagem: number }>;
  }, [operators, monthLots, selectedOperator]);

  // ─── Recent activity ─────────────────────────────────────────────────────────
  const recentActivity = useMemo(() => {
    const activities: Array<{ type: 'lot'; operatorName: string; description: string; xp: number; date: Date }> = [];

    const lotsSource = selectedOperator === 'all' ? lots : lots.filter((l) => isOperatorInLot(l, selectedOperator));

    for (const lot of lotsSource.filter((l) => l.status === 'DONE').slice(0, 30)) {
      const operatorName = lot.operatorName || lot.separatorOperatorName || lot.createdByName || 'Operador';
      activities.push({
        type: 'lot',
        operatorName,
        description: `Lote ${lot.lotCode} (${lot.totals.orders} pedidos)`,
        xp: lot.xpEarned || 0,
        date: lot.endAt?.toDate() || lot.createdAt.toDate(),
      });
    }

    return activities
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 15);
  }, [lots, selectedOperator]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const selectedOperatorData = operators.find(op => op.code === selectedOperator);

  const statCards = [
    {
      title: selectedOperator === 'all' ? 'XP da Equipe (Mês)' : 'XP do Mês',
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
      title: selectedOperator === 'all' ? 'Operadores' : 'Itens Separados',
      value: selectedOperator === 'all' ? teamStats.activeOperators : teamStats.itemsSeparated.toLocaleString('pt-BR'),
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
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedOperator === 'all'
              ? 'Visão geral da equipe no mês atual'
              : `Estatísticas de ${selectedOperatorData?.name || 'Operador'} no mês atual`}
          </p>
        </div>
        <Select value={selectedOperator} onValueChange={setSelectedOperator}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda a Equipe</SelectItem>
            {operators.map((op) => (
              <SelectItem key={op.code} value={op.code}>{op.code} - {op.name}</SelectItem>
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

      {/* Chart 1: XP por Operador / XP Diário */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {selectedOperator === 'all' ? 'XP por Operador (Mês Atual)' : 'XP por Dia (Mês Atual)'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {selectedOperator === 'all' && operatorXpChart ? (
                <BarChart data={operatorXpChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString('pt-BR')} XP`, 'XP Picking']} />
                  <Bar dataKey="xpPicking" name="XP Picking" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : dailyXpData ? (
                <AreaChart data={dailyXpData}>
                  <defs>
                    <linearGradient id="adminXpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.split('-')[2]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string) => { const p = l.split('-'); return `${p[2]}/${p[1]}`; }} formatter={(v: number) => [`${v} XP`, 'XP']} />
                  <Area type="monotone" dataKey="xp" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#adminXpGradient)" />
                </AreaChart>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados para exibir</div>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row: 2 charts side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 2: Lotes e Pedidos por Dia (line chart) */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Lotes e Pedidos por Dia</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyLotsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(v: string) => v.split('-')[2]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(l: string) => { const p = l.split('-'); return `${p[2]}/${p[1]}`; }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="completed" name="Lotes" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="Pedidos" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Chart 3: Distribuição por Operador (pie chart) */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {selectedOperator === 'all' ? 'Lotes por Operador' : 'Itens por Dia'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {selectedOperator === 'all' ? (
                operatorDistribution.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem lotes no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={operatorDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {operatorDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} lotes`, name]} />
                    </PieChart>
                  </ResponsiveContainer>
                )
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyLotsData}>
                    <defs>
                      <linearGradient id="itemsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tickFormatter={(v: string) => v.split('-')[2]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(l: string) => { const p = l.split('-'); return `${p[2]}/${p[1]}`; }} />
                    <Area type="monotone" dataKey="items" name="Itens" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#itemsGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: 2 more charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Chart 4: Produtividade (itens/min por operador) */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {selectedOperator === 'all' ? 'Produtividade por Operador (itens/min)' : 'Evolução Produtividade (itens/min)'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {selectedOperator === 'all' && productivityChart ? (
                productivityChart.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados de produtividade</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productivityChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis type="category" dataKey="name" width={80} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} itens/min`, 'Velocidade']} />
                      <Bar dataKey="itemsPerMin" name="Itens/min" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]}>
                        {productivityChart.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.itemsPerMin >= 5 ? CHART_COLORS[1] : CHART_COLORS[4]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <ProductivityEvolution lots={doneLots} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chart 5: Tempos Médios por Operador */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                {selectedOperator === 'all' ? 'Tempos Médios por Operador (min)' : 'Tempos por Lote (min)'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {selectedOperator === 'all' && avgTimesChart ? (
                avgTimesChart.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados de tempo</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avgTimesChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} min`, '']} />
                      <Legend />
                      <Bar dataKey="separacao" name="Separação" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bipagem" name="Bipagem" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <LotTimesEvolution lots={doneLots} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lotes Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum lote concluído no período.
            </p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div
                  key={`${activity.type}-${i}`}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                      <Package className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.operatorName} &middot; {formatDateTimeBR(activity.date)}
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

// ─── Sub-components for individual user mode ─────────────────────────────────

function ProductivityEvolution({ lots }: { lots: Lot[] }) {
  const data = useMemo(() => {
    return lots
      .filter((l) => l.durationMs && l.durationMs > 0 && l.totals.items > 0)
      .sort((a, b) => (a.endAt?.toMillis() || 0) - (b.endAt?.toMillis() || 0))
      .map((l) => {
        const mins = (l.durationMs || 1) / 60000;
        return {
          lot: l.lotCode,
          itemsPerMin: Math.round((l.totals.items / mins) * 100) / 100,
        };
      });
  }, [lots]);

  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados de produtividade</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="prodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="lot" stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} itens/min`, 'Velocidade']} />
        <Area type="monotone" dataKey="itemsPerMin" stroke={CHART_COLORS[1]} strokeWidth={2} fill="url(#prodGradient)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function LotTimesEvolution({ lots }: { lots: Lot[] }) {
  const data = useMemo(() => {
    return lots
      .filter((l) => l.durationMs && l.durationMs > 0)
      .sort((a, b) => (a.endAt?.toMillis() || 0) - (b.endAt?.toMillis() || 0))
      .map((l) => ({
        lot: l.lotCode,
        separacao: Math.round((l.durationMs || 0) / 60000 * 10) / 10,
        bipagem: Math.round((l.scanDurationMs || 0) / 60000 * 10) / 10,
      }));
  }, [lots]);

  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados de tempo</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="lot" stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} min`, '']} />
        <Legend />
        <Line type="monotone" dataKey="separacao" name="Separação" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="bipagem" name="Bipagem" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
