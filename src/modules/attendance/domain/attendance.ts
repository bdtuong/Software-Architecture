export type Factory = 'BINH_DUONG' | 'LONG_AN';
export type AttendanceDirection = 'ENTRY' | 'EXIT';

export interface QualifiedAttendanceEvent {
  eventId: string;
  passageEvidenceId: string;
  employeeId: string;
  factory: Factory;
  gateId: string;
  direction: AttendanceDirection;
  occurredAt: Date;
}

export interface AttendanceRecord extends Omit<
  QualifiedAttendanceEvent,
  'passageEvidenceId'
> {
  passageEvidenceId: string | null;
  id: string;
  recordedAt: Date;
}

export function sameEvent(
  a: AttendanceRecord,
  b: QualifiedAttendanceEvent,
): boolean {
  return (
    a.eventId === b.eventId &&
    a.passageEvidenceId === b.passageEvidenceId &&
    a.employeeId === b.employeeId &&
    a.factory === b.factory &&
    a.gateId === b.gateId &&
    a.direction === b.direction &&
    a.occurredAt.getTime() === b.occurredAt.getTime()
  );
}
