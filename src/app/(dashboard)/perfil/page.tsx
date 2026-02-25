'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOperator } from '@/hooks/useOperator';
import { useOperatorData } from '@/hooks/useOperatorData';
import { useSound } from '@/hooks/useSound';
import { updateOperator } from '@/services/firestore/operators';
import { AVATARS, getAvatarById, type Avatar } from '@/lib/avatars';
import { calculateLevel, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  User,
  Zap,
  Flame,
  Trophy,
  Calendar,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PerfilPage() {
  const router = useRouter();
  const { operator } = useOperator();
  const { operatorData, loading, refreshOperatorData } = useOperatorData();
  const { playSound } = useSound();

  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirecionar se nao tiver operador selecionado
  useEffect(() => {
    if (!operator && !loading) {
      router.push('/funcoes');
    }
  }, [operator, loading, router]);

  const currentAvatar = getAvatarById(operatorData?.avatar);
  const level = calculateLevel(operatorData?.xpTotal || 0);
  const xpForNextLevel = level * 1000;
  const currentLevelXp = (level - 1) * 1000;
  const xpProgress = operatorData?.xpTotal ? operatorData.xpTotal - currentLevelXp : 0;
  const xpProgressPercent = Math.min(100, (xpProgress / 1000) * 100);

  async function handleSaveAvatar() {
    if (!operator || !selectedAvatar) return;

    setSaving(true);
    try {
      await updateOperator(operator.code, { avatar: selectedAvatar } as any);
      playSound('success');
      toast.success('Avatar atualizado!');
      setShowAvatarDialog(false);
      refreshOperatorData();
    } catch (err) {
      playSound('error');
      toast.error('Erro ao salvar avatar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!operator || !operatorData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Personalize seu avatar e veja suas estatisticas
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card do Perfil */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              {/* Avatar grande clicavel */}
              <button
                onClick={() => {
                  setSelectedAvatar(operatorData.avatar || currentAvatar.id);
                  setShowAvatarDialog(true);
                }}
                className={cn(
                  'flex h-24 w-24 items-center justify-center rounded-full text-5xl transition-all hover:scale-105 hover:ring-4 hover:ring-primary/50',
                  currentAvatar.bgColor
                )}
                title="Clique para trocar avatar"
              >
                {currentAvatar.emoji}
              </button>
              <p className="mt-2 text-xs text-muted-foreground">
                Clique para trocar
              </p>

              <h2 className="mt-4 text-xl font-bold">{operator.name}</h2>
              <p className="text-muted-foreground">Operador {operator.code}</p>

              {/* Barra de XP */}
              <div className="mt-6 w-full">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Nivel {level}</span>
                  <span className="text-muted-foreground">
                    {xpProgress.toLocaleString('pt-BR')} / 1.000 XP
                  </span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                    style={{ width: `${xpProgressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatisticas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Estatisticas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">XP Total</p>
                  <p className="text-lg font-bold">
                    {(operatorData.xpTotal || 0).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                Lv. {level}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sequencia</p>
                  <p className="text-lg font-bold">
                    {operatorData.streak || 0} dias
                  </p>
                </div>
              </div>
              {operatorData.streak && operatorData.streak >= 7 && (
                <Badge className="bg-orange-500">🔥 Em chamas!</Badge>
              )}
            </div>

            {operatorData.lastActivityDate && (
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                  <Calendar className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ultima atividade</p>
                  <p className="font-medium">
                    {new Date(operatorData.lastActivityDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Todos os Avatares */}
      <Card>
        <CardHeader>
          <CardTitle>Avatares Disponiveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-4 sm:grid-cols-8 md:grid-cols-12">
            {AVATARS.map((av) => (
              <button
                key={av.id}
                onClick={() => {
                  setSelectedAvatar(av.id);
                  setShowAvatarDialog(true);
                }}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full text-2xl transition-all hover:scale-110',
                  av.bgColor,
                  operatorData.avatar === av.id && 'ring-2 ring-primary ring-offset-2'
                )}
                title={av.name}
              >
                {av.emoji}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de selecao de avatar */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Escolha seu Avatar</DialogTitle>
            <DialogDescription>
              Selecione um avatar para representar voce
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-6 gap-3 py-4">
            {AVATARS.map((av) => {
              const isSelected = selectedAvatar === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => setSelectedAvatar(av.id)}
                  className={cn(
                    'relative flex h-14 w-14 items-center justify-center rounded-full text-2xl transition-all hover:scale-105',
                    av.bgColor,
                    isSelected && 'ring-2 ring-primary ring-offset-2'
                  )}
                  title={av.name}
                >
                  {av.emoji}
                  {isSelected && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowAvatarDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveAvatar}
              disabled={saving || !selectedAvatar}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
