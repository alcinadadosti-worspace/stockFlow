'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getLot,
  getLotOrders,
  startLot,
  closeLot,
  sealOrder,
  completeLot,
  checkAllOrdersSealed,
  startScanning,
} from '@/services/firestore/lots';
import { getPickingRules } from '@/services/firestore/pickingRules';
import { calculateLotXp } from '@/lib/xp';
import type { Lot, LotOrder, PickingRules } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Play,
  Square,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Barcode,
  AlertCircle,
  Zap,
  Timer,
  Hash,
  Boxes,
  ScanLine,
  Hourglass,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const colorMap: Record<string, { text: string; border: string; bg: string }> = {
  blue: { text: 'text-blue-500', border: 'border-blue-500/50', bg: 'bg-blue-500' },
  amber: { text: 'text-amber-500', border: 'border-amber-500/50', bg: 'bg-amber-500' },
  violet: { text: 'text-violet-500', border: 'border-violet-500/50', bg: 'bg-violet-500' },
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

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const lotId = params.lotId as string;

  const [lot, setLot] = useState<Lot | null>(null);
  const [orders, setOrders] = useState<LotOrder[]>([]);
  const [rules, setRules] = useState<PickingRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Seal state
  const [sealInput, setSealInput] = useState('');
  const [sealError, setSealError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const sealInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [lotData, ordersData, rulesData] = await Promise.all([
        getLot(lotId),
        getLotOrders(lotId),
        getPickingRules(),
      ]);
      setLot(lotData);
      setOrders(ordersData);
      setRules(rulesData);

      // Auto-select first pending order
      const firstPending = ordersData.find((o) => o.status === 'PENDING');
      if (firstPending) {
        setSelectedOrderId(firstPending.id);
      }
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

  // Auto-focus seal input when scanning
  useEffect(() => {
    if (lot?.status === 'CLOSING' && lot?.scanStartAt && sealInputRef.current) {
      sealInputRef.current.focus();
    }
  }, [lot?.status, lot?.scanStartAt, selectedOrderId]);

  async function handleStart() {
    setActionLoading(true);
    try {
      await startLot(lotId);
      toast.success('Lote iniciado! Bom trabalho!');
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
      await closeLot(lotId);
      toast.success('Lote fechado! Agora encerre os pedidos.');
      await loadData();
    } catch (err) {
      toast.error('Erro ao fechar lote');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartScanning() {
    setActionLoading(true);
    try {
      await startScanning(lotId);
      toast.success('Bipagem iniciada! Bipe os pedidos.');
      await loadData();
    } catch (err) {
      toast.error('Erro ao iniciar bipagem');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSeal() {
    if (!selectedOrderId) {
      setSealError('Selecione um pedido.');
      return;
    }

    const code = sealInput.trim();
    if (!/^\d{10}$/.test(code)) {
      setSealError('Lacre deve ter exatamente 10 dígitos.');
      return;
    }

    setSealError('');
    setActionLoading(true);
    try {
      const result = await sealOrder(lotId, selectedOrderId, code);
      if (!result.success) {
        setSealError(result.error || 'Erro ao encerrar pedido.');
        try { new Audio('/error.mp3').play().catch(() => {}); } catch {}
        return;
      }

      toast.success('Pedido encerrado!', {
        description: `Lacre ${code} aplicado.`,
      });

      try { new Audio('/success.mp3').play().catch(() => {}); } catch {}

      setSealInput('');
      await loadData();

      // Check if all sealed
      const allSealed = await checkAllOrdersSealed(lotId);
      if (allSealed) {
        await completeLot(lotId);
        toast.success('Lote concluído! Parabéns!');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347'],
        });
        await loadData();
      }
    } catch (err) {
      toast.error('Erro ao encerrar pedido');
    } finally {
      setActionLoading(false);
    }
  }

  function handleSealKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSeal();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
        <p className="text-muted-foreground">Lote não encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/lotes')}>
          Voltar
        </Button>
      </div>
    );
  }

  const sealedCount = orders.filter((o) => o.status === 'SEALED').length;
  const totalOrders = orders.length;
  const progress = totalOrders > 0 ? (sealedCount / totalOrders) * 100 : 0;

  // Timer calculations
  const startMs = lot.startAt?.toMillis() || 0;
  const endMs = lot.endAt?.toMillis() || undefined;
  const scanStartMs = lot.scanStartAt?.toMillis() || undefined;
  const scanEndMs = lot.scanEndAt?.toMillis() || undefined;

  // XP preview
  const durationMs = lot.startAt && lot.endAt
    ? lot.endAt.toMillis() - lot.startAt.toMillis()
    : lot.startAt
      ? Date.now() - lot.startAt.toMillis()
      : 0;
  const xpPreview = rules ? calculateLotXp(lot.totals, durationMs, rules) : null;

  const nextPendingOrder = orders.find((o) => o.status === 'PENDING');
  const isScanningStarted = !!lot.scanStartAt;

  // Verificar se o usuario pode trabalhar neste lote
  // Admin pode trabalhar se estiver atribuido ou se criou o lote
  const isAdmin = user?.role === 'ADMIN';
  const canWorkOnLot = !isAdmin ||
    lot.assignedGeneralUid === user?.uid ||
    lot.createdByUid === user?.uid ||
    !lot.isAdminCreated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/lotes')}>
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
          </div>
          <p className="text-sm text-muted-foreground">
            Ciclo {lot.cycle} &middot; Criado por {lot.createdByName || 'N/A'}
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
              <p className="text-xs text-muted-foreground">Itens</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chronometers Section */}
      {(lot.status !== 'DRAFT') && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Cronômetros
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Timer 1: Separação de Itens (startAt → endAt) */}
            {startMs > 0 && (
              <LiveTimer
                startMs={startMs}
                endMs={endMs}
                label="Separação de Itens"
                icon={Package}
                color="blue"
              />
            )}

            {/* Timer 2: Bipagem de Pedidos (scanStartAt → scanEndAt) */}
            {scanStartMs && (
              <LiveTimer
                startMs={scanStartMs}
                endMs={scanEndMs}
                label="Bipagem de Pedidos"
                icon={ScanLine}
                color="amber"
              />
            )}

            {/* Timer 3: Geral (endAt → scanEndAt) - from lot close to last order sealed */}
            {endMs && (
              <LiveTimer
                startMs={endMs}
                endMs={scanEndMs}
                label="Tempo Geral (Fechamento → Fim)"
                icon={Clock}
                color="violet"
              />
            )}
          </div>
        </div>
      )}

      {/* XP Preview */}
      {(lot.status === 'IN_PROGRESS' || lot.status === 'CLOSING') && xpPreview && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Zap className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-500">
                ~{xpPreview.total}
              </p>
              <p className="text-xs text-muted-foreground">XP Estimado</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {canWorkOnLot && lot.status === 'DRAFT' && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Pronto para iniciar?</p>
              <p className="text-sm text-muted-foreground">
                Clique quando sair para buscar os itens
              </p>
            </div>
            <Button onClick={handleStart} disabled={actionLoading} size="lg">
              <Play className="mr-2 h-4 w-4" />
              Iniciar Lote
            </Button>
          </CardContent>
        </Card>
      )}

      {canWorkOnLot && lot.status === 'IN_PROGRESS' && (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Retornou com os itens?</p>
              <p className="text-sm text-muted-foreground">
                Clique para fechar o lote e começar a encerrar pedidos
              </p>
              {lot.startAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Iniciado em {formatDateTimeBR(lot.startAt.toDate())}
                </p>
              )}
            </div>
            <Button onClick={handleClose} disabled={actionLoading} size="lg" variant="secondary">
              <Square className="mr-2 h-4 w-4" />
              Fechar Lote
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Bipar Pedido Agora? Button */}
      {canWorkOnLot && lot.status === 'CLOSING' && !isScanningStarted && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6 gap-4">
            <ScanLine className="h-12 w-12 text-amber-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">Bipar pedidos agora?</p>
              <p className="text-sm text-muted-foreground">
                O cronômetro de bipagem será iniciado ao clicar
              </p>
            </div>
            <Button
              onClick={handleStartScanning}
              disabled={actionLoading}
              size="lg"
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Play className="mr-2 h-4 w-4" />
              Iniciar Bipagem
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Seal Orders */}
      {canWorkOnLot && lot.status === 'CLOSING' && isScanningStarted && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Encerrar Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium whitespace-nowrap">
                {sealedCount} de {totalOrders}
              </span>
            </div>

            {nextPendingOrder && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground mb-1">Próximo pedido:</p>
                <p className="text-xl font-mono font-bold">
                  {selectedOrderId || nextPendingOrder.id}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {orders.find((o) => o.id === (selectedOrderId || nextPendingOrder.id))?.items || 0} itens
                </p>

                <div className="mt-4 flex gap-2">
                  <Input
                    ref={sealInputRef}
                    value={sealInput}
                    onChange={(e) => {
                      setSealInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                      setSealError('');
                    }}
                    onKeyDown={handleSealKeyDown}
                    placeholder="Bipe ou digite o código da caixa (10 dígitos)"
                    maxLength={10}
                    className="font-mono text-lg"
                    autoFocus
                  />
                  <Button
                    onClick={handleSeal}
                    disabled={actionLoading || sealInput.length !== 10}
                    size="lg"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Encerrar
                  </Button>
                </div>

                {sealError && (
                  <div className="mt-2 flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">{sealError}</span>
                  </div>
                )}
              </div>
            )}

            {!nextPendingOrder && sealedCount === totalOrders && (
              <div className="flex flex-col items-center py-6 text-emerald-500">
                <CheckCircle2 className="mb-2 h-10 w-10" />
                <p className="font-medium">Todos os pedidos encerrados!</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results for completed lots - 3 Chronometers Summary */}
      {lot.status === 'DONE' && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <Timer className="h-5 w-5" />
              Resultados dos Cronômetros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                <Package className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Separação de Itens</p>
                <p className="text-xl font-bold font-mono text-blue-500">
                  {lot.durationMs ? formatDuration(lot.durationMs) : '--'}
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                <ScanLine className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Bipagem de Pedidos</p>
                <p className="text-xl font-bold font-mono text-amber-500">
                  {lot.scanDurationMs ? formatDuration(lot.scanDurationMs) : '--'}
                </p>
              </div>
              <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-4 text-center">
                <Clock className="h-6 w-6 text-violet-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Tempo Geral</p>
                <p className="text-xl font-bold font-mono text-violet-500">
                  {lot.totalDurationMs ? formatDuration(lot.totalDurationMs) : '--'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* XP Breakdown for completed lots */}
      {lot.status === 'DONE' && xpPreview && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <Zap className="h-5 w-5" />
              XP Ganho
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Base</p>
                <p className="text-lg font-bold">{xpPreview.base}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-lg font-bold">{xpPreview.orderXp}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">Itens</p>
                <p className="text-lg font-bold">{xpPreview.itemXp}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Bônus {xpPreview.bonusPercent > 0 ? `(+${xpPreview.bonusPercent}%)` : ''}
                </p>
                <p className="text-lg font-bold">{xpPreview.bonus}</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Velocidade: {xpPreview.speed} itens/min</span>
              <span className="text-xl font-bold text-amber-500">Total: {lot.xpEarned || xpPreview.total} XP</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos ({totalOrders})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-3 transition-colors',
                  order.status === 'SEALED' && 'bg-emerald-500/5 border-emerald-500/20',
                  selectedOrderId === order.id && order.status === 'PENDING' && 'border-primary bg-primary/5',
                  lot.status === 'CLOSING' && isScanningStarted && order.status === 'PENDING' && 'cursor-pointer hover:bg-accent/50',
                )}
                onClick={() => {
                  if (lot.status === 'CLOSING' && isScanningStarted && order.status === 'PENDING') {
                    setSelectedOrderId(order.id);
                    setSealInput('');
                    setSealError('');
                    sealInputRef.current?.focus();
                  }
                }}
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
                    {order.approvedAt && ` \u00b7 Aprovado: ${formatDateTimeBR(order.approvedAt.toDate())}`}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {order.sealedCode && (
                    <p className="font-mono text-xs">Lacre: {order.sealedCode}</p>
                  )}
                  {order.sealedAt && (
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeBR(order.sealedAt.toDate())}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
