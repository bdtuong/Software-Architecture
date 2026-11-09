import type { AttendanceDirection, Factory } from './attendance';

export type CorrectionKind = 'ADD' | 'REPLACE' | 'VOID';
export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface NewCorrection {
  kind: CorrectionKind;
  employeeId: string;
  factory: Factory;
  targetRecordId?: string;
  direction?: AttendanceDirection;
  occurredAt?: Date;
  reason: string;
  requestedBy: string;
}

export interface AttendanceCorrection extends Omit<
  NewCorrection,
  'targetRecordId' | 'direction' | 'occurredAt'
> {
  id: string;
  status: CorrectionStatus;
  requestedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewReason: string | null;
  targetRecordId: string | null;
  direction: AttendanceDirection | null;
  occurredAt: Date | null;
}
