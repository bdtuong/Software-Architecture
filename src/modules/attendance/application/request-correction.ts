import type { Principal } from '../domain/identity';
import type { AttendanceRecordLookup } from './attendance-repository';
import type { CorrectionRequestWriter } from './correction-repository';
import type { CorrectionKind, NewCorrection } from '../domain/correction';
import { defaultCorrectionRequestRules } from './correction-request-rule';
import type { CorrectionRequestRule } from './correction-request-rule';
import { AttendanceRuleError } from './errors';

export class RequestCorrection {
  constructor(
    private readonly records: AttendanceRecordLookup,
    private readonly requests: CorrectionRequestWriter,
    private readonly rules: ReadonlyMap<
      CorrectionKind,
      CorrectionRequestRule
    > = defaultCorrectionRequestRules,
  ) {}

  async execute(input: NewCorrection, principal: Principal) {
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
    )
      throw new AttendanceRuleError(
        'Proposed event time is in the future',
        400,
      );
    const rule = this.rules.get(input.kind);
    if (!rule)
      throw new AttendanceRuleError('Unsupported correction kind', 400);
    await rule.validate(input, this.records);
    return this.requests.create(input);
  }
}
