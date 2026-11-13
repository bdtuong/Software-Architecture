import { describe, expect, it } from 'vitest';
import { sameEvent } from '../../src/modules/attendance/domain/attendance';
import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';

const event: QualifiedAttendanceEvent = {
  eventId: 'event-1',
  passageEvidenceId: 'evidence-1',
  employeeId: 'E17',
  factory: 'BINH_DUONG',
  gateId: 'G1',
  direction: 'ENTRY',
  occurredAt: new Date('2026-11-13T02:00:00.000Z'),
};
const record: AttendanceRecord = {
  ...event,
  id: 'record-1',
  recordedAt: new Date('2026-11-13T02:00:01.000Z'),
};

describe('sameEvent', () => {
  it('TC40 decision coverage recognizes identical event content', () => {
    expect(sameEvent(record, event)).toBe(true);
  });

  it('TC41 decision coverage rejects a different evidence reference', () => {
    expect(
      sameEvent(record, { ...event, passageEvidenceId: 'evidence-2' }),
    ).toBe(false);
  });
});
