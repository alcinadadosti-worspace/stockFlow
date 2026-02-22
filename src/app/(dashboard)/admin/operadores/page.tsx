'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  getAllOperators,
  createOperator,
  updateOperator,
  deleteOperator,
  seedDefaultOperators,
} from '@/services/firestore/operators';
import { useOperator } from '@/hooks/useOperator';
import type { Operator } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { calculateLevel } from '@/lib/utils';

const operatorSchema = z.object({
  code: z.string().regex(/^\d{2}$/, 'Codigo deve ter 2 digitos'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
});

type OperatorForm = z.infer<typeof operatorSchema>;

export default function AdminOperadoresPage() {
  const router = useRouter();
  const { operator, isAdminMode } = useOperator();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [deletingOperator, setDeletingOperator] = useState<Operator | null>(null);
  const [saving, setSaving] = useState(false);

  // Proteger pagina - SEMPRE requer PIN admin
  useEffect(() => {
    if (!isAdminMode) {
      router.push('/funcoes');
    }
  }, [isAdminMode, router]);

  const form = useForm<OperatorForm>({
    resolver: zodResolver(operatorSchema),
    defaultValues: { code: '', name: '' },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Seed operadores padrão se não existirem
      const seedResult = await seedDefaultOperators();
      if (seedResult.created.length > 0) {
        toast.success(`Operadores criados: ${seedResult.created.join(', ')}`);
      }

      const data = await getAllOperators();
      setOperators(data);
    } catch (err) {
      console.error('Erro ao carregar operadores:', err);
      toast.error('Erro ao carregar operadores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openCreate() {
    setEditingOperator(null);
    form.reset({ code: '', name: '' });
    setDialogOpen(true);
  }

  function openEdit(op: Operator) {
    setEditingOperator(op);
    form.reset({ code: op.code, name: op.name });
    setDialogOpen(true);
  }

  async function handleSubmit(data: OperatorForm) {
    setSaving(true);
    try {
      if (editingOperator) {
        await updateOperator(editingOperator.code, { name: data.name });
        toast.success('Operador atualizado');
      } else {
        await createOperator(data.code, data.name);
        toast.success('Operador criado');
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(op: Operator) {
    try {
      await updateOperator(op.code, { active: !op.active });
      await loadData();
      toast.success(op.active ? 'Operador desativado' : 'Operador ativado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleDelete() {
    if (!deletingOperator) return;
    try {
      await deleteOperator(deletingOperator.code);
      toast.success('Operador excluido');
      setDeleteDialogOpen(false);
      await loadData();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  // Estatisticas
  const activeCount = operators.filter((o) => o.active).length;
  const totalXp = operators.reduce((sum, o) => sum + (o.xpTotal || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operadores</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os operadores que usam o sistema
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Operador
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{operators.length}</div>
            <p className="text-xs text-muted-foreground">Total de Operadores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-500">
              {totalXp.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">XP Total (todos)</p>
          </CardContent>
        </Card>
      </div>

      {/* Operators List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Operadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : operators.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum operador cadastrado</p>
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                Cadastrar Primeiro Operador
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {operators.map((op, index) => (
                <div
                  key={op.code}
                  className="flex items-center gap-4 rounded-lg border p-4 opacity-0 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
                    {op.code}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{op.name}</span>
                      {!op.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        {(op.xpTotal || 0).toLocaleString('pt-BR')} XP
                      </span>
                      <span>Nivel {calculateLevel(op.xpTotal || 0)}</span>
                      {op.streak > 0 && (
                        <span>{op.streak} dias seguidos</span>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={op.active}
                    onCheckedChange={() => handleToggleActive(op)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(op)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeletingOperator(op);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingOperator ? 'Editar Operador' : 'Novo Operador'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Codigo (2 digitos)</Label>
              <Input
                placeholder="01"
                maxLength={2}
                disabled={!!editingOperator}
                {...form.register('code')}
                className="font-mono text-center text-2xl"
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Nome do operador" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir operador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o operador {deletingOperator?.code} - {deletingOperator?.name}?
              Todo o XP e historico sera perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
