import type {
  AttendanceRecord,
  Factory,
  QualifiedAttendanceEvent,
} from '../domain/attendance';

/** Atomically stores a new event and its required period/audit effects, or returns the
 * existing record for the same Event ID. An evidence-ID collision must be rejected. */
export interface AttendanceEventWriter {
  insertOrGet(
    event: QualifiedAttendanceEvent,
    actorId: string,
  ): Promise<{
    record: AttendanceRecord;
    created: boolean;
  }>;
}

export interface AttendanceRecordReader {
  listAll(employeeId: string): Promise<AttendanceRecord[]>;
  listForFactory(factory: Factory): Promise<AttendanceRecord[]>;
}

export interface AttendanceRecordLookup {
  findRecord(id: string): Promise<AttendanceRecord | null>;
}
