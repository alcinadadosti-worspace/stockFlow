import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmPassword: z.string().min(6, 'Mínimo 6 caracteres'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

export type RegisterForm = z.infer<typeof registerSchema>;

export const taskTypeSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  xp: z.coerce.number().int().min(1, 'XP deve ser ao menos 1'),
});

export type TaskTypeForm = z.infer<typeof taskTypeSchema>;

export const taskLogSchema = z.object({
  taskTypeId: z.string().min(1, 'Selecione uma tarefa'),
  quantity: z.coerce.number().int().min(1, 'Mínimo 1').default(1),
  note: z.string().optional().default(''),
});

export type TaskLogForm = z.infer<typeof taskLogSchema>;

export const lotImportSchema = z.object({
  lotCode: z.string().regex(/^\d{8}$/, 'Código do lote deve ter exatamente 8 dígitos'),
});

export type LotImportForm = z.infer<typeof lotImportSchema>;

export const sealCodeSchema = z.object({
  sealedCode: z.string().regex(/^\d{10}$/, 'Código de lacre deve ter exatamente 10 dígitos'),
});

export type SealCodeForm = z.infer<typeof sealCodeSchema>;

export const pickingRulesSchema = z.object({
  xpBasePerLot: z.coerce.number().int().min(0),
  xpPerOrder: z.coerce.number().int().min(0),
  xpPerItem: z.coerce.number().int().min(0),
  speedTargetItemsPerMin: z.coerce.number().min(0),
  bonus10Threshold: z.coerce.number().min(0),
  bonus20Threshold: z.coerce.number().min(0),
});

export type PickingRulesForm = z.infer<typeof pickingRulesSchema>;

export const userRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ESTOQUISTA']),
});

export type UserRoleForm = z.infer<typeof userRoleSchema>;

export const orderCodeRegex = /^\d{9}$/;
export const lotCodeRegex = /^\d{8}$/;
export const sealCodeRegex = /^\d{10}$/;

export function validateOrderCode(code: string): boolean {
  return orderCodeRegex.test(code);
}

export function validateLotCode(code: string): boolean {
  return lotCodeRegex.test(code);
}

export function validateSealCode(code: string): boolean {
  return sealCodeRegex.test(code);
}
