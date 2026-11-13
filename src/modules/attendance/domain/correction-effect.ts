import type { AttendanceRecord } from './attendance';
import type { AttendanceCorrection } from './correction';

export interface EffectiveAttendance extends Pick<
  AttendanceRecord,
  'employeeId' | 'factory' | 'direction' | 'occurredAt'
> {
  sourceId: string;
  eventId: string | null;
  source: 'EVENT' | 'CORRECTION';
  gateId: string | null;
}

export function applyCorrections(
  records: AttendanceRecord[],
  corrections: AttendanceCorrection[],
): EffectiveAttendance[] {
  const byTarget = new Map(
    corrections
      .filter((c) => c.status === 'APPROVED' && c.targetRecordId)
      .map((c) => [c.targetRecordId, c]),
  );
  const effective: EffectiveAttendance[] = [];
  for (const record of records) {
    const correction = byTarget.get(record.id);
    if (correction?.kind === 'VOID') continue;
    effective.push({
      sourceId: correction?.kind === 'REPLACE' ? correction.id : record.id,
      eventId: record.eventId,
      source: correction?.kind === 'REPLACE' ? 'CORRECTION' : 'EVENT',
      employeeId: record.employeeId,
      factory: record.factory,
      gateId: record.gateId,
      direction:
        correction?.kind === 'REPLACE'
          ? correction.direction!
          : record.direction,
      occurredAt:
        correction?.kind === 'REPLACE'
          ? correction.occurredAt!
          : record.occurredAt,
    });
  }
  for (const correction of corrections) {
    if (correction.status === 'APPROVED' && correction.kind === 'ADD')
      effective.push({
        sourceId: correction.id,
        eventId: null,
        source: 'CORRECTION',
        employeeId: correction.employeeId,
        factory: correction.factory,
        gateId: null,
        direction: correction.direction!,
        occurredAt: correction.occurredAt!,
      });
  }
  return effective.sort(
    (a, b) =>
      b.occurredAt.getTime() - a.occurredAt.getTime() ||
      b.sourceId.localeCompare(a.sourceId),
  );
}
