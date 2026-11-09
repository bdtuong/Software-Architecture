import type { AttendanceCorrection, NewCorrection } from '../domain/correction';
import type { AttendanceRecord } from '../domain/attendance';

export interface CorrectionRepository {
  findRecord(id: string): Promise<AttendanceRecord | null>;
  create(input: NewCorrection): Promise<AttendanceCorrection>;
  find(id: string): Promise<AttendanceCorrection | null>;
  list(employeeId: string): Promise<AttendanceCorrection[]>;
  approved(employeeId: string): Promise<AttendanceCorrection[]>;
  approvedForFactory(
    factory: NewCorrection['factory'],
  ): Promise<AttendanceCorrection[]>;
  review(
    id: string,
    reviewerId: string,
    approve: boolean,
    reason: string,
  ): Promise<AttendanceCorrection | null>;
}
