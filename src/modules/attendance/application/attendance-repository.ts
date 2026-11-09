import type {
  AttendanceHistoryFilter,
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../domain/attendance';

export interface AttendanceRepository {
  insertOrGet(event: QualifiedAttendanceEvent): Promise<{
    record: AttendanceRecord;
    created: boolean;
  }>;
  list(filter: AttendanceHistoryFilter): Promise<AttendanceRecord[]>;
}
