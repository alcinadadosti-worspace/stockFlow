'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  getSingleOrder,
  startSingleOrderSeparation,
  endSingleOrderSeparation,
  startSingleOrderScanning,
  sealSingleOrder,
} from '@/services/firestore/singleOrders';
import type { SingleOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Boxes,
  ScanLine,
  ClipboardList,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SEPARATING: 'Separando',
  READY_TO_SCAN: 'Pronto p/ Bipar',
  SCANNING: 'Bipando',
  DONE: 'Concluido',
};

const colorMap: Record<string, { text: string; border: string; bg: string }> = {
  blue: { text: 'text-blue-500', border: 'border-blue-500/50', bg: 'bg-blue-500' },
  amber: { text: 'text-amber-500', border: 'border-amber-500/50', bg: 'bg-amber-500' },
  violet: { text: 'text-violet-500', border: 'border-violet-500/50', bg: 'bg-violet-500' },
  green: { text: 'text-green-500', border: 'border-green-500/50', bg: 'bg-green-500' },
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

export default function PedidoAvulsoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<SingleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Seal state
  const [sealInput, setSealInput] = useState('');
  const [sealError, setSealError] = useState('');
  const sealInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSingleOrder(orderId);
      setOrder(data);
    } catch (err) {
      console.error('Erro ao carregar pedido:', err);
      toast.error('Erro ao carregar dados do pedido');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-focus seal input when scanning
  useEffect(() => {
    if (order?.status === 'SCANNING' && sealInputRef.current) {
      sealInputRef.current.focus();
    }
  }, [order?.status]);

  async function handleStartSeparation() {
    setActionLoading(true);
    try {
      await startSingleOrderSeparation(orderId);
      toast.success('Separacao iniciada! Bom trabalho!');
      await loadData();
    } catch (err) {
      toast.error('Erro ao iniciar separacao');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEndSeparation() {
    setActionLoading(true);
    try {
      await endSingleOrderSeparation(orderId);
      toast.success('Separacao finalizada! Agora bipe o pedido.');
      await loadData();
    } catch (err) {
      toast.error('Erro ao finalizar separacao');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartScanning() {
    setActionLoading(true);
    try {
      await startSingleOrderScanning(orderId);
      toast.success('Bipagem iniciada!');
      await loadData();
    } catch (err) {
      toast.error('Erro ao iniciar bipagem');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSeal() {
    const code = sealInput.trim();
    if (!/^\d{10}$/.test(code)) {
      setSealError('Lacre deve ter exatamente 10 digitos.');
      return;
    }

    setSealError('');
    setActionLoading(true);
    try {
      const result = await sealSingleOrder(orderId, code);
      if (!result.success) {
        setSealError(result.error || 'Erro ao encerrar pedido.');
        try { new Audio('/error.mp3').play().catch(() => {}); } catch {}
        return;
      }

      toast.success('Pedido concluido! Parabens!');
      try { new Audio('/success.mp3').play().catch(() => {}); } catch {}

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22C55E', '#10B981', '#34D399'],
      });

      await loadData();
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
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center py-20">
        <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">Pedido nao encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/pedido-avulso')}>
          Voltar
        </Button>
      </div>
    );
  }

  // Timer calculations
  const separationStartMs = order.separationStartAt?.toMillis() || undefined;
  const separationEndMs = order.separationEndAt?.toMillis() || undefined;
  const scanStartMs = order.scanStartAt?.toMillis() || undefined;
  const scanEndMs = order.scanEndAt?.toMillis() || undefined;

  // Total timer (soma dos dois quando ambos existem)
  const showTotalTimer = order.status === 'DONE' || (separationEndMs && scanStartMs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/pedido-avulso')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              Pedido {order.orderCode}
            </h1>
            <Badge className={cn(
              order.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-500' :
              order.status === 'SEPARATING' ? 'bg-blue-500/10 text-blue-500' :
              order.status === 'READY_TO_SCAN' ? 'bg-purple-500/10 text-purple-500' :
              order.status === 'SCANNING' ? 'bg-amber-500/10 text-amber-500' :
              'bg-slate-500/10 text-slate-500',
            )}>
              {STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.items} itens para processar
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ClipboardList className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold font-mono">{order.orderCode}</p>
              <p className="text-xs text-muted-foreground">Codigo do Pedido</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Boxes className="h-8 w-8 text-violet-500" />
            <div>
              <p className="text-2xl font-bold">{order.items}</p>
              <p className="text-xs text-muted-foreground">Itens</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timers */}
      {order.status !== 'DRAFT' && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Cronometros
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Timer 1: Separacao */}
            {separationStartMs && (
              <LiveTimer
                startMs={separationStartMs}
                endMs={separationEndMs}
                label="Separacao de Itens"
                icon={Package}
                color="blue"
              />
            )}

            {/* Timer 2: Bipagem */}
            {scanStartMs && (
              <LiveTimer
                startMs={scanStartMs}
                endMs={scanEndMs}
                label="Bipagem e Lacracao"
                icon={ScanLine}
                color="amber"
              />
            )}

            {/* Timer 3: Geral */}
            {showTotalTimer && separationStartMs && (
              <LiveTimer
                startMs={separationStartMs}
                endMs={scanEndMs}
                label="Tempo Total"
                icon={Clock}
                color="violet"
              />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {order.status === 'DRAFT' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Pronto para iniciar a separacao?</p>
              <p className="text-sm text-muted-foreground">
                Clique quando sair para buscar os {order.items} itens no estoque
              </p>
            </div>
            <Button onClick={handleStartSeparation} disabled={actionLoading} size="lg" className="bg-green-500 hover:bg-green-600">
              <Play className="mr-2 h-4 w-4" />
              Iniciar Separacao
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status === 'SEPARATING' && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">Retornou com os itens separados?</p>
              <p className="text-sm text-muted-foreground">
                Clique para finalizar a separacao e iniciar a bipagem
              </p>
              {order.separationStartAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Iniciado em {formatDateTimeBR(order.separationStartAt.toDate())}
                </p>
              )}
            </div>
            <Button onClick={handleEndSeparation} disabled={actionLoading} size="lg" variant="secondary">
              <Square className="mr-2 h-4 w-4" />
              Finalizar Separacao
            </Button>
          </CardContent>
        </Card>
      )}

      {order.status === 'READY_TO_SCAN' && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex flex-col items-center justify-center pt-6 pb-6 gap-4">
            <ScanLine className="h-12 w-12 text-amber-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">Bipar e lacrar agora?</p>
              <p className="text-sm text-muted-foreground">
                O cronometro de bipagem sera iniciado ao clicar
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

      {order.status === 'SCANNING' && (
        <Card className="border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />
              Lacrar Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs text-muted-foreground mb-1">Pedido:</p>
              <p className="text-xl font-mono font-bold">{order.orderCode}</p>
              <p className="text-sm text-muted-foreground mt-1">{order.items} itens</p>

              <div className="mt-4 flex gap-2">
                <Input
                  ref={sealInputRef}
                  value={sealInput}
                  onChange={(e) => {
                    setSealInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setSealError('');
                  }}
                  onKeyDown={handleSealKeyDown}
                  placeholder="Bipe ou digite o codigo do lacre (10 digitos)"
                  maxLength={10}
                  className="font-mono text-lg"
                  autoFocus
                />
                <Button
                  onClick={handleSeal}
                  disabled={actionLoading || sealInput.length !== 10}
                  size="lg"
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Lacrar
                </Button>
              </div>

              {sealError && (
                <div className="mt-2 flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{sealError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results for completed orders */}
      {order.status === 'DONE' && (
        <>
          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-500">
                <Timer className="h-5 w-5" />
                Resultados dos Cronometros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4 text-center">
                  <Package className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Separacao</p>
                  <p className="text-xl font-bold font-mono text-blue-500">
                    {order.separationDurationMs ? formatDuration(order.separationDurationMs) : '--'}
                  </p>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 text-center">
                  <ScanLine className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Bipagem e Lacracao</p>
                  <p className="text-xl font-bold font-mono text-amber-500">
                    {order.scanDurationMs ? formatDuration(order.scanDurationMs) : '--'}
                  </p>
                </div>
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-4 text-center">
                  <Clock className="h-6 w-6 text-violet-500 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Tempo Total</p>
                  <p className="text-xl font-bold font-mono text-violet-500">
                    {order.totalDurationMs ? formatDuration(order.totalDurationMs) : '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500">
                <Zap className="h-5 w-5" />
                XP Ganho
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Lacre aplicado:</p>
                  <p className="font-mono font-bold">{order.sealedCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-amber-500">+{order.xpEarned} XP</p>
                  <p className="text-sm text-muted-foreground">
                    {order.items} itens processados
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Info Card */}
      {order.status !== 'DONE' && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ClipboardList className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Fluxo do Pedido Avulso:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li className={order.status === 'SEPARATING' ? 'text-blue-500 font-medium' : ''}>
                    Iniciar separacao (sair para buscar os itens)
                  </li>
                  <li className={order.status === 'READY_TO_SCAN' ? 'text-purple-500 font-medium' : ''}>
                    Finalizar separacao (voltar com os itens)
                  </li>
                  <li className={order.status === 'SCANNING' ? 'text-amber-500 font-medium' : ''}>
                    Bipar e lacrar a caixa
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
