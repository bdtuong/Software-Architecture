import { verifyAttendanceWriterContract } from '../support/attendance-writer-contract';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import { AttendanceQueryService } from '../../src/modules/attendance/application/attendance-query-service';
import { RequestCorrection } from '../../src/modules/attendance/application/request-correction';
import { ReviewCorrection } from '../../src/modules/attendance/application/review-correction';
import { PeriodService } from '../../src/modules/attendance/application/period-service';
import { PrismaAttendanceRepository } from '../../src/modules/attendance/infrastructure/prisma-attendance-repository';
import { PrismaCorrectionRepository } from '../../src/modules/attendance/infrastructure/prisma-correction-repository';
import { PrismaAuditOutboxRepository } from '../../src/modules/attendance/infrastructure/prisma-audit-outbox-repository';
import { PrismaPeriodRepository } from '../../src/modules/attendance/infrastructure/prisma-period-repository';

const enabled = Boolean(
  process.env.TEST_DATABASE_URL?.includes('/tmc_attendance_test'),
);
const prisma = enabled
  ? new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL! } },
    })
  : null;
afterAll(async () => {
  await prisma?.$disconnect();
});

describe.skipIf(!enabled)('PostgreSQL attendance transaction', () => {
  it('commits events and audit atomically, applies corrections, and reopens finalized periods for late data', async () => {
    const db = prisma!;
    const attendanceRepo = new PrismaAttendanceRepository(db);
    const correctionRepo = new PrismaCorrectionRepository(db);
    const periodRepo = new PrismaPeriodRepository(db);
    const audit = new PrismaAuditOutboxRepository(db);
    const attendance = new AttendanceService(attendanceRepo);
    const query = new AttendanceQueryService(attendanceRepo, correctionRepo);
    const requestCorrection = new RequestCorrection(
      attendanceRepo,
      correctionRepo,
    );
    const reviewCorrection = new ReviewCorrection(correctionRepo);
    const periods = new PeriodService(periodRepo, query);
    const suffix = randomUUID();
    const employeeId = `test-${suffix}`;
    const gateway = `gateway-${suffix}`;
    const hr = {
      sub: `hr-${suffix}`,
      role: 'HR' as const,
      factories: ['BINH_DUONG' as const],
      employeeIds: [],
    };
    const employee = {
      sub: employeeId,
      role: 'EMPLOYEE' as const,
      factories: [],
      employeeIds: [],
    };
    const integration = {
      sub: `integration-${suffix}`,
      role: 'INTEGRATION' as const,
      factories: ['BINH_DUONG' as const],
      employeeIds: [],
    };
    const event = {
      eventId: `event-${suffix}`,
      passageEvidenceId: `evidence-${suffix}`,
      employeeId,
      factory: 'BINH_DUONG' as const,
      gateId: 'G1',
      direction: 'ENTRY' as const,
      occurredAt: new Date('2026-10-15T00:00:00Z'),
    };
    const aggregateIds: string[] = [];
    try {
      const contracted = await verifyAttendanceWriterContract(
        attendanceRepo,
        event,
      );
      const first = await attendance.accept(event, gateway);
      expect(first.record.id).toBe(contracted.id);
      aggregateIds.push(first.record.id);
      expect(first.created).toBe(false);
      expect((await attendance.accept(event, gateway)).created).toBe(false);
      expect(
        await db.attendanceRecord.count({ where: { eventId: event.eventId } }),
      ).toBe(1);
      expect(
        await db.auditOutbox.count({ where: { aggregateId: first.record.id } }),
      ).toBe(1);

      await expect(
        attendance.accept({ ...event, eventId: `conflict-${suffix}` }, gateway),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db.attendanceRecord.count({ where: { employeeId } })).toBe(
        1,
      );
      const auditMessage = (await audit.pending(100)).find(
        (message) => message.aggregateId === first.record.id,
      );
      expect(auditMessage).toBeDefined();
      expect(await audit.acknowledge(auditMessage!.id)).toBe(true);
      expect(await audit.acknowledge(auditMessage!.id)).toBe(true);

      const request = await requestCorrection.execute(
        {
          kind: 'REPLACE',
          employeeId,
          factory: 'BINH_DUONG',
          targetRecordId: first.record.id,
          direction: 'EXIT',
          occurredAt: new Date('2026-10-15T01:00:00Z'),
          reason: 'Verified direction against a gate log',
          requestedBy: employeeId,
        },
        employee,
      );
      aggregateIds.push(request.id);
      expect((await query.state(employeeId, employee)).state).toBe('IN');
      expect(
        (
          await reviewCorrection.execute(
            request.id,
            hr,
            true,
            'Gate log confirms exit direction',
          )
        ).status,
      ).toBe('APPROVED');
      expect((await query.state(employeeId, employee)).state).toBe('OUT');
      expect(
        (
          await db.attendanceRecord.findUniqueOrThrow({
            where: { id: first.record.id },
          })
        ).direction,
      ).toBe('ENTRY');

      const secondRequest = await requestCorrection.execute(
        {
          kind: 'VOID',
          employeeId,
          factory: 'BINH_DUONG',
          targetRecordId: first.record.id,
          reason: 'Second contradictory correction request',
          requestedBy: employeeId,
        },
        employee,
      );
      aggregateIds.push(secondRequest.id);
      await expect(
        reviewCorrection.execute(
          secondRequest.id,
          hr,
          true,
          'Should fail duplicate approved target',
        ),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        periods.finalize('BINH_DUONG', '2026-10', hr),
      ).rejects.toMatchObject({ status: 409 });
      await reviewCorrection.execute(
        secondRequest.id,
        hr,
        false,
        'Target already has an approved correction',
      );

      const finalized = await periods.finalize('BINH_DUONG', '2026-10', hr);
      aggregateIds.push(finalized.id);
      expect(finalized.revision).toBe(1);
      const exported = await periods.export(
        'BINH_DUONG',
        '2026-10',
        integration,
        100,
        0,
      );
      expect(exported.entries[0]?.direction).toBe('EXIT');
      const late = await attendance.accept(
        {
          ...event,
          eventId: `late-${suffix}`,
          passageEvidenceId: `late-evidence-${suffix}`,
          occurredAt: new Date('2026-10-16T00:00:00Z'),
          direction: 'ENTRY',
        },
        gateway,
      );
      aggregateIds.push(late.record.id);
      expect((await periodRepo.get('BINH_DUONG', '2026-10'))?.status).toBe(
        'REOPEN_REQUIRED',
      );
      await expect(
        periods.export('BINH_DUONG', '2026-10', integration, 100, 0),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (await periods.finalize('BINH_DUONG', '2026-10', hr)).revision,
      ).toBe(2);
      const lateCorrection = await requestCorrection.execute(
        {
          kind: 'ADD',
          employeeId,
          factory: 'BINH_DUONG',
          direction: 'EXIT',
          occurredAt: new Date('2026-10-17T00:00:00Z'),
          reason: 'Recovered signed manual gate record',
          requestedBy: employeeId,
        },
        employee,
      );
      aggregateIds.push(lateCorrection.id);
      expect((await periodRepo.get('BINH_DUONG', '2026-10'))?.status).toBe(
        'REOPEN_REQUIRED',
      );
      await reviewCorrection.execute(
        lateCorrection.id,
        hr,
        false,
        'Insufficient supporting evidence',
      );
      expect(
        (await periods.finalize('BINH_DUONG', '2026-10', hr)).revision,
      ).toBe(3);
    } finally {
      await db.auditOutbox.deleteMany({
        where: { aggregateId: { in: aggregateIds } },
      });
      await db.attendanceCorrection.deleteMany({ where: { employeeId } });
      await db.attendanceRecord.deleteMany({ where: { employeeId } });
      await db.attendancePeriod.deleteMany({
        where: { factory: 'BINH_DUONG', month: '2026-10', finalizedBy: hr.sub },
      });
    }
  });
});
