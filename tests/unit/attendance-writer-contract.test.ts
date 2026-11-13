import { describe, expect, it } from 'vitest';
import {
  MemoryAttendance,
  MemoryPeriods,
} from '../support/memory-repositories';
import { verifyAttendanceWriterContract } from '../support/attendance-writer-contract';

const event = {
  eventId: 'contract-1',
  passageEvidenceId: 'passage-1',
  employeeId: 'E1',
  factory: 'BINH_DUONG' as const,
  gateId: 'G1',
  direction: 'ENTRY' as const,
  occurredAt: new Date('2026-11-01T00:00:00Z'),
};

describe('AttendanceEventWriter contract', () => {
  it('TC51 is respected by the in-memory adapter', async () => {
    const periods = new MemoryPeriods();
    const writer = new MemoryAttendance(periods);
    const record = await verifyAttendanceWriterContract(writer, event);
    expect(writer.auditAccepted).toEqual([record.id]);
    expect((await periods.get('BINH_DUONG', '2026-11'))?.status).toBe('OPEN');
  });
});
