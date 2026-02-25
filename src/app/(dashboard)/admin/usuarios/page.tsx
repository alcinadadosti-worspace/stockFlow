'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getAllUsers, updateUserRole, deleteUser, createUser } from '@/services/firestore/users';
import { useOperator } from '@/hooks/useOperator';
import { useAuth } from '@/hooks/useAuth';
import type { AppUser, UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Users, Shield, User, Zap, Trash2, Loader2, Plus, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { calculateLevel, formatDateBR } from '@/lib/utils';

const createUserSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email invalido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['ADMIN', 'ESTOQUISTA']),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export default function AdminUsuariosPage() {
  const router = useRouter();
  const { isAdminMode } = useOperator();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ESTOQUISTA',
    },
  });

  // Proteger pagina - SEMPRE requer PIN admin
  useEffect(() => {
    if (!isAdminMode) {
      router.push('/funcoes');
    }
  }, [isAdminMode, router]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    try {
      await updateUserRole(uid, role);
      toast.success('Papel atualizado');
      await loadData();
    } catch (err) {
      toast.error('Erro ao atualizar papel');
    }
  }

  async function handleDelete(uid: string, name: string) {
    if (!confirm(`Tem certeza que deseja excluir ${name}? Esta acao remove apenas do Firestore.`)) {
      return;
    }

    setDeleting(uid);
    try {
      await deleteUser(uid);
      toast.success(`Usuario ${name} excluido`);
      await loadData();
    } catch (err) {
      toast.error('Erro ao excluir usuario');
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreateUser(data: CreateUserForm) {
    if (!currentUser) return;

    setCreating(true);
    try {
      const auth = getAuth();
      const currentEmail = currentUser.email;

      // Criar usuario no Firebase Auth
      const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);

      // Criar registro no Firestore
      await createUser(credential.user.uid, {
        name: data.name,
        email: data.email,
        role: data.role,
      });

      // Mostrar credenciais criadas
      setCreatedCredentials({ email: data.email, password: data.password });
      toast.success('Usuario criado com sucesso!');

      // Recarregar lista
      await loadData();

      // Limpar formulario
      form.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao criar usuario';
      if (message.includes('email-already-in-use')) {
        toast.error('Este email ja esta em uso');
      } else {
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  }

  function handleCopyCredentials() {
    if (!createdCredentials) return;
    const text = `Email: ${createdCredentials.email}\nSenha: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credenciais copiadas!');
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCloseDialog() {
    setShowCreate(false);
    setCreatedCredentials(null);
    form.reset();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os usuarios e seus papeis
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuario
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Total de Usuários</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">
              {users.filter((u) => u.role === 'ADMIN').length}
            </div>
            <p className="text-xs text-muted-foreground">Administradores</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-500">
              {users.filter((u) => u.role === 'ESTOQUISTA').length}
            </div>
            <p className="text-xs text-muted-foreground">Estoquistas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      {u.role === 'ADMIN' ? (
                        <Shield className="h-4 w-4 text-blue-500" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.email} &middot; Nível {calculateLevel(u.xpTotal || 0)}
                      {u.createdAt && ` &middot; Desde ${formatDateBR(u.createdAt.toDate())}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-500">
                    <Zap className="mr-1 h-3 w-3" />
                    {(u.xpTotal || 0).toLocaleString('pt-BR')} XP
                  </Badge>
                  <Select
                    value={u.role}
                    onValueChange={(v) => handleRoleChange(u.uid, v as UserRole)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                      <SelectItem value="ESTOQUISTA">Estoquista</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(u.uid, u.name)}
                    disabled={deleting === u.uid || u.role === 'ADMIN'}
                    title={u.role === 'ADMIN' ? 'Nao pode excluir admin' : 'Excluir usuario'}
                  >
                    {deleting === u.uid ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuario</DialogTitle>
            <DialogDescription>
              {createdCredentials
                ? 'Usuario criado! Compartilhe as credenciais abaixo.'
                : 'Preencha os dados para criar um novo usuario'}
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <p className="font-mono text-sm">{createdCredentials.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Senha</Label>
                  <p className="font-mono text-sm">{createdCredentials.password}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyCredentials}
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button className="flex-1" onClick={handleCloseDialog}>
                  Fechar
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Nome completo" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="email@exemplo.com" {...form.register('email')} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" placeholder="Minimo 6 caracteres" {...form.register('password')} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Papel</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(v) => form.setValue('role', v as 'ADMIN' | 'ESTOQUISTA')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ESTOQUISTA">Estoquista</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuario'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
