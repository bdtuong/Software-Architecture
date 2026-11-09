import type { Factory } from '../domain/attendance';
import type { AttendancePeriod } from '../domain/period';

export interface PeriodRepository {
  get(factory: Factory, month: string): Promise<AttendancePeriod | null>;
  finalize(
    factory: Factory,
    month: string,
    actorId: string,
  ): Promise<AttendancePeriod>;
}
