import { describe, expect, it } from 'vitest';
import { RequestCorrection } from '../../src/modules/attendance/application/request-correction';
import { defaultCorrectionRequestRules } from '../../src/modules/attendance/application/correction-request-rule';
import type { CorrectionRequestRule } from '../../src/modules/attendance/application/correction-request-rule';
import { AttendanceRuleError } from '../../src/modules/attendance/application/errors';
import {
  MemoryAttendance,
  MemoryCorrections,
  MemoryPeriods,
} from '../support/memory-repositories';

const principal = {
  sub: 'E1',
  role: 'EMPLOYEE' as const,
  factories: [],
  employeeIds: [],
};
const input = {
  kind: 'ADD' as const,
  employeeId: 'E1',
  factory: 'BINH_DUONG' as const,
  direction: 'ENTRY' as const,
  occurredAt: new Date('2026-11-01T00:00:00Z'),
  reason: 'Manual gate record reviewed',
  requestedBy: 'E1',
};

describe('correction rule extension', () => {
  it('adds a ticket requirement without changing the request use case', async () => {
    const periods = new MemoryPeriods();
    const records = new MemoryAttendance(periods);
    const writer = new MemoryCorrections(records, periods);
    const ticketRule: CorrectionRequestRule = {
      kind: 'ADD',
      async validate(value, lookup) {
        await defaultCorrectionRequestRules.get('ADD')!.validate(value, lookup);
        if (!value.reason.includes('TICKET-'))
          throw new AttendanceRuleError('A ticket reference is required', 400);
      },
    };
    const useCase = new RequestCorrection(
      records,
      writer,
      new Map([['ADD', ticketRule]]),
    );
    await expect(useCase.execute(input, principal)).rejects.toMatchObject({
      status: 400,
    });
    const result = await useCase.execute(
      { ...input, reason: 'Manual gate record TICKET-123' },
      principal,
    );
    expect(result.status).toBe('PENDING');
  });
});
