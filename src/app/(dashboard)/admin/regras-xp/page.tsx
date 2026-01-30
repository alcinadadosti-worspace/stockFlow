'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pickingRulesSchema, type PickingRulesForm } from '@/lib/schemas';
import { getPickingRules, updatePickingRules } from '@/services/firestore/pickingRules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sliders, Save, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function RegrasXpPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<PickingRulesForm>({
    resolver: zodResolver(pickingRulesSchema),
  });

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const rules = await getPickingRules();
      form.reset(rules);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: PickingRulesForm) {
    setSaving(true);
    try {
      await updatePickingRules(data);
      toast.success('Regras de XP atualizadas');
    } catch (err) {
      toast.error('Erro ao salvar regras');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Regras de XP - Picking</h1>
        <p className="text-sm text-muted-foreground">
          Configure como o XP é calculado para lotes de separação
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* XP Base */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sliders className="h-5 w-5" />
                XP Base
              </CardTitle>
              <CardDescription>
                Valores base para cálculo de XP por lote
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>XP Base por Lote</Label>
                <Input type="number" min={0} {...form.register('xpBasePerLot')} />
                <p className="text-xs text-muted-foreground">
                  XP fixo ganho ao completar qualquer lote
                </p>
              </div>
              <div className="space-y-2">
                <Label>XP por Pedido</Label>
                <Input type="number" min={0} {...form.register('xpPerOrder')} />
                <p className="text-xs text-muted-foreground">
                  XP multiplicado pelo número de pedidos no lote
                </p>
              </div>
              <div className="space-y-2">
                <Label>XP por Item</Label>
                <Input type="number" min={0} {...form.register('xpPerItem')} />
                <p className="text-xs text-muted-foreground">
                  XP multiplicado pelo total de itens no lote
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bonus */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Bônus de Velocidade
              </CardTitle>
              <CardDescription>
                Bônus concedido quando a velocidade de separação atinge a meta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Meta de Itens por Minuto</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  {...form.register('speedTargetItemsPerMin')}
                />
                <p className="text-xs text-muted-foreground">
                  Velocidade alvo (itens separados por minuto)
                </p>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Limiar Bônus 10% (multiplicador)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  {...form.register('bonus10Threshold')}
                />
                <p className="text-xs text-muted-foreground">
                  Se velocidade &gt;= meta &times; este valor, ganha +10% XP
                </p>
              </div>
              <div className="space-y-2">
                <Label>Limiar Bônus 20% (multiplicador)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  {...form.register('bonus20Threshold')}
                />
                <p className="text-xs text-muted-foreground">
                  Se velocidade &gt;= meta &times; este valor, ganha +20% XP
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formula Preview */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="rounded-lg bg-muted p-4 font-mono text-sm">
              <p className="text-muted-foreground">Fórmula:</p>
              <p className="mt-1">
                XP = <span className="text-primary">{form.watch('xpBasePerLot') || 0}</span> +{' '}
                (<span className="text-blue-500">{form.watch('xpPerOrder') || 0}</span> &times; pedidos) +{' '}
                (<span className="text-emerald-500">{form.watch('xpPerItem') || 0}</span> &times; itens) +{' '}
                bônus velocidade
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="submit" disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Regras'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
