'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getLot,
  getLotOrders,
  startLot,
  closeLotForSeparator,
} from '@/services/firestore/lots';
import type { Lot, LotOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Play,
  Square,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Timer,
  Hash,
  Boxes,
  Hourglass,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const colorMap: Record<string, { text: string; border: string; bg: string }> = {
  blue: { text: 'text-blue-500', border: 'border-blue-500/50', bg: 'bg-blue-500' },
};

function LiveTimer({ startMs, endMs, label, icon: Icon, color }: {
  startMs: number;
  endMs?: number;
  label: string;
  icon: React.ElementType;
  color: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (endMs) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [endMs]);

  const elapsed = (endMs || now) - startMs;
  const isRunning = !endMs;
  const colors = colorMap[color] || colorMap.blue;

  return (
    <Card className={cn('border', isRunning && colors.border)}>
      <CardContent className="flex items-center gap-3 pt-6">
        <Icon className={cn('h-8 w-8', colors.text)} />
        <div>
          <p className={cn('text-2xl font-bold font-mono', isRunning && colors.text)}>
            {elapsed > 0 ? formatDuration(elapsed) : '--'}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {label}
            {isRunning && (
              <span className={cn('inline-block h-2 w-2 rounded-full animate-pulse', colors.bg)} />
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SeparadorLotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const lotId = params.lotId as string;

  const [lot, setLot] = useState<Lot | null>(null);
  const [orders, setOrders] = useState<LotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lotData, ordersData] = await Promise.all([
        getLot(lotId),
        getLotOrders(lotId),
      ]);
      setLot(lotData);
      setOrders(ordersData);
    } catch (err) {
      console.error('Erro ao carregar lote:', err);
      toast.error('Erro ao carregar dados do lote');
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleStart() {
    setActionLoading(true);
    try {
      await startLot(lotId);
      toast.success('Separacao iniciada! Bom trabalho!');
      await loadData();
    } catch (err) {
      toast.error('Erro ao iniciar lote');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    setActionLoading(true);
    try {
      await closeLotForSeparator(lotId);
      toast.success('Lote finalizado! Aguardando bipagem.');
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#3B82F6', '#60A5FA'],
      });
      await loadData();
    } catch (err) {
      toast.error('Erro ao fechar lote');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="flex flex-col items-center py-20">
        <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Lote nao encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/separador')}>
          Voltar
        </Button>
      </div>
    );
  }

  const totalOrders = orders.length;
  const startMs = lot.startAt?.toMillis() || 0;
  const endMs = lot.endAt?.toMillis() || undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/separador')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              Lote {lot.lotCode}
            </h1>
            <Badge className={cn(
              lot.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-500' :
              lot.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-500' :
              lot.status === 'READY_FOR_SCAN' ? 'bg-purple-500/10 text-purple-500' :
              lot.status === 'CLOSING' ? 'bg-amber-500/10 text-amber-500' :
              'bg-slate-500/10 text-slate-500',
            )}>
              {LOT_STATUS_LABELS[lot.status]}
            </Badge>
            <Badge variant="outline" className="text-blue-500 border-blue-500/30">
              Modo Separador
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Ciclo {lot.cycle} &middot; {lot.totals.items} itens para separar
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Hash className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Pedidos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Boxes className="h-8 w-8 text-violet-500" />
            <div>
              <p className="text-2xl font-bold">{lot.totals.items}</p>
              <p className="text-xs text-muted-foreground">Itens para Separar</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timer */}
      {(lot.status === 'IN_PROGRESS' || lot.status === 'READY_FOR_SCAN' || lot.status === 'DONE' || lot.status === 'CLOSING') && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Cronometro de Separacao
          </h2>
          {startMs > 0 && (
            <LiveTimer
              startMs={startMs}
              endMs={endMs}
              label="Tempo de Separacao"
              icon={Package}
              color="blue"
            />
          )}
        </div>
      )}

      {/* Actions */}
      {lot.status === 'DRAFT' && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Pronto para iniciar a separacao?</p>
              <p className="text-sm text-muted-foreground">
                Clique quando sair para buscar os itens no estoque
              </p>
            </div>
            <Button onClick={handleStart} disabled={actionLoading} size="lg" className="bg-blue-500 hover:bg-blue-600">
              <Play className="mr-2 h-4 w-4" />
              Iniciar Separacao
            </Button>
          </CardContent>
        </Card>
      )}

      {lot.status === 'IN_PROGRESS' && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Retornou com os itens separados?</p>
              <p className="text-sm text-muted-foreground">
                Clique para finalizar sua separacao e liberar para o bipador
              </p>
              {lot.startAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Iniciado em {formatDateTimeBR(lot.startAt.toDate())}
                </p>
              )}
            </div>
            <Button onClick={handleClose} disabled={actionLoading} size="lg" variant="secondary">
              <Square className="mr-2 h-4 w-4" />
              Finalizar Separacao
            </Button>
          </CardContent>
        </Card>
      )}

      {lot.status === 'READY_FOR_SCAN' && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6 gap-4">
            <Hourglass className="h-12 w-12 text-purple-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-purple-500">Separacao Concluida!</p>
              <p className="text-sm text-muted-foreground">
                Aguardando um bipador assumir este lote
              </p>
            </div>
            {lot.durationMs && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                <Package className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Tempo de Separacao</p>
                <p className="text-xl font-bold font-mono text-blue-500">
                  {formatDuration(lot.durationMs)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(lot.status === 'CLOSING' || lot.status === 'DONE') && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6 gap-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div className="text-center">
              <p className="text-lg font-semibold text-emerald-500">
                {lot.status === 'DONE' ? 'Lote Concluido!' : 'Em Bipagem'}
              </p>
              <p className="text-sm text-muted-foreground">
                {lot.status === 'DONE'
                  ? 'O bipador finalizou este lote'
                  : `Bipador: ${lot.scannerName || 'Em andamento'}`}
              </p>
            </div>
            {lot.durationMs && (
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                <Package className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Seu Tempo de Separacao</p>
                <p className="text-xl font-bold font-mono text-blue-500">
                  {formatDuration(lot.durationMs)}
                </p>
              </div>
            )}
            {lot.separatorXpEarned && lot.separatorXpEarned > 0 && (
              <Badge className="text-amber-500 bg-amber-500/10 border-amber-500/30 text-lg px-4 py-2">
                +{lot.separatorXpEarned} XP ganho
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos do Lote ({totalOrders})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-3',
                  order.status === 'SEALED' && 'bg-emerald-500/5 border-emerald-500/20',
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full">
                  {order.status === 'SEALED' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium">{order.orderCode}</span>
                    <Badge variant={order.status === 'SEALED' ? 'default' : 'secondary'} className="text-xs">
                      {order.status === 'SEALED' ? 'Encerrado' : 'Pendente'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {order.items} itens &middot; Ciclo {order.cycle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
