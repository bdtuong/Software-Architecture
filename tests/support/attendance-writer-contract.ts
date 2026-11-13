import { expect } from 'vitest';
import type { AttendanceEventWriter } from '../../src/modules/attendance/application/attendance-repository';
import type { QualifiedAttendanceEvent } from '../../src/modules/attendance/domain/attendance';

/** The same observable contract is exercised against the in-memory and Prisma adapters. */
export async function verifyAttendanceWriterContract(
  writer: AttendanceEventWriter,
  event: QualifiedAttendanceEvent,
) {
  const first = await writer.insertOrGet(event, 'contract-gateway');
  expect(first.created).toBe(true);
  const retry = await writer.insertOrGet(event, 'contract-gateway');
  expect(retry).toEqual({ record: first.record, created: false });
  const sameIdDifferentPayload = await writer.insertOrGet(
    { ...event, direction: event.direction === 'ENTRY' ? 'EXIT' : 'ENTRY' },
    'contract-gateway',
  );
  expect(sameIdDifferentPayload).toEqual({
    record: first.record,
    created: false,
  });
  await expect(
    writer.insertOrGet(
      { ...event, eventId: `${event.eventId}-other` },
      'contract-gateway',
    ),
  ).rejects.toMatchObject({ status: 409 });
  return first.record;
}
