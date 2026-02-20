'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getLotsByUser } from '@/services/firestore/lots';
import type { Lot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Plus, Clock, CheckCircle2, Loader2, FileEdit, ArrowLeft, Hourglass } from 'lucide-react';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ImportLotDialog } from '@/components/lotes/import-lot-dialog';

function getStatusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'READY_FOR_SCAN': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'CLOSING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DONE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return '';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'DRAFT': return <FileEdit className="h-3 w-3" />;
    case 'IN_PROGRESS': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'READY_FOR_SCAN': return <Hourglass className="h-3 w-3" />;
    case 'CLOSING': return <Clock className="h-3 w-3" />;
    case 'DONE': return <CheckCircle2 className="h-3 w-3" />;
    default: return null;
  }
}

export default function SeparadorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getLotsByUser(user.uid);
      // Filtrar apenas lotes do modo SEPARADOR ou GERAL criados por este usuario
      const separatorLots = data.filter(
        (l) => l.workMode === 'SEPARADOR' || !l.workMode || l.workMode === 'GERAL'
      );
      setLots(separatorLots);
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Estatisticas
  const lotsInProgress = lots.filter((l) => l.status === 'IN_PROGRESS').length;
  const lotsReadyForScan = lots.filter((l) => l.status === 'READY_FOR_SCAN').length;
  const lotsDone = lots.filter((l) => l.status === 'DONE').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/funcoes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-500" />
            Funcao Separador
          </h1>
          <p className="text-sm text-muted-foreground">
            Separe os itens dos lotes e deixe prontos para bipagem
          </p>
        </div>
        <Button onClick={() => setShowImport(true)} className="bg-blue-500 hover:bg-blue-600">
          <Plus className="mr-2 h-4 w-4" />
          Importar Lote
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{lots.length}</div>
            <p className="text-xs text-muted-foreground">Total de Lotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{lotsInProgress}</div>
            <p className="text-xs text-muted-foreground">Separando</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{lotsReadyForScan}</div>
            <p className="text-xs text-muted-foreground">Aguardando Bipagem</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{lotsDone}</div>
            <p className="text-xs text-muted-foreground">Concluidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lots List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Meus Lotes (Separador)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : lots.length === 0 ? (
            <div className="py-12 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum lote encontrado</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowImport(true)}
              >
                Importar Primeiro Lote
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  onClick={() => router.push(`/separador/${lot.id}`)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <Package className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{lot.lotCode}</span>
                      <Badge className={cn('gap-1', getStatusColor(lot.status))}>
                        {getStatusIcon(lot.status)}
                        {LOT_STATUS_LABELS[lot.status]}
                      </Badge>
                      {lot.workMode === 'SEPARADOR' && (
                        <Badge variant="outline" className="text-blue-500 border-blue-500/30">
                          Separador
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lot.totals?.orders || 0} pedidos &middot; {lot.totals?.items || 0} itens
                      {lot.cycle && ` &middot; Ciclo ${lot.cycle}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      {lot.createdAt ? formatDateTimeBR(lot.createdAt.toDate()) : '-'}
                    </p>
                    {lot.durationMs && lot.durationMs > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Separacao: {formatDuration(lot.durationMs)}
                      </p>
                    )}
                    {lot.separatorXpEarned && lot.separatorXpEarned > 0 && (
                      <Badge variant="outline" className="mt-1 text-amber-500">
                        +{lot.separatorXpEarned} XP
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImportLotDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => {
          setShowImport(false);
          loadData();
        }}
        workMode="SEPARADOR"
      />
    </div>
  );
}
