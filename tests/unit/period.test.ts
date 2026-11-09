import { describe, expect, it } from 'vitest';
import {
  monthBounds,
  vietnamMonth,
} from '../../src/modules/attendance/domain/period';

describe('Vietnam attendance months', () => {
  it('uses factory-local month boundaries for late arrivals and export', () => {
    expect(vietnamMonth(new Date('2026-10-31T16:59:59Z'))).toBe('2026-10');
    expect(vietnamMonth(new Date('2026-10-31T17:00:00Z'))).toBe('2026-11');
    expect(monthBounds('2026-11')).toEqual({
      start: new Date('2026-10-31T17:00:00Z'),
      end: new Date('2026-11-30T17:00:00Z'),
    });
  });
  it('rejects malformed months', () => {
    expect(() => monthBounds('2026-13')).toThrow();
    expect(() => monthBounds('0000-01')).toThrow();
  });
});
