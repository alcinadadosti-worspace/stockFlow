import { describe, it, expect } from 'vitest';
import { calculateLotXp, calculateTaskXp } from '@/lib/xp';
import type { PickingRules, LotTotals } from '@/types';

const defaultRules: PickingRules = {
  xpBasePerLot: 50,
  xpPerOrder: 10,
  xpPerItem: 2,
  speedTargetItemsPerMin: 5,
  bonus10Threshold: 1.0,
  bonus20Threshold: 1.2,
};

describe('calculateLotXp', () => {
  it('calcula XP base corretamente sem bônus', () => {
    const totals: LotTotals = { orders: 5, items: 50 };
    const durationMs = 30 * 60 * 1000; // 30 min => 50/30 = 1.67 itens/min (abaixo da meta de 5)

    const result = calculateLotXp(totals, durationMs, defaultRules);

    expect(result.base).toBe(50);
    expect(result.orderXp).toBe(50); // 5 * 10
    expect(result.itemXp).toBe(100); // 50 * 2
    expect(result.bonus).toBe(0);
    expect(result.bonusPercent).toBe(0);
    expect(result.total).toBe(200); // 50 + 50 + 100
    expect(result.speedMet).toBe(false);
  });

  it('aplica bônus de 10% quando velocidade atinge a meta', () => {
    const totals: LotTotals = { orders: 10, items: 100 };
    const durationMs = 20 * 60 * 1000; // 20 min => 100/20 = 5 itens/min (= meta)

    const result = calculateLotXp(totals, durationMs, defaultRules);

    expect(result.speed).toBe(5);
    expect(result.bonusPercent).toBe(10);
    expect(result.speedMet).toBe(true);
    // base=50, orders=100, items=200, subtotal=350, bonus=35
    expect(result.total).toBe(385);
  });

  it('aplica bônus de 20% quando velocidade >= meta * 1.2', () => {
    const totals: LotTotals = { orders: 10, items: 120 };
    const durationMs = 20 * 60 * 1000; // 20 min => 120/20 = 6 itens/min (= 5*1.2)

    const result = calculateLotXp(totals, durationMs, defaultRules);

    expect(result.speed).toBe(6);
    expect(result.bonusPercent).toBe(20);
    // base=50, orders=100, items=240, subtotal=390, bonus=78
    expect(result.total).toBe(468);
  });

  it('retorna 0 XP se duração for 0', () => {
    const totals: LotTotals = { orders: 1, items: 10 };
    const result = calculateLotXp(totals, 0, defaultRules);

    expect(result.base).toBe(50);
    expect(result.total).toBe(50 + 10 + 20); // sem bônus
    expect(result.speed).toBe(0);
  });
});

describe('calculateTaskXp', () => {
  it('calcula XP de tarefa corretamente', () => {
    expect(calculateTaskXp(100, 1)).toBe(100);
    expect(calculateTaskXp(100, 3)).toBe(300);
    expect(calculateTaskXp(50, 2)).toBe(100);
  });
});
