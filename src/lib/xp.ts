import type { PickingRules, LotTotals } from '@/types';
import { DEFAULT_PICKING_RULES } from './constants';

export interface LotXpResult {
  base: number;
  orderXp: number;
  itemXp: number;
  bonus: number;
  bonusPercent: number;
  total: number;
  speed: number;
  speedMet: boolean;
}

export function calculateLotXp(
  totals: LotTotals,
  durationMs: number,
  rules: PickingRules = DEFAULT_PICKING_RULES,
): LotXpResult {
  const { xpBasePerLot, xpPerOrder, xpPerItem, speedTargetItemsPerMin, bonus10Threshold, bonus20Threshold } = rules;

  const base = xpBasePerLot;
  const orderXp = xpPerOrder * totals.orders;
  const itemXp = xpPerItem * totals.items;
  const subtotal = base + orderXp + itemXp;

  const durationMin = durationMs / 60000;
  const speed = durationMin > 0 ? totals.items / durationMin : 0;
  const speedTarget = speedTargetItemsPerMin;

  let bonusPercent = 0;
  let speedMet = false;

  if (speedTarget > 0 && speed >= speedTarget * bonus20Threshold) {
    bonusPercent = 20;
    speedMet = true;
  } else if (speedTarget > 0 && speed >= speedTarget * bonus10Threshold) {
    bonusPercent = 10;
    speedMet = true;
  }

  const bonus = Math.round(subtotal * (bonusPercent / 100));
  const total = subtotal + bonus;

  return { base, orderXp, itemXp, bonus, bonusPercent, total, speed: Math.round(speed * 100) / 100, speedMet };
}

export function calculateTaskXp(taskXp: number, quantity: number): number {
  return taskXp * quantity;
}
