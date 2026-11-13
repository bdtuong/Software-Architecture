import type { Factory } from '../domain/attendance';
import type { Principal } from '../domain/identity';
import type { AttendanceRecordReader } from './attendance-repository';
import type { ApprovedCorrectionReader } from './correction-repository';
import { AttendanceRuleError } from './errors';
import type { EffectiveFactoryReader } from './effective-factory-reader';
import { applyCorrections } from '../domain/correction-effect';
import { canReadEmployee, canReadFactory } from '../domain/access-policy';

export class AttendanceQueryService implements EffectiveFactoryReader {
  constructor(
    private readonly attendance: AttendanceRecordReader,
    private readonly corrections: ApprovedCorrectionReader,
  ) {}

  async effective(
    employeeId: string,
    principal: Principal,
    from?: Date,
    to?: Date,
    limit = 50,
    offset = 0,
  ) {
    if (!canReadEmployee(principal, employeeId))
      throw new AttendanceRuleError('Employee outside authorized scope', 403);
    const [records, approved] = await Promise.all([
      this.attendance.listAll(employeeId),
      this.corrections.approved(employeeId),
    ]);
    const entries = applyCorrections(records, approved)
      .filter((entry) => canReadFactory(principal, entry.factory))
      .filter((entry) => !from || entry.occurredAt >= from)
      .filter((entry) => !to || entry.occurredAt <= to);
    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      limit,
      offset,
    };
  }

  async effectiveForFactory(
    factory: Factory,
    start: Date,
    end: Date,
    limit: number,
    offset: number,
  ) {
    const [records, approved] = await Promise.all([
      this.attendance.listForFactory(factory),
      this.corrections.approvedForFactory(factory),
    ]);
    const entries = applyCorrections(records, approved).filter(
      (entry) => entry.occurredAt >= start && entry.occurredAt < end,
    );
    return {
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      limit,
      offset,
    };
  }

  async state(employeeId: string, principal: Principal) {
    const history = await this.effective(
      employeeId,
      principal,
      undefined,
      undefined,
      2,
      0,
    );
    const latest = history.entries[0];
    const previous = history.entries[1];
    return {
      employeeId,
      state: latest ? (latest.direction === 'ENTRY' ? 'IN' : 'OUT') : 'UNKNOWN',
      asOf: latest?.occurredAt ?? null,
      requiresReview: Boolean(
        latest && previous && latest.direction === previous.direction,
      ),
    };
  }
}
