import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSpreadsheet } from '@/lib/spreadsheet';

function createXlsxBuffer(data: Record<string, unknown>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return buf;
}

describe('parseSpreadsheet', () => {
  it('parseia planilha válida com colunas corretas', () => {
    const data = [
      { Pedido: '123456789', Ciclo: '02/2026', 'Data de Aprovação': '15/01/2026 10:30', Itens: 5 },
      { Pedido: '987654321', Ciclo: '02/2026', 'Data de Aprovação': '16/01/2026 14:00', Itens: 3 },
    ];
    const buffer = createXlsxBuffer(data);
    const result = parseSpreadsheet(buffer, 'test.xlsx');

    expect(result.success).toBe(true);
    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].orderCode).toBe('123456789');
    expect(result.orders[0].items).toBe(5);
    expect(result.orders[1].orderCode).toBe('987654321');
    expect(result.errors).toHaveLength(0);
  });

  it('reporta erro para pedido com código inválido', () => {
    const data = [
      { Pedido: '12345', Ciclo: '02/2026', 'Data de Aprovação': '15/01/2026', Itens: 5 },
      { Pedido: '123456789', Ciclo: '02/2026', 'Data de Aprovação': '15/01/2026', Itens: 3 },
    ];
    const buffer = createXlsxBuffer(data);
    const result = parseSpreadsheet(buffer, 'test.xlsx');

    expect(result.orders).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('12345');
  });

  it('reporta erro quando colunas obrigatórias faltam', () => {
    const data = [
      { Nome: 'Teste', Valor: 100 },
    ];
    const buffer = createXlsxBuffer(data);
    const result = parseSpreadsheet(buffer, 'test.xlsx');

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Colunas obrigatórias');
  });

  it('aceita colunas com variações de nome (case-insensitive, sem acento)', () => {
    const data = [
      { pedido: '123456789', ciclo: '02/2026', 'data de aprovacao': '15/01/2026', itens: 5 },
    ];
    const buffer = createXlsxBuffer(data);
    const result = parseSpreadsheet(buffer, 'test.xlsx');

    expect(result.success).toBe(true);
    expect(result.orders).toHaveLength(1);
  });

  it('reporta planilha vazia', () => {
    const ws = XLSX.utils.json_to_sheet([]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const result = parseSpreadsheet(buffer, 'test.xlsx');

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('vazia');
  });
});
