import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../domain/attendance';

export interface AttendanceRepository {
  insertOrGet(
    event: QualifiedAttendanceEvent,
    actorId: string,
  ): Promise<{
    record: AttendanceRecord;
    created: boolean;
  }>;
  listAll(employeeId: string): Promise<AttendanceRecord[]>;
  listForFactory(
    factory: QualifiedAttendanceEvent['factory'],
  ): Promise<AttendanceRecord[]>;
}
