import { Router } from 'express';
import { z } from 'zod';
import {
  AttendanceService,
  EventIdConflictError,
} from '../application/attendance-service';
import type { AttendanceRecord } from '../domain/attendance';

const timestamp = z.string().datetime({ offset: true });
const id = z.string().trim().min(1).max(128);
const eventSchema = z
  .object({
    eventId: id,
    employeeId: id,
    factory: z.enum(['BINH_DUONG', 'LONG_AN']),
    gateId: id,
    direction: z.enum(['ENTRY', 'EXIT']),
    occurredAt: timestamp,
  })
  .strict();
const historySchema = z
  .object({
    employeeId: id,
    from: timestamp.optional(),
    to: timestamp.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

function serialize(record: AttendanceRecord) {
  return {
    ...record,
    occurredAt: record.occurredAt.toISOString(),
    recordedAt: record.recordedAt.toISOString(),
  };
}

export function attendanceRoutes(service: AttendanceService) {
  const router = Router();

  router.post('/events', async (request, response, next) => {
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Invalid attendance event',
        details: parsed.error.flatten(),
      });
      return;
    }
    try {
      const result = await service.accept({
        ...parsed.data,
        occurredAt: new Date(parsed.data.occurredAt),
      });
      response.status(result.created ? 201 : 200).json({
        status: result.created ? 'created' : 'duplicate',
        record: serialize(result.record),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/history', async (request, response, next) => {
    const parsed = historySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({
        error: 'Invalid history query',
        details: parsed.error.flatten(),
      });
      return;
    }
    const { from, to, ...rest } = parsed.data;
    if (from && to && new Date(from) > new Date(to)) {
      response.status(400).json({ error: 'from must not be after to' });
      return;
    }
    try {
      const records = await service.history({
        ...rest,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      response.json({
        records: records.map(serialize),
        limit: rest.limit,
        offset: rest.offset,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export { EventIdConflictError };
