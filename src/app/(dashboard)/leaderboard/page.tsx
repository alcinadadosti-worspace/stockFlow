'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, TrendingUp, Zap } from 'lucide-react';
import { getAllUsers } from '@/services/firestore/users';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import { useAuth } from '@/hooks/useAuth';
import { calculateLevel } from '@/lib/utils';
import type { AppUser, TaskLog, Lot, LeaderboardEntry } from '@/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('current-month');

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const [users, taskLogs, lots] = await Promise.all([
        getAllUsers(),
        getAllTaskLogs(),
        getAllLots(),
      ]);

      const now = new Date();
      let startDate: Date;
      let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      if (period === 'current-month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'last-month') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      } else {
        startDate = new Date(now.getFullYear(), 0, 1);
      }

      const startMs = startDate.getTime();
      const endMs = endDate.getTime();

      const filteredLogs = taskLogs.filter((l) => {
        const ts = l.occurredAt?.toMillis?.() || 0;
        return ts >= startMs && ts <= endMs;
      });

      const filteredLots = lots.filter((l) => {
        const ts = l.createdAt?.toMillis?.() || 0;
        return ts >= startMs && ts <= endMs && l.status === 'DONE';
      });

      const leaderboard: LeaderboardEntry[] = users.map((u) => {
        const userLogs = filteredLogs.filter((l) => l.uid === u.uid);
        const userLots = filteredLots.filter((l) => l.createdByUid === u.uid);
        const xpTasks = userLogs.reduce((sum, l) => sum + (l.xp || 0), 0);
        const xpPicking = userLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
        const xpTotal = xpTasks + xpPicking;
        const ordersSealed = userLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);

        return {
          uid: u.uid,
          name: u.name,
          xpTotal,
          xpTasks,
          xpPicking,
          lotsCompleted: userLots.length,
          ordersSealed,
          tasksCompleted: userLogs.length,
          level: calculateLevel(u.xpTotal || 0),
        };
      });

      leaderboard.sort((a, b) => b.xpTotal - a.xpTotal);
      setEntries(leaderboard);
    } catch (err) {
      console.error('Erro ao carregar leaderboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function getRankIcon(index: number) {
    if (index === 0) return <Trophy className="h-5 w-5 text-amber-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-700" />;
    return <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ranking</h1>
          <p className="text-sm text-muted-foreground">
            Classificação dos estoquistas por XP
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current-month">Mês Atual</SelectItem>
            <SelectItem value="last-month">Mês Anterior</SelectItem>
            <SelectItem value="year">Ano Inteiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top 3 Podium */}
      {!loading && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[1, 0, 2].map((idx) => {
            const entry = entries[idx];
            if (!entry) return null;
            const isFirst = idx === 0;
            return (
              <Card
                key={entry.uid}
                className={cn(
                  'text-center transition-all',
                  isFirst && 'border-amber-500/50 shadow-lg shadow-amber-500/10',
                  idx === 0 && 'row-start-1 col-start-2',
                  idx === 1 && 'row-start-1 col-start-1 mt-6',
                  idx === 2 && 'row-start-1 col-start-3 mt-6',
                )}
              >
                <CardContent className="pt-6">
                  <div className="mb-2 flex justify-center">
                    {getRankIcon(idx)}
                  </div>
                  <div className={cn(
                    'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold',
                    isFirst ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground',
                  )}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="font-semibold">{entry.name}</h3>
                  <p className="text-xs text-muted-foreground">Nível {entry.level}</p>
                  <p className="mt-2 text-xl font-bold text-amber-500">
                    {entry.xpTotal.toLocaleString('pt-BR')} XP
                  </p>
                  <div className="mt-2 flex justify-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {entry.lotsCompleted} lotes
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {entry.tasksCompleted} tarefas
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Classificação Completa
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado encontrado para o período selecionado.
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, index) => (
                <div
                  key={entry.uid}
                  className={cn(
                    'flex items-center gap-4 rounded-lg border p-3 transition-colors',
                    entry.uid === user?.uid && 'border-primary/50 bg-primary/5',
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center">
                    {getRankIcon(index)}
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entry.name}</span>
                      {entry.uid === user?.uid && (
                        <Badge variant="outline" className="text-xs">Você</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nível {entry.level} &middot; {entry.lotsCompleted} lotes &middot; {entry.tasksCompleted} tarefas
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-500">
                      <Zap className="mr-1 inline h-3 w-3" />
                      {entry.xpTotal.toLocaleString('pt-BR')} XP
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tarefas: {entry.xpTasks} | Picking: {entry.xpPicking}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
