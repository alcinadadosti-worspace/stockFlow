'use client';

import { useEffect, useState } from 'react';
import { getAllOperators } from '@/services/firestore/operators';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots, getAllSealedOrders, type OrderWithLotInfo } from '@/services/firestore/lots';
import type { Operator, TaskLog, Lot } from '@/types';
import { CITIES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Package, ClipboardList, Zap, Timer, Gauge, AlertTriangle, Clock, CheckCircle2, XCircle, MapPin } from 'lucide-react';
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
  const [sealedOrders, setSealedOrders] = useState<OrderWithLotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [operatorsData, logsData, lotsData, ordersData] = await Promise.all([
        getAllOperators(),
        getAllTaskLogs(),
        getAllLots(),
        getAllSealedOrders(),
      ]);
      setOperators(operatorsData.filter(op => op.active));
      setTaskLogs(logsData);
      setLots(lotsData);
      setSealedOrders(ordersData);
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

  // ==================== ANALISE DE TEMPO DE VIDA DOS PEDIDOS ====================

  // Interface para análise de pedido
  interface OrderLifetimeAnalysis {
    orderCode: string;
    lotCode: string;
    city?: string;
    approvedAt: Date | null;
    sealedAt: Date | null;
    lifetimeDays: number | null; // dias entre aprovação e lacração
    isCompliant: boolean; // cumpriu a regra de 24hrs
  }

  // Função para extrair apenas a data (sem hora) de um Timestamp
  function getDateOnly(timestamp: { toDate: () => Date } | null | undefined): Date | null {
    if (!timestamp) return null;
    const date = timestamp.toDate();
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // Calcular diferença em dias entre duas datas
  function getDaysDifference(date1: Date, date2: Date): number {
    const diffMs = date2.getTime() - date1.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  // Filtrar pedidos por cidade se selecionada
  const filteredOrders = selectedCity === 'all'
    ? sealedOrders
    : sealedOrders.filter((o) => o.city === selectedCity);

  // Analisar todos os pedidos lacrados
  const orderAnalysis: OrderLifetimeAnalysis[] = filteredOrders.map((order) => {
    const approvedDate = getDateOnly(order.approvedAt);
    const sealedDate = getDateOnly(order.sealedAt);

    let lifetimeDays: number | null = null;
    let isCompliant = true;

    if (approvedDate && sealedDate) {
      lifetimeDays = getDaysDifference(approvedDate, sealedDate);
      // Regra: pedido aprovado deve ser lacrado em até 24hrs (próximo dia)
      // Se aprovado dia 25 e lacrado dia 26 = 1 dia = OK
      // Se aprovado dia 25 e lacrado dia 27 = 2 dias = NÃO OK
      isCompliant = lifetimeDays <= 1;
    }

    return {
      orderCode: order.orderCode,
      lotCode: order.lotCode,
      city: order.city,
      approvedAt: approvedDate,
      sealedAt: sealedDate,
      lifetimeDays,
      isCompliant,
    };
  });

  // Separar pedidos com data de aprovação válida
  const ordersWithApprovalDate = orderAnalysis.filter((o) => o.approvedAt !== null);
  const compliantOrders = ordersWithApprovalDate.filter((o) => o.isCompliant);
  const nonCompliantOrders = ordersWithApprovalDate.filter((o) => !o.isCompliant);

  // Estatísticas
  const totalOrdersAnalyzed = ordersWithApprovalDate.length;
  const compliantCount = compliantOrders.length;
  const nonCompliantCount = nonCompliantOrders.length;
  const complianceRate = totalOrdersAnalyzed > 0
    ? (compliantCount / totalOrdersAnalyzed * 100).toFixed(1)
    : '0';

  // Calcular média de dias para lacrar
  const avgLifetimeDays = ordersWithApprovalDate.length > 0
    ? ordersWithApprovalDate.reduce((sum, o) => sum + (o.lifetimeDays || 0), 0) / ordersWithApprovalDate.length
    : 0;

  // Agrupar pedidos atrasados por cidade
  const nonCompliantByCity = nonCompliantOrders.reduce((acc, o) => {
    const cityId = o.city || 'sem-cidade';
    if (!acc[cityId]) acc[cityId] = [];
    acc[cityId].push(o);
    return acc;
  }, {} as Record<string, OrderLifetimeAnalysis[]>);

  // Função para formatar data BR
  function formatDateBR(date: Date | null): string {
    if (!date) return '--';
    return date.toLocaleDateString('pt-BR');
  }

  // Nome da cidade
  function getCityName(cityId?: string): string {
    if (!cityId) return 'Sem cidade';
    const city = CITIES.find((c) => c.id === cityId);
    return city?.name || cityId;
  }

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
        <div className="flex gap-2">
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as cidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Cidades</SelectItem>
              {CITIES.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Order Lifetime Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tempo de Vida dos Pedidos
            {selectedCity !== 'all' && (
              <Badge variant="outline" className="ml-2">
                <MapPin className="mr-1 h-3 w-3" />
                {getCityName(selectedCity)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* KPIs de Tempo de Vida */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
                <span className="text-sm">Pedidos Analisados</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{totalOrdersAnalyzed}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm">Dentro do Prazo</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600">{compliantCount}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-red-600">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">Fora do Prazo</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-600">{nonCompliantCount}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gauge className="h-4 w-4" />
                <span className="text-sm">Taxa de Conformidade</span>
              </div>
              <div className="mt-2 text-2xl font-bold">
                {complianceRate}%
              </div>
            </div>
          </div>

          {/* Média de dias */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média de dias para lacrar</p>
                <p className="text-xl font-bold">{avgLifetimeDays.toFixed(1)} dias</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Meta: até 1 dia</p>
                <Badge variant={avgLifetimeDays <= 1 ? 'default' : 'destructive'}>
                  {avgLifetimeDays <= 1 ? 'Dentro da meta' : 'Acima da meta'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Alerta para pedidos fora do prazo */}
          {nonCompliantCount > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pedidos fora do prazo de 24 horas</AlertTitle>
              <AlertDescription>
                {nonCompliantCount} pedido(s) foram lacrados após o prazo de 24 horas da aprovação.
                A regra determina que pedidos aprovados devem ser lacrados até o dia seguinte.
              </AlertDescription>
            </Alert>
          )}

          {/* Tabela de pedidos fora do prazo */}
          {nonCompliantCount > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Pedidos Atrasados ({nonCompliantCount})
              </h4>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Pedido</th>
                      <th className="px-3 py-2 text-left font-medium">Lote</th>
                      <th className="px-3 py-2 text-left font-medium">Cidade</th>
                      <th className="px-3 py-2 text-center font-medium">Aprovado</th>
                      <th className="px-3 py-2 text-center font-medium">Lacrado</th>
                      <th className="px-3 py-2 text-center font-medium">Dias</th>
                      <th className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nonCompliantOrders.slice(0, 50).map((order) => (
                      <tr key={order.orderCode} className="border-b">
                        <td className="px-3 py-2 font-mono">{order.orderCode}</td>
                        <td className="px-3 py-2 font-mono">{order.lotCode}</td>
                        <td className="px-3 py-2">{getCityName(order.city)}</td>
                        <td className="px-3 py-2 text-center">{formatDateBR(order.approvedAt)}</td>
                        <td className="px-3 py-2 text-center">{formatDateBR(order.sealedAt)}</td>
                        <td className="px-3 py-2 text-center font-bold text-red-600">
                          {order.lifetimeDays}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="destructive" className="text-xs">
                            Atrasado
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {nonCompliantCount > 50 && (
                  <p className="mt-2 text-sm text-muted-foreground text-center">
                    Mostrando 50 de {nonCompliantCount} pedidos atrasados
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Resumo por cidade */}
          {Object.keys(nonCompliantByCity).length > 0 && selectedCity === 'all' && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Pedidos Atrasados por Cidade
              </h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(nonCompliantByCity).map(([cityId, orders]) => (
                  <Badge key={cityId} variant="outline" className="px-3 py-1">
                    {getCityName(cityId)}: <span className="ml-1 font-bold text-red-600">{orders.length}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
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
