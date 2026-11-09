import { Prisma, PrismaClient } from '@prisma/client';
import { AttendanceRuleError } from '../application/errors';
import { vietnamMonth } from '../domain/period';
import type { AttendanceRepository } from '../application/attendance-repository';
import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../domain/attendance';

export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertOrGet(event: QualifiedAttendanceEvent, actorId: string) {
    try {
      const record = await this.prisma.$transaction(async (tx) => {
        const created = await tx.attendanceRecord.create({ data: event });
        const month = vietnamMonth(event.occurredAt);
        await tx.attendancePeriod.upsert({
          where: { factory_month: { factory: event.factory, month } },
          create: { factory: event.factory, month },
          update: {},
        });
        await tx.attendancePeriod.updateMany({
          where: { factory: event.factory, month, status: 'FINALIZED' },
          data: { status: 'REOPEN_REQUIRED' },
        });
        await tx.auditOutbox.create({
          data: {
            eventType: 'attendance.accepted',
            aggregateId: created.id,
            actorId,
            payload: {
              eventId: event.eventId,
              employeeId: event.employeeId,
              factory: event.factory,
            },
          },
        });
        return created;
      });
      return { record, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const record = await this.prisma.attendanceRecord.findUnique({
          where: { eventId: event.eventId },
        });
        if (record) return { record, created: false };
        throw new AttendanceRuleError('Passage evidence already recorded', 409);
      }
      throw error;
    }
  }

  async listForFactory(
    factory: QualifiedAttendanceEvent['factory'],
  ): Promise<AttendanceRecord[]> {
    return this.prisma.attendanceRecord.findMany({ where: { factory } });
  }

  async listAll(employeeId: string): Promise<AttendanceRecord[]> {
    return this.prisma.attendanceRecord.findMany({ where: { employeeId } });
  }
}
