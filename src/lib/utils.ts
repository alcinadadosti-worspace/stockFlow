import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = 'America/Maceio';

export function formatDateBR(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatInTimeZone(d, TZ, 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateTimeBR(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return formatInTimeZone(d, TZ, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

export function xpForLevel(level: number): number {
  return (level - 1) * (level - 1) * 100;
}

export function xpProgress(xp: number): { level: number; current: number; needed: number; percent: number } {
  const level = calculateLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const current = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  return { level, current, needed, percent: Math.min((current / needed) * 100, 100) };
}
