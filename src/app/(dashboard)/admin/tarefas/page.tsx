'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskTypeSchema, type TaskTypeForm } from '@/lib/schemas';
import {
  getAllTaskTypes,
  createTaskType,
  updateTaskType,
  deleteTaskType,
} from '@/services/firestore/taskTypes';
import type { TaskType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { Settings, Plus, Pencil, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTarefasPage() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskType | null>(null);
  const [deletingTask, setDeletingTask] = useState<TaskType | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<TaskTypeForm>({
    resolver: zodResolver(taskTypeSchema),
    defaultValues: { name: '', xp: 100 },
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getAllTaskTypes();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingTask(null);
    form.reset({ name: '', xp: 100 });
    setDialogOpen(true);
  }

  function openEdit(task: TaskType) {
    setEditingTask(task);
    form.reset({ name: task.name, xp: task.xp });
    setDialogOpen(true);
  }

  async function handleSubmit(data: TaskTypeForm) {
    setSaving(true);
    try {
      if (editingTask) {
        await updateTaskType(editingTask.id, { name: data.name, xp: data.xp });
        toast.success('Tarefa atualizada');
      } else {
        await createTaskType({ name: data.name, xp: data.xp });
        toast.success('Tarefa criada');
      }
      setDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error('Erro ao salvar tarefa');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(task: TaskType) {
    try {
      await updateTaskType(task.id, { active: !task.active });
      await loadData();
      toast.success(task.active ? 'Tarefa desativada' : 'Tarefa ativada');
    } catch (err) {
      toast.error('Erro ao atualizar');
    }
  }

  async function handleDelete() {
    if (!deletingTask) return;
    try {
      await deleteTaskType(deletingTask.id);
      toast.success('Tarefa excluída');
      setDeleteDialogOpen(false);
      await loadData();
    } catch (err) {
      toast.error('Erro ao excluir');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciar Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Configure os tipos de tarefas e seus valores de XP
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Tipos de Tarefas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma tarefa cadastrada
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.name}</span>
                      {!task.active && (
                        <Badge variant="secondary" className="text-xs">
                          Inativa
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      <Zap className="mr-1 h-3 w-3 text-amber-500" />
                      {task.xp} XP
                    </Badge>
                  </div>
                  <Switch
                    checked={task.active}
                    onCheckedChange={() => handleToggleActive(task)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(task)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeletingTask(task);
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
              {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Tarefa</Label>
              <Input placeholder="Ex.: Limpeza do estoque" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>XP por execução</Label>
              <Input type="number" min={1} {...form.register('xp')} />
              {form.formState.errors.xp && (
                <p className="text-xs text-destructive">{form.formState.errors.xp.message}</p>
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
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{deletingTask?.name}&quot;? Esta ação não pode ser desfeita.
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
