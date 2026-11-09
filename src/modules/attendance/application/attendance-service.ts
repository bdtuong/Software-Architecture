import { sameEvent } from '../domain/attendance';
import type {
  AttendanceHistoryFilter,
  QualifiedAttendanceEvent,
} from '../domain/attendance';
import type { AttendanceRepository } from './attendance-repository';

export class EventIdConflictError extends Error {
  constructor() {
    super('Event ID already belongs to a different attendance event');
  }
}

export class AttendanceService {
  constructor(private readonly repository: AttendanceRepository) {}

  async accept(event: QualifiedAttendanceEvent) {
    const result = await this.repository.insertOrGet(event);
    if (!sameEvent(result.record, event)) throw new EventIdConflictError();
    return result;
  }

  history(filter: AttendanceHistoryFilter) {
    return this.repository.list(filter);
  }
}
