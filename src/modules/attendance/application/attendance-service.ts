import { AttendanceRuleError, EventIdConflictError } from './errors';
import { sameEvent } from '../domain/attendance';
import type { QualifiedAttendanceEvent } from '../domain/attendance';
import type { AttendanceRepository } from './attendance-repository';

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

  async accept(event: QualifiedAttendanceEvent, actorId: string) {
    if (event.occurredAt.getTime() > Date.now() + 2 * 60_000) {
      throw new AttendanceRuleError('Event time is in the future', 400);
    }
    const result = await this.repository.insertOrGet(event, actorId);
    if (!sameEvent(result.record, event)) throw new EventIdConflictError();
    return result;
  }

  allForEmployee(employeeId: string) {
    return this.repository.listAll(employeeId);
  }
}
