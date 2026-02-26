'use client';

import { useEffect, useState } from 'react';
import { getAllOperators } from '@/services/firestore/operators';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import type { Operator, TaskLog, Lot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
  const [operators, setOperators] = useState<Operator[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [operatorsData, logsData, lotsData] = await Promise.all([
        getAllOperators(),
        getAllTaskLogs(),
        getAllLots(),
      ]);
      setOperators(operatorsData.filter(op => op.active));
      setTaskLogs(logsData);
      setLots(lotsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Função para verificar se um operador participou de um lote
  function isOperatorInLot(lot: Lot, operatorCode: string): boolean {
    return lot.operatorCode === operatorCode ||
      lot.separatorOperatorCode === operatorCode ||
      lot.scannerOperatorCode === operatorCode ||
      lot.assignedGeneralUid === operatorCode ||
      lot.assignedSeparatorUid === operatorCode ||
      lot.assignedScannerUid === operatorCode;
  }

  // Função para calcular XP do operador em um lote
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

  const filteredLots = selectedOperator === 'all'
    ? lots
    : lots.filter((l) => isOperatorInLot(l, selectedOperator));
  const completedLots = filteredLots.filter((l) => l.status === 'DONE');

  // Calcular XP total de picking
  const totalXpPicking = selectedOperator === 'all'
    ? completedLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0)
    : completedLots.reduce((sum, l) => sum + getOperatorXpFromLot(l, selectedOperator), 0);

  const totalItems = completedLots.reduce((sum, l) => sum + (l.totals?.items || 0), 0);
  const totalOrders = completedLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);
  const avgDuration = completedLots.length > 0
    ? completedLots.reduce((sum, l) => sum + (l.durationMs || 0), 0) / completedLots.length
    : 0;
  const totalDurationMin = completedLots.reduce((sum, l) => sum + (l.durationMs || 0), 0) / 60000;
  const itemsPerMin = totalDurationMin > 0 ? totalItems / totalDurationMin : 0;

  // Chart data: XP by operator
  const chartData = operators.map((op) => {
    const opLots = lots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
    const xpPicking = opLots.reduce((sum, l) => sum + getOperatorXpFromLot(l, op.code), 0);
    return {
      name: op.name.split(' ')[0],
      code: op.code,
      picking: xpPicking,
    };
  }).sort((a, b) => b.picking - a.picking);

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
            Visão geral de produtividade da equipe
          </p>
        </div>
        <Select value={selectedOperator} onValueChange={setSelectedOperator}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todos os operadores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda a Equipe</SelectItem>
            {operators.map((op) => (
              <SelectItem key={op.code} value={op.code}>
                {op.code} - {op.name}
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
            <div className="text-2xl font-bold">{totalXpPicking.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">XP Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Users className="mb-2 h-5 w-5 text-blue-500" />
            <div className="text-2xl font-bold">{operators.length}</div>
            <p className="text-xs text-muted-foreground">Operadores</p>
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
            <ClipboardList className="mb-2 h-5 w-5 text-emerald-500" />
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
            XP por Operador
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
                  formatter={(value: number, name: string) => [value.toLocaleString('pt-BR') + ' XP', 'XP Picking']}
                />
                <Bar dataKey="picking" name="XP Picking" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Operator Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Operador</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Código</th>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-right font-medium">Nível</th>
                  <th className="px-3 py-2 text-right font-medium">XP Total</th>
                  <th className="px-3 py-2 text-right font-medium">Lotes</th>
                  <th className="px-3 py-2 text-right font-medium">Pedidos</th>
                  <th className="px-3 py-2 text-right font-medium">Itens</th>
                  <th className="px-3 py-2 text-right font-medium">Streak</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => {
                  const opLots = lots.filter((l) => l.status === 'DONE' && isOperatorInLot(l, op.code));
                  const xpP = opLots.reduce((s, l) => s + getOperatorXpFromLot(l, op.code), 0);
                  const totalOrdersOp = opLots.reduce((s, l) => s + (l.totals?.orders || 0), 0);
                  const totalItemsOp = opLots.reduce((s, l) => s + (l.totals?.items || 0), 0);
                  return (
                    <tr key={op.code} className="border-b">
                      <td className="px-3 py-2 font-mono font-medium">{op.code}</td>
                      <td className="px-3 py-2 font-medium">{op.name}</td>
                      <td className="px-3 py-2 text-right">{calculateLevel(op.xpTotal || 0)}</td>
                      <td className="px-3 py-2 text-right font-bold text-amber-500">{(op.xpTotal || 0).toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-right">{opLots.length}</td>
                      <td className="px-3 py-2 text-right">{totalOrdersOp}</td>
                      <td className="px-3 py-2 text-right">{totalItemsOp}</td>
                      <td className="px-3 py-2 text-right">{op.streak || 0}</td>
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
