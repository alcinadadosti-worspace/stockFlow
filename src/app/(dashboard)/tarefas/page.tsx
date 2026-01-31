'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { taskLogSchema, taskTypeSchema, type TaskLogForm, type TaskTypeForm } from '@/lib/schemas';
import { useAuth } from '@/hooks/useAuth';
import { getActiveTaskTypes, getAllTaskTypes, createTaskType, updateTaskType, deleteTaskType } from '@/services/firestore/taskTypes';
import { createTaskLog, getTaskLogsByUser, getAllTaskLogs } from '@/services/firestore/taskLogs';
import { calculateTaskXp } from '@/lib/xp';
import type { TaskType, TaskLog } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { ClipboardList, Plus, Zap, Clock, Settings, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTimeBR } from '@/lib/utils';

export default function TarefasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  if (isAdmin) {
    return <AdminTarefas />;
  }

  return <EstoquistaTarefas />;
}

// ─── ADMIN VERSION ─────────────────────────────────────────────────────────────

function AdminTarefas() {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
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
      const [types, allLogs] = await Promise.all([
        getAllTaskTypes(),
        getAllTaskLogs(),
      ]);
      setTasks(types);
      setLogs(allLogs);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
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
    } catch {
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
    } catch {
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
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os tipos de tarefas e veja o histórico de todos os usuários
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* Task Types CRUD */}
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

      {/* All Users History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Todos os Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma tarefa registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{log.taskTypeName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {log.userName || 'Usuário'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.occurredAt ? formatDateTimeBR(log.occurredAt.toDate()) : '-'}
                      {log.quantity > 1 && ` · Qtd: ${log.quantity}`}
                      {log.note && ` · ${log.note}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-500">
                    +{log.xp} XP
                  </Badge>
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

// ─── ESTOQUISTA VERSION ────────────────────────────────────────────────────────

function EstoquistaTarefas() {
  const { user } = useAuth();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TaskLogForm>({
    resolver: zodResolver(taskLogSchema),
    defaultValues: { taskTypeId: '', quantity: 1, note: '' },
  });

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [types, userLogs] = await Promise.all([
        getActiveTaskTypes(),
        getTaskLogsByUser(user.uid),
      ]);
      setTaskTypes(types);
      setLogs(userLogs);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: TaskLogForm) {
    if (!user) return;
    setSubmitting(true);
    try {
      const taskType = taskTypes.find((t) => t.id === data.taskTypeId);
      if (!taskType) {
        toast.error('Tarefa não encontrada');
        return;
      }

      const xp = calculateTaskXp(taskType.xp, data.quantity);
      await createTaskLog({
        uid: user.uid,
        userName: user.name,
        taskTypeId: data.taskTypeId,
        taskTypeName: taskType.name,
        xp,
        quantity: data.quantity,
        note: data.note || '',
      });

      toast.success(`+${xp} XP!`, {
        description: `${taskType.name} registrada com sucesso.`,
      });

      form.reset();
      await loadData();
    } catch (err) {
      toast.error('Erro ao registrar tarefa');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTask = taskTypes.find((t) => t.id === form.watch('taskTypeId'));
  const quantity = form.watch('quantity') || 1;
  const previewXp = selectedTask ? calculateTaskXp(selectedTask.xp, quantity) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
        <p className="text-sm text-muted-foreground">
          Registre as tarefas executadas para ganhar XP
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Register Task */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Registrar Tarefa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : taskTypes.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhuma tarefa cadastrada. Peça ao administrador para criar tarefas.
              </p>
            ) : (
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tarefa</Label>
                  <Select
                    value={form.watch('taskTypeId')}
                    onValueChange={(v) => form.setValue('taskTypeId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a tarefa" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} ({t.xp} XP)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.taskTypeId && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.taskTypeId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min={1}
                    {...form.register('quantity')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observação (opcional)</Label>
                  <Input
                    placeholder="Ex.: Setor A"
                    {...form.register('note')}
                  />
                </div>

                {previewXp > 0 && (
                  <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                    <Zap className="mx-auto mb-1 h-5 w-5 text-amber-500" />
                    <p className="text-lg font-bold text-amber-500">+{previewXp} XP</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Registrando...' : 'Registrar Tarefa'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Task Catalog */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Catálogo de Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {taskTypes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="secondary">
                      <Zap className="mr-1 h-3 w-3 text-amber-500" />
                      {t.xp} XP
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nenhuma tarefa registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{log.taskTypeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.occurredAt ? formatDateTimeBR(log.occurredAt.toDate()) : '-'}
                      {log.note && ` • ${log.note}`}
                      {log.quantity > 1 && ` • Qtd: ${log.quantity}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-500">
                    +{log.xp} XP
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
