import { Prisma, PrismaClient } from '@prisma/client';
import type { CorrectionRepository } from '../application/correction-repository';
import { AttendanceRuleError } from '../application/errors';
import { vietnamMonth } from '../domain/period';
import type { NewCorrection } from '../domain/correction';

export class PrismaCorrectionRepository implements CorrectionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findRecord(id: string) {
    return this.prisma.attendanceRecord.findUnique({ where: { id } });
  }

  async create(input: NewCorrection) {
    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.attendanceCorrection.create({ data: input });
      await this.invalidateAffectedPeriods(
        tx,
        correction.factory,
        correction.occurredAt,
        correction.targetRecordId,
      );
      await tx.auditOutbox.create({
        data: {
          eventType: 'attendance.correction.requested',
          aggregateId: correction.id,
          actorId: input.requestedBy,
          payload: {
            employeeId: input.employeeId,
            factory: input.factory,
            kind: input.kind,
            reason: input.reason,
          },
        },
      });
      return correction;
    });
  }

  find(id: string) {
    return this.prisma.attendanceCorrection.findUnique({ where: { id } });
  }

  list(employeeId: string) {
    return this.prisma.attendanceCorrection.findMany({
      where: { employeeId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  approvedForFactory(factory: NewCorrection['factory']) {
    return this.prisma.attendanceCorrection.findMany({
      where: { factory, status: 'APPROVED' },
    });
  }

  approved(employeeId: string) {
    return this.prisma.attendanceCorrection.findMany({
      where: { employeeId, status: 'APPROVED' },
    });
  }

  async review(
    id: string,
    reviewerId: string,
    approve: boolean,
    reason: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.attendanceCorrection.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: approve ? 'APPROVED' : 'REJECTED',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            reviewReason: reason,
          },
        });
        if (updated.count === 0) return null;
        const correction = await tx.attendanceCorrection.findUniqueOrThrow({
          where: { id },
        });
        if (approve)
          await this.invalidateAffectedPeriods(
            tx,
            correction.factory,
            correction.occurredAt,
            correction.targetRecordId,
          );
        await tx.auditOutbox.create({
          data: {
            eventType: approve
              ? 'attendance.correction.approved'
              : 'attendance.correction.rejected',
            aggregateId: id,
            actorId: reviewerId,
            payload: {
              employeeId: correction.employeeId,
              factory: correction.factory,
              reason,
            },
          },
        });
        return correction;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new AttendanceRuleError(
          'Target record already has an approved correction',
          409,
        );
      }
      throw error;
    }
  }
  private async invalidateAffectedPeriods(
    tx: Prisma.TransactionClient,
    factory: NewCorrection['factory'],
    proposedAt: Date | null,
    targetRecordId: string | null,
  ) {
    const months = new Set<string>();
    if (proposedAt) months.add(vietnamMonth(proposedAt));
    if (targetRecordId) {
      const target = await tx.attendanceRecord.findUniqueOrThrow({
        where: { id: targetRecordId },
      });
      months.add(vietnamMonth(target.occurredAt));
    }
    for (const month of months) {
      await tx.attendancePeriod.upsert({
        where: { factory_month: { factory, month } },
        create: { factory, month },
        update: {},
      });
      await tx.attendancePeriod.updateMany({
        where: { factory, month, status: 'FINALIZED' },
        data: { status: 'REOPEN_REQUIRED' },
      });
    }
  }
}
