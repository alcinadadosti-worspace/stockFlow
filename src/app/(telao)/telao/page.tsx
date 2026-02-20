'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { getAllUsers } from '@/services/firestore/users';
import { getAllTaskLogs } from '@/services/firestore/taskLogs';
import { getAllLots } from '@/services/firestore/lots';
import type { AppUser, TaskLog, Lot } from '@/types';
import { calculateLevel } from '@/lib/utils';
import {
  Zap,
  Package,
  Boxes,
  Trophy,
  Medal,
  RefreshCw,
  Crown,
} from 'lucide-react';

const REFRESH_INTERVAL = 30000; // 30 seconds

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

interface TodayStats {
  xpTotal: number;
  lotsCompleted: number;
  itemsSeparated: number;
}

interface TopUser {
  uid: string;
  name: string;
  xp: number;
  level: number;
  lots: number;
  orders: number;
  items: number;
}

export default function TelaoPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [fetchedUsers, fetchedTaskLogs, fetchedLots] = await Promise.all([
        getAllUsers(),
        getAllTaskLogs(),
        getAllLots(),
      ]);
      setUsers(fetchedUsers);
      setTaskLogs(fetchedTaskLogs);
      setLots(fetchedLots);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load telao data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  const { start, end } = useMemo(() => getTodayRange(), []);

  const todayTaskLogs = useMemo(
    () => taskLogs.filter((t) => {
      const d = t.occurredAt.toDate();
      return d >= start && d <= end;
    }),
    [taskLogs, start, end],
  );

  const todayLots = useMemo(
    () => lots.filter((l) => {
      if (l.status !== 'DONE') return false;
      const d = l.endAt?.toDate() || l.createdAt.toDate();
      return d >= start && d <= end;
    }),
    [lots, start, end],
  );

  const todayStats: TodayStats = useMemo(() => {
    const xpTasks = todayTaskLogs.reduce((sum, t) => sum + t.xp, 0);
    const xpPicking = todayLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
    const itemsSeparated = todayLots.reduce((sum, l) => sum + (l.totals?.items || 0), 0);

    return {
      xpTotal: xpTasks + xpPicking,
      lotsCompleted: todayLots.length,
      itemsSeparated,
    };
  }, [todayTaskLogs, todayLots]);

  const topUsers: TopUser[] = useMemo(() => {
    const estoquistas = users.filter((u) => u.role === 'ESTOQUISTA');

    return estoquistas.map((u) => {
      const userTaskLogs = todayTaskLogs.filter((l) => l.uid === u.uid);
      const userLots = todayLots.filter((l) => l.createdByUid === u.uid);
      const xpTasks = userTaskLogs.reduce((sum, l) => sum + l.xp, 0);
      const xpPicking = userLots.reduce((sum, l) => sum + (l.xpEarned || 0), 0);
      const totalXp = xpTasks + xpPicking;
      const totalOrders = userLots.reduce((sum, l) => sum + (l.totals?.orders || 0), 0);
      const totalItems = userLots.reduce((sum, l) => sum + (l.totals?.items || 0), 0);

      return {
        uid: u.uid,
        name: u.name,
        xp: totalXp,
        level: calculateLevel(u.xpTotal || 0),
        lots: userLots.length,
        orders: totalOrders,
        items: totalItems,
      };
    })
    .filter((u) => u.xp > 0)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5);
  }, [users, todayTaskLogs, todayLots]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-xl text-slate-300">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const currentTime = lastUpdate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const currentDate = lastUpdate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen p-8 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Produtividade do Dia
          </h1>
          <p className="text-xl text-slate-400 capitalize mt-1">{currentDate}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-5xl font-bold text-white tabular-nums">{currentTime}</p>
            <p className="text-sm text-slate-400 flex items-center justify-end gap-1 mt-1">
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualiza a cada 30s
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-8">
        {/* Left Column - Metrics */}
        <div className="col-span-2 grid grid-rows-3 gap-6">
          {/* XP Total */}
          <MetricCard
            icon={Zap}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/20"
            label="XP Total do Dia"
            value={todayStats.xpTotal.toLocaleString('pt-BR')}
            suffix="XP"
          />

          {/* Lotes Concluidos */}
          <MetricCard
            icon={Package}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/20"
            label="Lotes Concluidos"
            value={todayStats.lotsCompleted.toString()}
            suffix="lotes"
          />

          {/* Itens Separados */}
          <MetricCard
            icon={Boxes}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/20"
            label="Itens Separados"
            value={todayStats.itemsSeparated.toLocaleString('pt-BR')}
            suffix="itens"
          />
        </div>

        {/* Right Column - Top 5 */}
        <div className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-yellow-500/20">
              <Trophy className="h-8 w-8 text-yellow-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Top 5 do Dia</h2>
          </div>

          {topUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(100%-80px)] text-slate-400">
              <Medal className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-xl">Nenhuma atividade ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {topUsers.map((user, index) => (
                <RankingItem
                  key={user.uid}
                  position={index + 1}
                  name={user.name}
                  xp={user.xp}
                  level={user.level}
                  lots={user.lots}
                  orders={user.orders}
                  items={user.items}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-slate-500 text-sm">
          StockFlow - Sistema de Produtividade
        </p>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  suffix: string;
}

function MetricCard({ icon: Icon, iconColor, iconBg, label, value, suffix }: MetricCardProps) {
  return (
    <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50 flex items-center gap-8">
      <div className={`p-6 rounded-2xl ${iconBg}`}>
        <Icon className={`h-16 w-16 ${iconColor}`} />
      </div>
      <div className="flex-1">
        <p className="text-xl text-slate-400 mb-2">{label}</p>
        <div className="flex items-baseline gap-3">
          <span className="text-6xl font-bold text-white tabular-nums">{value}</span>
          <span className="text-2xl text-slate-400">{suffix}</span>
        </div>
      </div>
    </div>
  );
}

interface RankingItemProps {
  position: number;
  name: string;
  xp: number;
  level: number;
  lots: number;
  orders: number;
  items: number;
}

function RankingItem({ position, name, xp, level, lots, orders, items }: RankingItemProps) {
  const positionStyles: Record<number, { bg: string; text: string; icon?: React.ElementType }> = {
    1: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Crown },
    2: { bg: 'bg-slate-400/20', text: 'text-slate-300' },
    3: { bg: 'bg-orange-600/20', text: 'text-orange-400' },
    4: { bg: 'bg-slate-700/50', text: 'text-slate-400' },
    5: { bg: 'bg-slate-700/50', text: 'text-slate-400' },
  };

  const style = positionStyles[position] || positionStyles[5];
  const Icon = style.icon;

  return (
    <div className={`flex items-center gap-4 p-5 rounded-xl ${style.bg} transition-all`}>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-3xl ${style.text}`}>
        {Icon ? <Icon className="h-8 w-8" /> : position}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xl font-semibold text-white truncate">{name}</p>
        <div className="flex items-center gap-4 text-base text-slate-300 mt-2 font-medium">
          <span className="flex items-center gap-1">
            <Package className="h-4 w-4 text-blue-400" />
            {lots} lotes
          </span>
          <span className="text-slate-600">|</span>
          <span>{orders} pedidos</span>
          <span className="text-slate-600">|</span>
          <span>{items} itens</span>
        </div>
      </div>
      <div className="text-right">
        <p className={`text-3xl font-bold ${style.text}`}>{xp.toLocaleString('pt-BR')}</p>
        <p className="text-sm text-slate-400">XP</p>
      </div>
    </div>
  );
}
