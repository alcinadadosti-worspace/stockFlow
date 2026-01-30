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
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

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

  // Auto-focus seal input when in CLOSING status
  useEffect(() => {
    if (lot?.status === 'CLOSING' && sealInputRef.current) {
      sealInputRef.current.focus();
    }
  }, [lot?.status, selectedOrderId]);

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
        // Play error sound
        try { new Audio('/error.mp3').play().catch(() => {}); } catch {}
        return;
      }

      toast.success('Pedido encerrado!', {
        description: `Lacre ${code} aplicado.`,
      });

      // Play success sound
      try { new Audio('/success.mp3').play().catch(() => {}); } catch {}

      setSealInput('');
      await loadData();

      // Check if all sealed
      const allSealed = await checkAllOrdersSealed(lotId);
      if (allSealed) {
        await completeLot(lotId);
        toast.success('Lote concluído! Parabéns!');
        // Elegant confetti
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

  // XP preview
  const durationMs = lot.startAt && lot.endAt
    ? lot.endAt.toMillis() - lot.startAt.toMillis()
    : lot.startAt
      ? Date.now() - lot.startAt.toMillis()
      : 0;
  const xpPreview = rules ? calculateLotXp(lot.totals, durationMs, rules) : null;

  const nextPendingOrder = orders.find((o) => o.status === 'PENDING');

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
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Hash className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{lot.totals.orders}</p>
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
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Timer className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">
                {durationMs > 0 ? formatDuration(durationMs) : '--'}
              </p>
              <p className="text-xs text-muted-foreground">Duração</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Zap className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold text-amber-500">
                {lot.xpEarned || (xpPreview ? `~${xpPreview.total}` : '--')}
              </p>
              <p className="text-xs text-muted-foreground">XP</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {lot.status === 'DRAFT' && (
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

      {lot.status === 'IN_PROGRESS' && (
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

      {/* Seal Orders */}
      {lot.status === 'CLOSING' && (
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
                    placeholder="Bipe ou digite o lacre (10 dígitos)"
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
                  lot.status === 'CLOSING' && order.status === 'PENDING' && 'cursor-pointer hover:bg-accent/50',
                )}
                onClick={() => {
                  if (lot.status === 'CLOSING' && order.status === 'PENDING') {
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
                    {order.approvedAt && ` &middot; Aprovado: ${formatDateTimeBR(order.approvedAt.toDate())}`}
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
