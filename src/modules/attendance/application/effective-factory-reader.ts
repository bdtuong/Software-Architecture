import type { Factory } from '../domain/attendance';
import type { EffectiveAttendance } from '../domain/correction-effect';

export interface EffectiveFactoryReader {
  effectiveForFactory(
    factory: Factory,
    start: Date,
    end: Date,
    limit: number,
    offset: number,
  ): Promise<{
    entries: EffectiveAttendance[];
    total: number;
    limit: number;
    offset: number;
  }>;
}
