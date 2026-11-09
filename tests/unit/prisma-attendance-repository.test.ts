import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaAttendanceRepository } from '../../src/modules/attendance/infrastructure/prisma-attendance-repository';
import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';

const event: QualifiedAttendanceEvent = {
  eventId: 'edge-001',
  passageEvidenceId: 'passage-001',
  employeeId: 'employee-17',
  factory: 'BINH_DUONG',
  gateId: 'gate-2',
  direction: 'ENTRY',
  occurredAt: new Date('2026-11-09T00:00:00Z'),
};
const record: AttendanceRecord = {
  ...event,
  id: 'record-1',
  recordedAt: new Date('2026-11-09T00:00:01Z'),
};

function adapter(
  create: ReturnType<typeof vi.fn>,
  findUnique = vi.fn(),
  findMany = vi.fn(),
) {
  const prisma = {
    attendanceRecord: { create, findUnique, findMany },
    auditOutbox: { create: vi.fn().mockResolvedValue({}) },
    attendancePeriod: {
      upsert: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: async (operation: (tx: unknown) => Promise<unknown>) =>
      operation(prisma),
  } as unknown as PrismaClient;
  return new PrismaAttendanceRepository(prisma);
}

describe('Prisma attendance adapter', () => {
  it('inserts a new event directly', async () => {
    const create = vi.fn().mockResolvedValue(record);
    const repository = adapter(create);
    await expect(
      repository.insertOrGet(event, 'factory-gateway'),
    ).resolves.toEqual({
      record,
      created: true,
    });
    expect(create).toHaveBeenCalledWith({ data: event });
  });

  it('retrieves the original record after a unique event ID race', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint',
      {
        code: 'P2002',
        clientVersion: '6.19.3',
      },
    );
    const findUnique = vi.fn().mockResolvedValue(record);
    const repository = adapter(vi.fn().mockRejectedValue(conflict), findUnique);
    await expect(
      repository.insertOrGet(event, 'factory-gateway'),
    ).resolves.toEqual({
      record,
      created: false,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { eventId: event.eventId },
    });
  });

  it('propagates database failures and queries history with stable ordering', async () => {
    const failure = new Error('connection lost');
    const findMany = vi.fn().mockResolvedValue([record]);
    const repository = adapter(
      vi.fn().mockRejectedValue(failure),
      vi.fn(),
      findMany,
    );
    await expect(repository.insertOrGet(event, 'factory-gateway')).rejects.toBe(
      failure,
    );
    await expect(repository.listAll(event.employeeId)).resolves.toEqual([
      record,
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { employeeId: event.employeeId },
    });
  });
});
