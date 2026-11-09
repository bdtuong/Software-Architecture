import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { AttendanceService } from './modules/attendance/application/attendance-service';
import { PrismaAttendanceRepository } from './modules/attendance/infrastructure/prisma-attendance-repository';

const env = loadEnv();
const prisma = new PrismaClient();
const attendance = new AttendanceService(
  new PrismaAttendanceRepository(prisma),
);
const server = createApp(attendance).listen(env.PORT, () => {
  console.log(`TMC-AACS API listening on port ${env.PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
