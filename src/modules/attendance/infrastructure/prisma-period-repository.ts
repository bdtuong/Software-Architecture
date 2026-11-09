import { PrismaClient } from '@prisma/client';
import type { PeriodRepository } from '../application/period-repository';
import type { Factory } from '../domain/attendance';
import { monthBounds } from '../domain/period';
import { AttendanceRuleError } from '../application/errors';

export class PrismaPeriodRepository implements PeriodRepository {
  constructor(private readonly prisma: PrismaClient) {}

  get(factory: Factory, month: string) {
    return this.prisma.attendancePeriod.findUnique({
      where: { factory_month: { factory, month } },
    });
  }

  async finalize(factory: Factory, month: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { start, end } = monthBounds(month);
      const pending = await tx.attendanceCorrection.count({
        where: {
          factory,
          status: 'PENDING',
          OR: [
            { occurredAt: { gte: start, lt: end } },
            { targetRecord: { occurredAt: { gte: start, lt: end } } },
          ],
        },
      });
      if (pending > 0)
        throw new AttendanceRuleError(
          'Review pending corrections before finalization',
          409,
        );
      await tx.attendancePeriod.upsert({
        where: { factory_month: { factory, month } },
        create: { factory, month },
        update: {},
      });
      const updated = await tx.attendancePeriod.updateMany({
        where: { factory, month, status: { not: 'FINALIZED' } },
        data: {
          status: 'FINALIZED',
          revision: { increment: 1 },
          finalizedAt: new Date(),
          finalizedBy: actorId,
        },
      });
      const period = await tx.attendancePeriod.findUniqueOrThrow({
        where: { factory_month: { factory, month } },
      });
      if (updated.count > 0)
        await tx.auditOutbox.create({
          data: {
            eventType: 'attendance.period.finalized',
            aggregateId: period.id,
            actorId,
            payload: { factory, month, revision: period.revision },
          },
        });
      return period;
    });
  }
}
