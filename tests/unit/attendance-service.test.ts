import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import type { AttendanceEventWriter } from '../../src/modules/attendance/application/attendance-repository';
import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';

const now = new Date('2026-11-13T02:00:00.000Z');
const event: QualifiedAttendanceEvent = {
  eventId: 'event-1',
  passageEvidenceId: 'evidence-1',
  employeeId: 'E17',
  factory: 'BINH_DUONG',
  gateId: 'G1',
  direction: 'ENTRY',
  occurredAt: new Date(now.getTime() + 120_000),
};
const record: AttendanceRecord = {
  ...event,
  id: 'record-1',
  recordedAt: now,
};
function service(result = { record, created: true }) {
  const insertOrGet = vi.fn().mockResolvedValue(result);
  const repository = { insertOrGet } satisfies AttendanceEventWriter;
  return { attendance: new AttendanceService(repository), insertOrGet };
}
afterEach(() => vi.useRealTimers());

describe('AttendanceService', () => {
  it('TC36 BVA accepts an event exactly two minutes in the future', async () => {
    vi.useFakeTimers().setSystemTime(now);
    const { attendance, insertOrGet } = service();
    await expect(attendance.accept(event, 'gateway-1')).resolves.toMatchObject({
      created: true,
    });
    expect(insertOrGet).toHaveBeenCalledOnce();
  });

  it('TC37 BVA rejects an event one millisecond beyond the allowed future limit', async () => {
    vi.useFakeTimers().setSystemTime(now);
    const { attendance, insertOrGet } = service();
    await expect(
      attendance.accept(
        { ...event, occurredAt: new Date(now.getTime() + 120_001) },
        'gateway-1',
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(insertOrGet).not.toHaveBeenCalled();
  });

  it('TC38 BVA accepts an event one millisecond below the future limit', async () => {
    vi.useFakeTimers().setSystemTime(now);
    const input = { ...event, occurredAt: new Date(now.getTime() + 119_999) };
    const { attendance, insertOrGet } = service({
      record: { ...record, occurredAt: input.occurredAt },
      created: true,
    });
    await expect(attendance.accept(input, 'gateway-1')).resolves.toMatchObject({
      created: true,
    });
    expect(insertOrGet).toHaveBeenCalledOnce();
  });

  it('TC39 equivalence partition accepts an old qualified event', async () => {
    vi.useFakeTimers().setSystemTime(now);
    const input = {
      ...event,
      occurredAt: new Date(now.getTime() - 86_400_000),
    };
    const { attendance } = service({
      record: { ...record, occurredAt: input.occurredAt },
      created: true,
    });
    await expect(attendance.accept(input, 'gateway-1')).resolves.toMatchObject({
      created: true,
    });
  });
});
