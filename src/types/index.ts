import { Timestamp } from 'firebase/firestore';

export type UserRole = 'ADMIN' | 'ESTOQUISTA';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Timestamp;
  xpTotal?: number;
  streak?: number;
  lastActivityDate?: string; // YYYY-MM-DD
}

export interface TaskType {
  id: string;
  name: string;
  xp: number;
  active: boolean;
  createdAt: Timestamp;
}

export interface TaskLog {
  id: string;
  uid: string;
  userName?: string;
  taskTypeId: string;
  taskTypeName?: string;
  xp: number;
  quantity: number;
  note: string;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

export interface PickingRules {
  xpBasePerLot: number;
  xpPerOrder: number;
  xpPerItem: number;
  speedTargetItemsPerMin: number;
  bonus10Threshold: number;
  bonus20Threshold: number;
  updatedAt?: Timestamp;
}

export type LotStatus = 'DRAFT' | 'IN_PROGRESS' | 'CLOSING' | 'DONE';
export type OrderStatus = 'PENDING' | 'SEALED';

export interface LotTotals {
  orders: number;
  items: number;
}

export interface Lot {
  id: string;
  lotCode: string;
  createdByUid: string;
  createdByName?: string;
  status: LotStatus;
  cycle: string;
  startAt?: Timestamp | null;
  endAt?: Timestamp | null;
  scanStartAt?: Timestamp | null;
  scanEndAt?: Timestamp | null;
  createdAt: Timestamp;
  totals: LotTotals;
  xpEarned?: number;
  durationMs?: number;
  scanDurationMs?: number;
  totalDurationMs?: number;
}

export interface LotOrder {
  id: string;
  orderCode: string;
  cycle: string;
  approvedAt: Timestamp | null;
  items: number;
  status: OrderStatus;
  sealedCode?: string;
  sealedAt?: Timestamp | null;
  createdAt: Timestamp;
}

export interface SealedCode {
  sealedCode: string;
  orderCode: string;
  lotId: string;
  createdAt: Timestamp;
}

export interface LeaderboardEntry {
  uid: string;
  name: string;
  xpTotal: number;
  xpTasks: number;
  xpPicking: number;
  lotsCompleted: number;
  ordersSealed: number;
  tasksCompleted: number;
  level: number;
}

export interface DailyXp {
  date: string;
  xp: number;
}

export interface UserStats {
  xpTotal: number;
  xpTasks: number;
  xpPicking: number;
  tasksCompleted: number;
  lotsCompleted: number;
  ordersSealed: number;
  itemsSeparated: number;
  avgLotDurationMs: number;
  itemsPerMinute: number;
  ordersPerHour: number;
  streak: number;
  fastLots: number;
  level: number;
}

export interface ParsedOrder {
  orderCode: string;
  cycle: string;
  approvedAt: Date | null;
  items: number;
}

export interface SpreadsheetValidationResult {
  success: boolean;
  orders: ParsedOrder[];
  errors: string[];
}
