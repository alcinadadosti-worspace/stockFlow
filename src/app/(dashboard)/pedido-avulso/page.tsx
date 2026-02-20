'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getSingleOrdersByUser, createSingleOrder } from '@/services/firestore/singleOrders';
import type { SingleOrder } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  Package,
  ScanLine,
  ArrowLeft,
  Hourglass,
} from 'lucide-react';
import { formatDateTimeBR, formatDuration } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SEPARATING: 'Separando',
  READY_TO_SCAN: 'Pronto p/ Bipar',
  SCANNING: 'Bipando',
  DONE: 'Concluido',
};

function getStatusColor(status: string) {
  switch (status) {
    case 'DRAFT': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    case 'SEPARATING': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'READY_TO_SCAN': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'SCANNING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'DONE': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    default: return '';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'DRAFT': return <Package className="h-3 w-3" />;
    case 'SEPARATING': return <Loader2 className="h-3 w-3 animate-spin" />;
    case 'READY_TO_SCAN': return <Hourglass className="h-3 w-3" />;
    case 'SCANNING': return <ScanLine className="h-3 w-3" />;
    case 'DONE': return <CheckCircle2 className="h-3 w-3" />;
    default: return null;
  }
}

export default function PedidoAvulsoPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<SingleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [orderCode, setOrderCode] = useState('');
  const [items, setItems] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getSingleOrdersByUser(user.uid);
      setOrders(data);
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate() {
    if (!user) return;
    if (!orderCode.trim() || !items.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    const itemsNum = parseInt(items, 10);
    if (isNaN(itemsNum) || itemsNum < 1) {
      toast.error('Quantidade de itens invalida');
      return;
    }

    setCreating(true);
    try {
      const id = await createSingleOrder(orderCode.trim(), itemsNum, user.uid, user.name);
      toast.success('Pedido criado!');
      setShowCreate(false);
      setOrderCode('');
      setItems('');
      router.push(`/pedido-avulso/${id}`);
    } catch (err) {
      toast.error('Erro ao criar pedido');
    } finally {
      setCreating(false);
    }
  }

  // Estatisticas
  const inProgress = orders.filter((o) => o.status !== 'DONE' && o.status !== 'DRAFT').length;
  const done = orders.filter((o) => o.status === 'DONE').length;
  const totalXp = orders.reduce((sum, o) => sum + (o.xpEarned || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/funcoes')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-green-500" />
            Pedido Avulso
          </h1>
          <p className="text-sm text-muted-foreground">
            Processe pedidos individuais com separacao, bipagem e lacracao
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-green-500 hover:bg-green-600">
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">Total de Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{inProgress}</div>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{done}</div>
            <p className="text-xs text-muted-foreground">Concluidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">{totalXp}</div>
            <p className="text-xs text-muted-foreground">XP Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Meus Pedidos Avulsos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center">
              <ClipboardList className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum pedido avulso encontrado</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreate(true)}
              >
                Criar Primeiro Pedido
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  onClick={() => router.push(`/pedido-avulso/${order.id}`)}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <ClipboardList className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{order.orderCode}</span>
                      <Badge className={cn('gap-1', getStatusColor(order.status))}>
                        {getStatusIcon(order.status)}
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.items} itens
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      {order.createdAt ? formatDateTimeBR(order.createdAt.toDate()) : '-'}
                    </p>
                    {order.totalDurationMs && order.totalDurationMs > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Tempo: {formatDuration(order.totalDurationMs)}
                      </p>
                    )}
                    {order.xpEarned && order.xpEarned > 0 && (
                      <Badge variant="outline" className="mt-1 text-amber-500">
                        +{order.xpEarned} XP
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Pedido Avulso</DialogTitle>
            <DialogDescription>
              Cadastre um pedido individual para separacao
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Codigo do Pedido</Label>
              <Input
                placeholder="Ex: 123456789"
                value={orderCode}
                onChange={(e) => setOrderCode(e.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade de Itens</Label>
              <Input
                type="number"
                placeholder="Ex: 5"
                min={1}
                value={items}
                onChange={(e) => setItems(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-500 hover:bg-green-600"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Criando...' : 'Criar Pedido'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
