export type Factory = 'BINH_DUONG' | 'LONG_AN';
export type AttendanceDirection = 'ENTRY' | 'EXIT';

export interface QualifiedAttendanceEvent {
  eventId: string;
  employeeId: string;
  factory: Factory;
  gateId: string;
  direction: AttendanceDirection;
  occurredAt: Date;
}

export interface AttendanceRecord extends QualifiedAttendanceEvent {
  id: string;
  recordedAt: Date;
}

export interface AttendanceHistoryFilter {
  employeeId: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

export function sameEvent(
  a: QualifiedAttendanceEvent,
  b: QualifiedAttendanceEvent,
): boolean {
  return (
    a.eventId === b.eventId &&
    a.employeeId === b.employeeId &&
    a.factory === b.factory &&
    a.gateId === b.gateId &&
    a.direction === b.direction &&
    a.occurredAt.getTime() === b.occurredAt.getTime()
  );
}
