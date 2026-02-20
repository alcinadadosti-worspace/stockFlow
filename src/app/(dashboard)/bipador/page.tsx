'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getLotsReadyForScan, getLotsByScanner, claimLotForScanning, getAssignedLotsScanner } from '@/services/firestore/lots';
import type { Lot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanLine, Clock, CheckCircle2, Loader2, ArrowLeft, Package, Hourglass, Play } from 'lucide-react';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function getStatusColor(status: string) {
  switch (status) {
    case 'READY_FOR_SCAN': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'CLOSING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DONE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return '';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'READY_FOR_SCAN': return <Hourglass className="h-3 w-3" />;
    case 'CLOSING': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'DONE': return <CheckCircle2 className="h-3 w-3" />;
    default: return null;
  }
}

export default function BipadorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [availableLots, setAvailableLots] = useState<Lot[]>([]);
  const [myLots, setMyLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [available, mine, assigned] = await Promise.all([
        getLotsReadyForScan(),
        getLotsByScanner(user.uid),
        getAssignedLotsScanner(user.uid),
      ]);

      // Lotes disponiveis: READY_FOR_SCAN abertos + atribuidos a mim que ainda nao comecei
      const assignedNotStarted = assigned.filter(
        (l) => l.status === 'READY_FOR_SCAN' || (l.status === 'DRAFT' && l.assignedScannerUid === user.uid)
      );
      const allAvailable = [...available];
      for (const lot of assignedNotStarted) {
        if (!allAvailable.find((l) => l.id === lot.id)) {
          allAvailable.push(lot);
        }
      }

      // Meus lotes: ja peguei ou atribuidos em andamento
      const assignedInProgress = assigned.filter(
        (l) => l.status === 'CLOSING' || l.status === 'DONE'
      );
      const allMine = [...mine];
      for (const lot of assignedInProgress) {
        if (!allMine.find((l) => l.id === lot.id)) {
          allMine.push(lot);
        }
      }

      // Ordenar
      allAvailable.sort((a, b) => (a.endAt?.toMillis() || 0) - (b.endAt?.toMillis() || 0));
      allMine.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

      setAvailableLots(allAvailable);
      setMyLots(allMine);
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleClaimLot(lot: Lot) {
    if (!user) return;
    setClaiming(lot.id);
    try {
      await claimLotForScanning(lot.id, user.uid, user.name);
      toast.success('Lote assumido! Voce pode iniciar a bipagem.');
      router.push(`/bipador/${lot.id}`);
    } catch (err) {
      toast.error('Erro ao assumir lote');
    } finally {
      setClaiming(null);
    }
  }

  // Estatisticas
  const lotsInProgress = myLots.filter((l) => l.status === 'CLOSING').length;
  const lotsDone = myLots.filter((l) => l.status === 'DONE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/funcoes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-amber-500" />
            Funcao Bipador
          </h1>
          <p className="text-sm text-muted-foreground">
            Bipe os pedidos e lacre as caixas dos lotes separados
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{availableLots.length}</div>
            <p className="text-xs text-muted-foreground">Disponiveis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{lotsInProgress}</div>
            <p className="text-xs text-muted-foreground">Bipando</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{lotsDone}</div>
            <p className="text-xs text-muted-foreground">Concluidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{myLots.length}</div>
            <p className="text-xs text-muted-foreground">Meus Lotes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="available" className="space-y-4">
        <TabsList>
          <TabsTrigger value="available" className="gap-2">
            <Hourglass className="h-4 w-4" />
            Disponiveis ({availableLots.length})
          </TabsTrigger>
          <TabsTrigger value="mine" className="gap-2">
            <ScanLine className="h-4 w-4" />
            Meus Lotes ({myLots.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Lotes Aguardando Bipagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : availableLots.length === 0 ? (
                <div className="py-12 text-center">
                  <Hourglass className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Nenhum lote disponivel para bipagem</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Aguarde os separadores finalizarem seus lotes
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableLots.map((lot) => (
                    <div
                      key={lot.id}
                      className="flex items-center gap-4 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
                        <Package className="h-5 w-5 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{lot.lotCode}</span>
                          <Badge className={cn('gap-1', getStatusColor(lot.status))}>
                            {getStatusIcon(lot.status)}
                            {LOT_STATUS_LABELS[lot.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {lot.totals?.orders || 0} pedidos &middot; {lot.totals?.items || 0} itens
                          {lot.cycle && ` · Ciclo ${lot.cycle}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Separado por: {lot.separatorName || lot.createdByName || 'N/A'}
                          {lot.durationMs && ` · Tempo: ${formatDuration(lot.durationMs)}`}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleClaimLot(lot)}
                        disabled={claiming === lot.id}
                        className="bg-amber-500 hover:bg-amber-600"
                      >
                        {claiming === lot.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        Assumir Lote
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mine">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5" />
                Meus Lotes (Bipador)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : myLots.length === 0 ? (
                <div className="py-12 text-center">
                  <ScanLine className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Voce ainda nao assumiu nenhum lote</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Veja os lotes disponiveis na aba ao lado
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myLots.map((lot) => (
                    <div
                      key={lot.id}
                      className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                      onClick={() => router.push(`/bipador/${lot.id}`)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                        <ScanLine className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold">{lot.lotCode}</span>
                          <Badge className={cn('gap-1', getStatusColor(lot.status))}>
                            {getStatusIcon(lot.status)}
                            {LOT_STATUS_LABELS[lot.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {lot.totals?.orders || 0} pedidos &middot; {lot.totals?.items || 0} itens
                          {lot.cycle && ` · Ciclo ${lot.cycle}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Separado por: {lot.separatorName || lot.createdByName || 'N/A'}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {lot.scanDurationMs && lot.scanDurationMs > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Bipagem: {formatDuration(lot.scanDurationMs)}
                          </p>
                        )}
                        {lot.scannerXpEarned && lot.scannerXpEarned > 0 && (
                          <Badge variant="outline" className="mt-1 text-amber-500">
                            +{lot.scannerXpEarned} XP
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
