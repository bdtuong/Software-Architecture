import { describe, expect, it } from 'vitest';
import { applyCorrections } from '../../src/modules/attendance/domain/correction-effect';
import type { AttendanceRecord } from '../../src/modules/attendance/domain/attendance';
import type { AttendanceCorrection } from '../../src/modules/attendance/domain/correction';

const now = new Date('2026-11-13T02:00:00.000Z');
const record: AttendanceRecord = {
  id: 'record-1',
  eventId: 'event-1',
  passageEvidenceId: 'evidence-1',
  employeeId: 'E17',
  factory: 'BINH_DUONG',
  gateId: 'G1',
  direction: 'ENTRY',
  occurredAt: now,
  recordedAt: now,
};
const correction: AttendanceCorrection = {
  id: 'correction-1',
  kind: 'REPLACE',
  status: 'APPROVED',
  employeeId: 'E17',
  factory: 'BINH_DUONG',
  targetRecordId: record.id,
  direction: 'EXIT',
  occurredAt: new Date(now.getTime() - 60_000),
  reason: 'Verified by HR',
  requestedBy: 'E17',
  requestedAt: now,
  reviewedBy: 'HR1',
  reviewedAt: now,
  reviewReason: 'Verified against gate log',
};

describe('applyCorrections', () => {
  it('TC42 state transition applies an approved replacement without changing the raw record', () => {
    const effective = applyCorrections([record], [correction]);
    expect(effective).toMatchObject([
      { source: 'CORRECTION', direction: 'EXIT' },
    ]);
    expect(record.direction).toBe('ENTRY');
  });

  it('TC43 state transition ignores a pending replacement', () => {
    const effective = applyCorrections(
      [record],
      [{ ...correction, status: 'PENDING' }],
    );
    expect(effective).toMatchObject([{ source: 'EVENT', direction: 'ENTRY' }]);
  });
});
