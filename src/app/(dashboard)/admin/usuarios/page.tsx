'use client';

import { useEffect, useState } from 'react';
import { getAllUsers, updateUserRole } from '@/services/firestore/users';
import type { AppUser, UserRole } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Shield, User, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { calculateLevel, formatDateBR } from '@/lib/utils';

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie os usuários e seus papéis
        </p>
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
