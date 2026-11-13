import type { Principal } from '../domain/identity';
import type { CorrectionRequestReader } from './correction-repository';
import { canReadEmployee, canReadFactory } from '../domain/access-policy';
import { AttendanceRuleError } from './errors';

export class ListCorrections {
  constructor(private readonly requests: CorrectionRequestReader) {}

  async execute(employeeId: string, principal: Principal) {
    if (!canReadEmployee(principal, employeeId))
      throw new AttendanceRuleError('Employee outside authorized scope', 403);
    const rows = await this.requests.list(employeeId);
    return rows.filter((row) => canReadFactory(principal, row.factory));
  }
}
