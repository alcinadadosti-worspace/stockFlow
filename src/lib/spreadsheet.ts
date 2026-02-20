import * as XLSX from 'xlsx';
import type { ParsedOrder, SpreadsheetValidationResult } from '@/types';

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

const COLUMN_MAP: Record<string, string> = {
  pedido: 'orderCode',
  ciclo: 'cycle',
  datadeaprovacao: 'approvedAt',
  dataaprovacao: 'approvedAt',
  aprovacao: 'approvedAt',
  itens: 'items',
  item: 'items',
  quantidade: 'items',
  qty: 'items',
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }

  const str = String(value).trim();

  // DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm or DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brMatch) {
    const [, day, month, year, hours, minutes, seconds] = brMatch;
    const d = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours || '0'),
      parseInt(minutes || '0'),
      parseInt(seconds || '0'),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // YYYY-MM-DD...
  const isoDate = new Date(str);
  return isNaN(isoDate.getTime()) ? null : isoDate;
}

export function parseSpreadsheet(buffer: ArrayBuffer, fileName: string): SpreadsheetValidationResult {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return { success: false, orders: [], errors: ['Não foi possível ler o arquivo. Verifique o formato (CSV ou XLSX).'] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, orders: [], errors: ['Arquivo sem planilha/aba.'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawData.length === 0) {
    return { success: false, orders: [], errors: ['Planilha vazia.'] };
  }

  // Map headers
  const rawHeaders = Object.keys(rawData[0]);
  const headerMap: Record<string, string> = {};
  for (const h of rawHeaders) {
    const normalized = normalizeHeader(h);
    const mapped = COLUMN_MAP[normalized];
    if (mapped) {
      headerMap[h] = mapped;
    }
  }

  const requiredFields = ['orderCode', 'cycle', 'approvedAt', 'items'];
  const mappedFields = Object.values(headerMap);
  const missingFields = requiredFields.filter((f) => !mappedFields.includes(f));

  if (missingFields.length > 0) {
    const fieldLabels: Record<string, string> = {
      orderCode: 'Pedido',
      cycle: 'Ciclo',
      approvedAt: 'Data de Aprovação',
      items: 'Itens',
    };
    return {
      success: false,
      orders: [],
      errors: [
        `Colunas obrigatórias não encontradas: ${missingFields.map((f) => fieldLabels[f]).join(', ')}.`,
        `Colunas encontradas: ${rawHeaders.join(', ')}`,
        `Esperado: Pedido, Ciclo, Data de Aprovação, Itens`,
      ],
    };
  }

  const orders: ParsedOrder[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // +2 because header is row 1

    const mapped: Record<string, unknown> = {};
    for (const [rawKey, mappedKey] of Object.entries(headerMap)) {
      mapped[mappedKey] = row[rawKey];
    }

    // orderCode
    const orderCodeRaw = String(mapped.orderCode || '').trim();
    if (!/^\d{9}$/.test(orderCodeRaw)) {
      errors.push(`Linha ${rowNum}: Pedido "${orderCodeRaw}" deve ter exatamente 9 dígitos.`);
      continue;
    }

    // cycle
    const cycle = String(mapped.cycle || '').trim();

    // approvedAt
    const approvedAt = parseDate(mapped.approvedAt);

    // items
    const itemsRaw = mapped.items;
    const items = parseInt(String(itemsRaw), 10);
    if (isNaN(items) || items < 0) {
      errors.push(`Linha ${rowNum}: Itens "${itemsRaw}" deve ser um número inteiro.`);
      continue;
    }

    orders.push({
      orderCode: orderCodeRaw,
      cycle,
      approvedAt,
      items,
    });
  }

  return {
    success: errors.length === 0 && orders.length > 0,
    orders,
    errors,
  };
}

// Parser simplificado para pedido avulso (apenas Pedido e Itens obrigatorios)
export interface SingleOrderParseResult {
  success: boolean;
  orderCode: string;
  items: number;
  cycle?: string;
  errors: string[];
}

export function parseSingleOrderSpreadsheet(buffer: ArrayBuffer): SingleOrderParseResult {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch {
    return { success: false, orderCode: '', items: 0, errors: ['Nao foi possivel ler o arquivo. Verifique o formato (CSV ou XLSX).'] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, orderCode: '', items: 0, errors: ['Arquivo sem planilha/aba.'] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawData.length === 0) {
    return { success: false, orderCode: '', items: 0, errors: ['Planilha vazia.'] };
  }

  if (rawData.length > 1) {
    return { success: false, orderCode: '', items: 0, errors: ['Pedido avulso deve conter apenas 1 linha de dados. Use a funcao de Lotes para multiplos pedidos.'] };
  }

  // Map headers
  const rawHeaders = Object.keys(rawData[0]);
  const headerMap: Record<string, string> = {};
  for (const h of rawHeaders) {
    const normalized = normalizeHeader(h);
    const mapped = COLUMN_MAP[normalized];
    if (mapped) {
      headerMap[h] = mapped;
    }
  }

  const mappedFields = Object.values(headerMap);

  // Apenas Pedido e Itens sao obrigatorios
  if (!mappedFields.includes('orderCode')) {
    return { success: false, orderCode: '', items: 0, errors: ['Coluna "Pedido" nao encontrada.', `Colunas encontradas: ${rawHeaders.join(', ')}`] };
  }
  if (!mappedFields.includes('items')) {
    return { success: false, orderCode: '', items: 0, errors: ['Coluna "Itens" nao encontrada.', `Colunas encontradas: ${rawHeaders.join(', ')}`] };
  }

  const row = rawData[0];
  const mapped: Record<string, unknown> = {};
  for (const [rawKey, mappedKey] of Object.entries(headerMap)) {
    mapped[mappedKey] = row[rawKey];
  }

  // orderCode
  const orderCodeRaw = String(mapped.orderCode || '').trim();
  if (!orderCodeRaw) {
    return { success: false, orderCode: '', items: 0, errors: ['Codigo do pedido vazio.'] };
  }

  // items
  const itemsRaw = mapped.items;
  const items = parseInt(String(itemsRaw), 10);
  if (isNaN(items) || items < 1) {
    return { success: false, orderCode: '', items: 0, errors: [`Quantidade de itens "${itemsRaw}" invalida.`] };
  }

  // cycle (opcional)
  const cycle = mapped.cycle ? String(mapped.cycle).trim() : undefined;

  return {
    success: true,
    orderCode: orderCodeRaw,
    items,
    cycle,
    errors: [],
  };
}
