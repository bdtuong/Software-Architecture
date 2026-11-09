import { Prisma, PrismaClient } from '@prisma/client';
import type { AttendanceRepository } from '../application/attendance-repository';
import type {
  AttendanceHistoryFilter,
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../domain/attendance';

export class PrismaAttendanceRepository implements AttendanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async insertOrGet(event: QualifiedAttendanceEvent) {
    try {
      const record = await this.prisma.attendanceRecord.create({ data: event });
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
      }
      throw error;
    }
  }

  async list(filter: AttendanceHistoryFilter): Promise<AttendanceRecord[]> {
    return this.prisma.attendanceRecord.findMany({
      where: {
        employeeId: filter.employeeId,
        occurredAt: { gte: filter.from, lte: filter.to },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: filter.limit,
      skip: filter.offset,
    });
  }
}
