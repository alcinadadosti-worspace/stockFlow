export const TIMEZONE = 'America/Maceio';

export const LOT_STATUS = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  CLOSING: 'CLOSING',
  DONE: 'DONE',
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  SEALED: 'SEALED',
} as const;

export const USER_ROLE = {
  ADMIN: 'ADMIN',
  ESTOQUISTA: 'ESTOQUISTA',
} as const;

export const LOT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_PROGRESS: 'Em Andamento',
  CLOSING: 'Encerrando Pedidos',
  DONE: 'Concluído',
};

export const DEFAULT_PICKING_RULES = {
  xpBasePerLot: 50,
  xpPerOrder: 10,
  xpPerItem: 2,
  speedTargetItemsPerMin: 5,
  bonus10Threshold: 1.0,
  bonus20Threshold: 1.2,
};

export const BADGES = [
  { id: 'first-lot', name: 'Primeiro Lote', description: 'Concluiu o primeiro lote', icon: 'Package', condition: (stats: { lotsCompleted: number }) => stats.lotsCompleted >= 1 },
  { id: '10-lots', name: '10 Lotes', description: 'Concluiu 10 lotes', icon: 'Boxes', condition: (stats: { lotsCompleted: number }) => stats.lotsCompleted >= 10 },
  { id: '50-lots', name: '50 Lotes', description: 'Concluiu 50 lotes', icon: 'Warehouse', condition: (stats: { lotsCompleted: number }) => stats.lotsCompleted >= 50 },
  { id: '100-orders', name: '100 Pedidos', description: 'Encerrou 100 pedidos', icon: 'ClipboardCheck', condition: (stats: { ordersSealed: number }) => stats.ordersSealed >= 100 },
  { id: '500-orders', name: '500 Pedidos', description: 'Encerrou 500 pedidos', icon: 'Award', condition: (stats: { ordersSealed: number }) => stats.ordersSealed >= 500 },
  { id: 'streak-7', name: 'Streak 7 Dias', description: '7 dias consecutivos de atividade', icon: 'Flame', condition: (stats: { streak: number }) => stats.streak >= 7 },
  { id: 'streak-30', name: 'Streak 30 Dias', description: '30 dias consecutivos', icon: 'Zap', condition: (stats: { streak: number }) => stats.streak >= 30 },
  { id: 'speed-demon', name: 'Velocidade Acima da Meta', description: 'Lote com velocidade acima da meta', icon: 'Gauge', condition: (stats: { fastLots: number }) => stats.fastLots >= 1 },
  { id: 'first-task', name: 'Primeira Tarefa', description: 'Registrou a primeira tarefa', icon: 'CheckCircle', condition: (stats: { tasksCompleted: number }) => stats.tasksCompleted >= 1 },
  { id: '50-tasks', name: '50 Tarefas', description: 'Registrou 50 tarefas', icon: 'Trophy', condition: (stats: { tasksCompleted: number }) => stats.tasksCompleted >= 50 },
] as const;
