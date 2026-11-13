import type { AttendanceCorrection, NewCorrection } from '../domain/correction';
import type { Factory } from '../domain/attendance';

/** Creates a pending request and its audit event in one transaction. */
export interface CorrectionRequestWriter {
  create(input: NewCorrection): Promise<AttendanceCorrection>;
}

/** Changes a pending request at most once; returns null if it was already reviewed. */
export interface CorrectionReviewer {
  find(id: string): Promise<AttendanceCorrection | null>;
  review(
    id: string,
    reviewerId: string,
    approve: boolean,
    reason: string,
  ): Promise<AttendanceCorrection | null>;
}

export interface CorrectionRequestReader {
  list(employeeId: string): Promise<AttendanceCorrection[]>;
}

export interface ApprovedCorrectionReader {
  approved(employeeId: string): Promise<AttendanceCorrection[]>;
  approvedForFactory(factory: Factory): Promise<AttendanceCorrection[]>;
}
