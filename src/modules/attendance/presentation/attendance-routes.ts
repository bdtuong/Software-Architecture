import { Router } from 'express';
import { z } from 'zod';
import type { TokenVerifier } from '../../../config/auth';
import { AttendanceService } from '../application/attendance-service';
import { AttendanceQueryService } from '../application/attendance-query-service';
import { CorrectionService } from '../application/correction-service';
import type { AttendanceRecord } from '../domain/attendance';
import { PeriodService } from '../application/period-service';
import { principalOf, requirePrincipal } from './auth-middleware';

const timestamp = z.string().datetime({ offset: true });
const id = z.string().trim().min(1).max(128);
const eventSchema = z
  .object({
    eventId: id,
    passageEvidenceId: id,
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
const correctionSchema = z
  .object({
    kind: z.enum(['ADD', 'REPLACE', 'VOID']),
    employeeId: id,
    factory: z.enum(['BINH_DUONG', 'LONG_AN']),
    targetRecordId: z.string().uuid().optional(),
    direction: z.enum(['ENTRY', 'EXIT']).optional(),
    occurredAt: timestamp.optional(),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
const reviewSchema = z
  .object({ approve: z.boolean(), reason: z.string().trim().min(10).max(1000) })
  .strict();

function serialize(record: AttendanceRecord) {
  return {
    ...record,
    occurredAt: record.occurredAt.toISOString(),
    recordedAt: record.recordedAt.toISOString(),
  };
}
function validationError(
  response: import('express').Response,
  parsed: { error: z.ZodError },
) {
  response
    .status(400)
    .json({ error: 'Invalid request', details: parsed.error.flatten() });
}

export function attendanceRoutes(
  attendance: AttendanceService,
  query: AttendanceQueryService,
  corrections: CorrectionService,
  verify: TokenVerifier,
  periods: PeriodService,
) {
  const router = Router();
  router.use(requirePrincipal(verify));

  router.post('/events', async (request, response, next) => {
    const principal = principalOf(request);
    if (principal.role !== 'GATEWAY') {
      response.status(403).json({ error: 'Gateway role required' });
      return;
    }
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed);
      return;
    }
    if (!principal.factories.includes(parsed.data.factory)) {
      response.status(403).json({ error: 'Factory outside gateway scope' });
      return;
    }
    try {
      const result = await attendance.accept(
        { ...parsed.data, occurredAt: new Date(parsed.data.occurredAt) },
        principal.sub,
      );
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
      validationError(response, parsed);
      return;
    }
    const { from, to, employeeId, limit, offset } = parsed.data;
    if (from && to && new Date(from) > new Date(to)) {
      response.status(400).json({ error: 'from must not be after to' });
      return;
    }
    try {
      const result = await query.effective(
        employeeId,
        principalOf(request),
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
        limit,
        offset,
      );
      const { entries, ...page } = result;
      response.json({
        ...page,
        records: entries.map((entry) => ({
          ...entry,
          occurredAt: entry.occurredAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/state', async (request, response, next) => {
    const parsed = z
      .object({ employeeId: id })
      .strict()
      .safeParse(request.query);
    if (!parsed.success) {
      validationError(response, parsed);
      return;
    }
    try {
      response.json(
        await query.state(parsed.data.employeeId, principalOf(request)),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/corrections', async (request, response, next) => {
    const parsed = correctionSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed);
      return;
    }
    try {
      const correction = await corrections.request(
        {
          ...parsed.data,
          occurredAt: parsed.data.occurredAt
            ? new Date(parsed.data.occurredAt)
            : undefined,
          requestedBy: principalOf(request).sub,
        },
        principalOf(request),
      );
      response.status(201).json(correction);
    } catch (error) {
      next(error);
    }
  });

  router.get('/corrections', async (request, response, next) => {
    const parsed = z
      .object({ employeeId: id })
      .strict()
      .safeParse(request.query);
    if (!parsed.success) {
      validationError(response, parsed);
      return;
    }
    try {
      response.json({
        corrections: await corrections.list(
          parsed.data.employeeId,
          principalOf(request),
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/corrections/:id/review', async (request, response, next) => {
    if (!z.string().uuid().safeParse(request.params.id).success) {
      response.status(400).json({ error: 'Invalid correction ID' });
      return;
    }
    const parsed = reviewSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed);
      return;
    }
    try {
      response.json(
        await corrections.review(
          request.params.id!,
          principalOf(request),
          parsed.data.approve,
          parsed.data.reason,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post('/periods/:month/finalize', async (request, response, next) => {
    const parsed = z
      .object({ factory: z.enum(['BINH_DUONG', 'LONG_AN']) })
      .strict()
      .safeParse(request.body);
    if (
      !parsed.success ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(request.params.month!)
    ) {
      response.status(400).json({ error: 'Invalid period request' });
      return;
    }
    try {
      response.json(
        await periods.finalize(
          parsed.data.factory,
          request.params.month!,
          principalOf(request),
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get('/periods/:month/export', async (request, response, next) => {
    const parsed = z
      .object({
        factory: z.enum(['BINH_DUONG', 'LONG_AN']),
        limit: z.coerce.number().int().min(1).max(500).default(100),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .strict()
      .safeParse(request.query);
    if (
      !parsed.success ||
      !/^20\d{2}-(0[1-9]|1[0-2])$/.test(request.params.month!)
    ) {
      response.status(400).json({ error: 'Invalid period query' });
      return;
    }
    try {
      response.json(
        await periods.export(
          parsed.data.factory,
          request.params.month!,
          principalOf(request),
          parsed.data.limit,
          parsed.data.offset,
        ),
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
