import type { Principal } from '../../../config/auth';
import type { Factory } from '../domain/attendance';
import { monthBounds, vietnamMonth } from '../domain/period';
import { AttendanceRuleError } from './errors';
import type { PeriodRepository } from './period-repository';
import { AttendanceQueryService } from './attendance-query-service';

export class PeriodService {
  constructor(
    private readonly periods: PeriodRepository,
    private readonly query: AttendanceQueryService,
  ) {}

  async finalize(
    factory: Factory,
    month: string,
    principal: Principal,
    now = new Date(),
  ) {
    if (principal.role !== 'HR' || !principal.factories.includes(factory))
      throw new AttendanceRuleError('HR factory scope required', 403);
    const { end } = monthBounds(month);
    if (now < end)
      throw new AttendanceRuleError('Cannot finalize an unfinished month', 400);
    return this.periods.finalize(factory, month, principal.sub);
  }

  async export(
    factory: Factory,
    month: string,
    principal: Principal,
    limit: number,
    offset: number,
  ) {
    if (
      principal.role !== 'INTEGRATION' ||
      !principal.factories.includes(factory)
    )
      throw new AttendanceRuleError('Integration factory scope required', 403);
    const period = await this.periods.get(factory, month);
    if (!period || period.status !== 'FINALIZED')
      throw new AttendanceRuleError(
        'Period is not finalized or needs reconciliation',
        409,
      );
    const { start, end } = monthBounds(month);
    const result = await this.query.effectiveForFactory(
      factory,
      start,
      end,
      limit,
      offset,
    );
    const current = await this.periods.get(factory, month);
    if (
      !current ||
      current.status !== 'FINALIZED' ||
      current.revision !== period.revision
    ) {
      throw new AttendanceRuleError(
        'Period changed during export; retry after reconciliation',
        409,
      );
    }
    return {
      factory,
      month,
      revision: period.revision,
      finalizedAt: period.finalizedAt,
      ...result,
    };
  }

  currentMonth(now = new Date()) {
    return vietnamMonth(now);
  }
}
