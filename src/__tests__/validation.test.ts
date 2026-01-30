import { describe, it, expect } from 'vitest';
import { validateOrderCode, validateLotCode, validateSealCode } from '@/lib/schemas';

describe('validateOrderCode', () => {
  it('aceita código com exatamente 9 dígitos', () => {
    expect(validateOrderCode('123456789')).toBe(true);
    expect(validateOrderCode('000000001')).toBe(true);
  });

  it('rejeita códigos com menos de 9 dígitos', () => {
    expect(validateOrderCode('12345678')).toBe(false);
    expect(validateOrderCode('1234')).toBe(false);
    expect(validateOrderCode('')).toBe(false);
  });

  it('rejeita códigos com mais de 9 dígitos', () => {
    expect(validateOrderCode('1234567890')).toBe(false);
  });

  it('rejeita códigos com letras', () => {
    expect(validateOrderCode('12345678a')).toBe(false);
    expect(validateOrderCode('abcdefghi')).toBe(false);
  });
});

describe('validateLotCode', () => {
  it('aceita código com exatamente 8 dígitos', () => {
    expect(validateLotCode('12345678')).toBe(true);
    expect(validateLotCode('00000001')).toBe(true);
  });

  it('rejeita códigos inválidos', () => {
    expect(validateLotCode('1234567')).toBe(false);
    expect(validateLotCode('123456789')).toBe(false);
    expect(validateLotCode('1234567a')).toBe(false);
    expect(validateLotCode('')).toBe(false);
  });
});

describe('validateSealCode', () => {
  it('aceita código com exatamente 10 dígitos', () => {
    expect(validateSealCode('1234567890')).toBe(true);
    expect(validateSealCode('0000000001')).toBe(true);
  });

  it('rejeita códigos inválidos', () => {
    expect(validateSealCode('123456789')).toBe(false);
    expect(validateSealCode('12345678901')).toBe(false);
    expect(validateSealCode('123456789a')).toBe(false);
    expect(validateSealCode('')).toBe(false);
  });
});
