import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { createTokenVerifier } from './config/auth';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { AttendanceService } from './modules/attendance/application/attendance-service';
import { AttendanceQueryService } from './modules/attendance/application/attendance-query-service';
import { PeriodService } from './modules/attendance/application/period-service';
import { RequestCorrection } from './modules/attendance/application/request-correction';
import { ReviewCorrection } from './modules/attendance/application/review-correction';
import { ListCorrections } from './modules/attendance/application/list-corrections';
import { PrismaAuditOutboxRepository } from './modules/attendance/infrastructure/prisma-audit-outbox-repository';
import { PrismaAttendanceRepository } from './modules/attendance/infrastructure/prisma-attendance-repository';
import { PrismaPeriodRepository } from './modules/attendance/infrastructure/prisma-period-repository';
import { PrismaCorrectionRepository } from './modules/attendance/infrastructure/prisma-correction-repository';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = loadEnv();
const prisma = new PrismaClient();
const attendanceRepository = new PrismaAttendanceRepository(prisma);
const correctionRepository = new PrismaCorrectionRepository(prisma);
const query = new AttendanceQueryService(
  attendanceRepository,
  correctionRepository,
);
const server = createApp({
  attendance: new AttendanceService(attendanceRepository),
  query,
  periods: new PeriodService(new PrismaPeriodRepository(prisma), query),
  requestCorrection: new RequestCorrection(
    attendanceRepository,
    correctionRepository,
  ),
  reviewCorrection: new ReviewCorrection(correctionRepository),
  listCorrections: new ListCorrections(correctionRepository),
  verify: createTokenVerifier(env.JWT_SECRET),
  auditOutbox: new PrismaAuditOutboxRepository(prisma),
}).listen(env.PORT, () =>
  console.log(`TMC-AACS API listening on port ${env.PORT}`),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    }),
  );
}
