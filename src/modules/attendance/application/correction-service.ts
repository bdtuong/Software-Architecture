import { AttendanceRuleError } from './errors';
import type { Principal } from '../../../config/auth';
import type { AttendanceRecord, Factory } from '../domain/attendance';
import type { AttendanceCorrection, NewCorrection } from '../domain/correction';
import type { CorrectionRepository } from './correction-repository';

export class CorrectionService {
  constructor(private readonly repository: CorrectionRepository) {}

  async request(input: NewCorrection, principal: Principal) {
    if (principal.role === 'EMPLOYEE') {
      if (principal.sub !== input.employeeId)
        throw new AttendanceRuleError(
          'Cannot request for another employee',
          403,
        );
    } else if (principal.role === 'SECURITY') {
      if (!principal.factories.includes(input.factory))
        throw new AttendanceRuleError('Factory outside authorized scope', 403);
    } else
      throw new AttendanceRuleError('Role cannot request corrections', 403);

    if (
      input.occurredAt &&
      input.occurredAt.getTime() > Date.now() + 2 * 60_000
    ) {
      throw new AttendanceRuleError(
        'Proposed event time is in the future',
        400,
      );
    }
    if (input.kind === 'ADD') {
      if (input.targetRecordId)
        throw new AttendanceRuleError('ADD cannot target a record', 400);
      if (!input.direction || !input.occurredAt)
        throw new AttendanceRuleError(
          'ADD requires direction and occurredAt',
          400,
        );
    } else {
      if (!input.targetRecordId)
        throw new AttendanceRuleError('Target record required', 400);
      const target = await this.repository.findRecord(input.targetRecordId);
      if (!target)
        throw new AttendanceRuleError('Target record not found', 404);
      if (
        target.employeeId !== input.employeeId ||
        target.factory !== input.factory
      )
        throw new AttendanceRuleError(
          'Target does not match employee and factory',
          400,
        );
      if (input.kind === 'REPLACE' && (!input.direction || !input.occurredAt))
        throw new AttendanceRuleError(
          'REPLACE requires direction and occurredAt',
          400,
        );
      if (input.kind === 'VOID' && (input.direction || input.occurredAt))
        throw new AttendanceRuleError(
          'VOID cannot contain replacement fields',
          400,
        );
    }
    return this.repository.create(input);
  }

  async review(
    id: string,
    principal: Principal,
    approve: boolean,
    reason: string,
  ) {
    if (principal.role !== 'HR')
      throw new AttendanceRuleError('HR role required', 403);
    const correction = await this.repository.find(id);
    if (!correction) throw new AttendanceRuleError('Correction not found', 404);
    if (!principal.factories.includes(correction.factory))
      throw new AttendanceRuleError('Factory outside authorized scope', 403);
    if (correction.requestedBy === principal.sub)
      throw new AttendanceRuleError(
        'Requester cannot review own correction',
        403,
      );
    if (correction.status !== 'PENDING')
      throw new AttendanceRuleError('Correction already reviewed', 409);
    const reviewed = await this.repository.review(
      id,
      principal.sub,
      approve,
      reason,
    );
    if (!reviewed)
      throw new AttendanceRuleError('Correction already reviewed', 409);
    return reviewed;
  }

  list(employeeId: string, principal: Principal) {
    if (!canReadEmployee(principal, employeeId))
      throw new AttendanceRuleError('Employee outside authorized scope', 403);
    return this.repository
      .list(employeeId)
      .then((rows) =>
        rows.filter((row) => canReadFactory(principal, row.factory)),
      );
  }
}

export function canReadFactory(principal: Principal, factory: Factory) {
  return principal.role === 'EMPLOYEE' || principal.factories.includes(factory);
}

export function canReadEmployee(principal: Principal, employeeId: string) {
  if (principal.role === 'EMPLOYEE') return principal.sub === employeeId;
  if (principal.role === 'SUPERVISOR')
    return principal.employeeIds.includes(employeeId);
  return principal.role === 'HR';
}

export interface EffectiveAttendance extends Pick<
  AttendanceRecord,
  'employeeId' | 'factory' | 'direction' | 'occurredAt'
> {
  sourceId: string;
  eventId: string | null;
  source: 'EVENT' | 'CORRECTION';
  gateId: string | null;
}

export function applyCorrections(
  records: AttendanceRecord[],
  corrections: AttendanceCorrection[],
): EffectiveAttendance[] {
  const byTarget = new Map(
    corrections
      .filter((c) => c.status === 'APPROVED' && c.targetRecordId)
      .map((c) => [c.targetRecordId, c]),
  );
  const effective: EffectiveAttendance[] = [];
  for (const record of records) {
    const correction = byTarget.get(record.id);
    if (correction?.kind === 'VOID') continue;
    effective.push({
      sourceId: correction?.kind === 'REPLACE' ? correction.id : record.id,
      eventId: record.eventId,
      source: correction?.kind === 'REPLACE' ? 'CORRECTION' : 'EVENT',
      employeeId: record.employeeId,
      factory: record.factory,
      gateId: record.gateId,
      direction:
        correction?.kind === 'REPLACE'
          ? correction.direction!
          : record.direction,
      occurredAt:
        correction?.kind === 'REPLACE'
          ? correction.occurredAt!
          : record.occurredAt,
    });
  }
  for (const correction of corrections) {
    if (correction.status === 'APPROVED' && correction.kind === 'ADD')
      effective.push({
        sourceId: correction.id,
        eventId: null,
        source: 'CORRECTION',
        employeeId: correction.employeeId,
        factory: correction.factory,
        gateId: null,
        direction: correction.direction!,
        occurredAt: correction.occurredAt!,
      });
  }
  return effective.sort(
    (a, b) =>
      b.occurredAt.getTime() - a.occurredAt.getTime() ||
      b.sourceId.localeCompare(a.sourceId),
  );
}
