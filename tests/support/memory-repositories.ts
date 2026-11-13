import { randomUUID } from 'node:crypto';
import type {
  AttendanceEventWriter,
  AttendanceRecordReader,
  AttendanceRecordLookup,
} from '../../src/modules/attendance/application/attendance-repository';
import type {
  CorrectionRequestWriter,
  CorrectionReviewer,
  CorrectionRequestReader,
  ApprovedCorrectionReader,
} from '../../src/modules/attendance/application/correction-repository';
import type { PeriodRepository } from '../../src/modules/attendance/application/period-repository';
import { AttendanceRuleError } from '../../src/modules/attendance/application/errors';
import type {
  AttendanceRecord,
  Factory,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';
import type {
  AttendanceCorrection,
  NewCorrection,
} from '../../src/modules/attendance/domain/correction';
import type { AttendancePeriod } from '../../src/modules/attendance/domain/period';
import { vietnamMonth } from '../../src/modules/attendance/domain/period';

export class MemoryPeriods implements PeriodRepository {
  private rows = new Map<string, AttendancePeriod>();
  private pending = new Map<string, Set<string>>();

  markDirty(factory: Factory, occurredAt: Date) {
    const month = vietnamMonth(occurredAt);
    const key = `${factory}:${month}`;
    const prior = this.rows.get(key);
    if (prior) {
      if (prior.status === 'FINALIZED') prior.status = 'REOPEN_REQUIRED';
    } else {
      this.rows.set(key, {
        id: randomUUID(),
        factory,
        month,
        status: 'OPEN',
        revision: 0,
        finalizedAt: null,
        finalizedBy: null,
      });
    }
  }

  addPending(factory: Factory, occurredAt: Date, correctionId: string) {
    const key = `${factory}:${vietnamMonth(occurredAt)}`;
    const ids = this.pending.get(key) ?? new Set<string>();
    ids.add(correctionId);
    this.pending.set(key, ids);
  }

  clearPending(factory: Factory, occurredAt: Date, correctionId: string) {
    this.pending
      .get(`${factory}:${vietnamMonth(occurredAt)}`)
      ?.delete(correctionId);
  }

  async get(factory: Factory, month: string) {
    return this.rows.get(`${factory}:${month}`) ?? null;
  }

  async finalize(factory: Factory, month: string, actorId: string) {
    const prior = await this.get(factory, month);
    if (prior?.status === 'FINALIZED') return prior;
    if (this.pending.get(`${factory}:${month}`)?.size)
      throw new AttendanceRuleError(
        'Review pending corrections before finalization',
        409,
      );
    const row: AttendancePeriod = {
      id: prior?.id ?? randomUUID(),
      factory,
      month,
      status: 'FINALIZED',
      revision: (prior?.revision ?? 0) + 1,
      finalizedAt: new Date(),
      finalizedBy: actorId,
    };
    this.rows.set(`${factory}:${month}`, row);
    return row;
  }
}

export class MemoryAttendance
  implements
    AttendanceEventWriter,
    AttendanceRecordReader,
    AttendanceRecordLookup
{
  private records = new Map<string, AttendanceRecord>();
  readonly auditAccepted: string[] = [];
  fail = false;
  constructor(private readonly periods: MemoryPeriods) {}

  async insertOrGet(event: QualifiedAttendanceEvent, _actorId: string) {
    void _actorId;
    if (this.fail) throw new Error('database offline');
    const existing = this.records.get(event.eventId);
    if (existing) return { record: existing, created: false };
    if (
      [...this.records.values()].some(
        (row) => row.passageEvidenceId === event.passageEvidenceId,
      )
    )
      throw new AttendanceRuleError('Passage evidence already recorded', 409);
    const record = { ...event, id: randomUUID(), recordedAt: new Date() };
    this.records.set(event.eventId, record);
    this.periods.markDirty(event.factory, event.occurredAt);
    this.auditAccepted.push(record.id);
    return { record, created: true };
  }

  async listForFactory(factory: Factory) {
    return [...this.records.values()].filter(
      (record) => record.factory === factory,
    );
  }
  async listAll(employeeId: string) {
    if (this.fail) throw new Error('database offline');
    return [...this.records.values()].filter(
      (record) => record.employeeId === employeeId,
    );
  }
  async findRecord(id: string) {
    return (
      [...this.records.values()].find((record) => record.id === id) ?? null
    );
  }
}

export class MemoryCorrections
  implements
    CorrectionRequestWriter,
    CorrectionReviewer,
    CorrectionRequestReader,
    ApprovedCorrectionReader
{
  private rows = new Map<string, AttendanceCorrection>();
  readonly auditEvents: string[] = [];
  constructor(
    private readonly attendance: MemoryAttendance,
    private readonly periods: MemoryPeriods,
  ) {}

  async create(input: NewCorrection) {
    const row: AttendanceCorrection = {
      ...input,
      id: randomUUID(),
      status: 'PENDING',
      targetRecordId: input.targetRecordId ?? null,
      direction: input.direction ?? null,
      occurredAt: input.occurredAt ?? null,
      requestedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    };
    const dates = await this.affectedDates(row);
    this.rows.set(row.id, row);
    for (const date of dates) {
      this.periods.markDirty(row.factory, date);
      this.periods.addPending(row.factory, date, row.id);
    }
    this.auditEvents.push(`requested:${row.id}`);
    return row;
  }
  async find(id: string) {
    return this.rows.get(id) ?? null;
  }
  async list(employeeId: string) {
    return [...this.rows.values()].filter(
      (row) => row.employeeId === employeeId,
    );
  }
  async approvedForFactory(factory: Factory) {
    return [...this.rows.values()].filter(
      (row) => row.factory === factory && row.status === 'APPROVED',
    );
  }
  async approved(employeeId: string) {
    return (await this.list(employeeId)).filter(
      (row) => row.status === 'APPROVED',
    );
  }
  async review(
    id: string,
    reviewerId: string,
    approve: boolean,
    reason: string,
  ) {
    const row = this.rows.get(id);
    if (!row || row.status !== 'PENDING') return null;
    if (
      approve &&
      row.targetRecordId &&
      [...this.rows.values()].some(
        (other) =>
          other.id !== id &&
          other.status === 'APPROVED' &&
          other.targetRecordId === row.targetRecordId,
      )
    )
      throw new AttendanceRuleError(
        'Target record already has an approved correction',
        409,
      );
    row.status = approve ? 'APPROVED' : 'REJECTED';
    row.reviewedBy = reviewerId;
    row.reviewedAt = new Date();
    row.reviewReason = reason;
    for (const date of await this.affectedDates(row)) {
      this.periods.clearPending(row.factory, date, row.id);
      if (approve) this.periods.markDirty(row.factory, date);
    }
    this.auditEvents.push(`${row.status.toLowerCase()}:${row.id}`);
    return row;
  }
  private async affectedDates(row: AttendanceCorrection): Promise<Date[]> {
    const dates: Date[] = [];
    if (row.occurredAt) dates.push(row.occurredAt);
    if (row.targetRecordId) {
      const target = await this.attendance.findRecord(row.targetRecordId);
      if (!target)
        throw new AttendanceRuleError('Target record not found', 404);
      dates.push(target.occurredAt);
    }
    return dates;
  }
}
