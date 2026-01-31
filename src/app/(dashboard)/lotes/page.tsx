'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getAllLots, getLotsByUser } from '@/services/firestore/lots';
import type { Lot } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Package, Plus, Clock, CheckCircle2, Loader2, FileEdit } from 'lucide-react';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { LOT_STATUS_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ImportLotDialog } from '@/components/lotes/import-lot-dialog';

function getStatusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'CLOSING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DONE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return '';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'DRAFT': return <FileEdit className="h-3 w-3" />;
    case 'IN_PROGRESS': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'CLOSING': return <Clock className="h-3 w-3" />;
    case 'DONE': return <CheckCircle2 className="h-3 w-3" />;
    default: return null;
  }
}

export default function LotesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = isAdmin ? await getAllLots() : await getLotsByUser(user.uid);
      setLots(data);
    } catch (err) {
      console.error('Erro ao carregar lotes:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lotes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os lotes de separação de pedidos
          </p>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowImport(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Importar Lote
          </Button>
        )}
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
            <div className="text-2xl font-bold text-blue-500">
              {lots.filter((l) => l.status === 'IN_PROGRESS' || l.status === 'CLOSING').length}
            </div>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">
              {lots.filter((l) => l.status === 'DONE').length}
            </div>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {lots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total de Pedidos</p>
          </CardContent>
        </Card>
      </div>

      {/* Lots List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista de Lotes
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
              {!isAdmin && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowImport(true)}
                >
                  Importar Primeiro Lote
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {lots.map((lot) => (
                <div
                  key={lot.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  onClick={() => router.push(`/lotes/${lot.id}`)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Package className="h-5 w-5 text-muted-foreground" />
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
                      {lot.cycle && ` &middot; Ciclo ${lot.cycle}`}
                      {isAdmin && lot.createdByName && ` · por ${lot.createdByName}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      {lot.createdAt ? formatDateTimeBR(lot.createdAt.toDate()) : '-'}
                    </p>
                    {lot.durationMs && lot.durationMs > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Duração: {formatDuration(lot.durationMs)}
                      </p>
                    )}
                    {lot.xpEarned && lot.xpEarned > 0 && (
                      <Badge variant="outline" className="mt-1 text-amber-500">
                        +{lot.xpEarned} XP
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
      />
    </div>
  );
}
