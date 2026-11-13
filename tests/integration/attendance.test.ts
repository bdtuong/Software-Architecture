import {
  MemoryAttendance,
  MemoryCorrections,
  MemoryPeriods,
} from '../support/memory-repositories';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import type { Principal } from '../../src/modules/attendance/domain/identity';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import { PeriodService } from '../../src/modules/attendance/application/period-service';
import { AttendanceQueryService } from '../../src/modules/attendance/application/attendance-query-service';
import { RequestCorrection } from '../../src/modules/attendance/application/request-correction';
import { ReviewCorrection } from '../../src/modules/attendance/application/review-correction';
import { ListCorrections } from '../../src/modules/attendance/application/list-corrections';

const principals: Record<string, Principal> = {
  gateway: {
    sub: 'gateway-bd',
    role: 'GATEWAY',
    factories: ['BINH_DUONG'],
    employeeIds: [],
  },
  gatewayLa: {
    sub: 'gateway-la',
    role: 'GATEWAY',
    factories: ['LONG_AN'],
    employeeIds: [],
  },
  employee: {
    sub: 'employee-17',
    role: 'EMPLOYEE',
    factories: [],
    employeeIds: [],
  },
  other: {
    sub: 'someone-else',
    role: 'EMPLOYEE',
    factories: [],
    employeeIds: [],
  },
  hr: { sub: 'hr-1', role: 'HR', factories: ['BINH_DUONG'], employeeIds: [] },
  security: {
    sub: 'guard-1',
    role: 'SECURITY',
    factories: ['BINH_DUONG'],
    employeeIds: [],
  },
  supervisor: {
    sub: 'boss-1',
    role: 'SUPERVISOR',
    factories: ['BINH_DUONG'],
    employeeIds: ['employee-17'],
  },
  reporting: {
    sub: 'reporting-1',
    role: 'REPORTING',
    factories: [],
    employeeIds: [],
  },
  integration: {
    sub: 'integration-1',
    role: 'INTEGRATION',
    factories: ['BINH_DUONG'],
    employeeIds: [],
  },
  admin: {
    sub: 'admin-1',
    role: 'ADMIN',
    factories: ['BINH_DUONG'],
    employeeIds: [],
  },
};
const event = {
  eventId: 'edge-001',
  passageEvidenceId: 'passage-001',
  employeeId: 'employee-17',
  factory: 'BINH_DUONG',
  gateId: 'gate-2',
  direction: 'ENTRY',
  occurredAt: '2026-11-09T07:00:00.000+07:00',
};
const sendEvent = (
  app: ReturnType<typeof createApp>,
  payload = event,
  token = 'gateway',
) =>
  request(app)
    .post('/api/attendance/events')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
const getHistory = (app: ReturnType<typeof createApp>, token = 'employee') =>
  request(app)
    .get('/api/attendance/history')
    .set('Authorization', `Bearer ${token}`)
    .query({ employeeId: 'employee-17' });
const setup = () => {
  const periodRepository = new MemoryPeriods();
  const attendance = new MemoryAttendance(periodRepository);
  const corrections = new MemoryCorrections(attendance, periodRepository);
  const query = new AttendanceQueryService(attendance, corrections);
  const app = createApp({
    attendance: new AttendanceService(attendance),
    query,
    periods: new PeriodService(periodRepository, query),
    requestCorrection: new RequestCorrection(attendance, corrections),
    reviewCorrection: new ReviewCorrection(corrections),
    listCorrections: new ListCorrections(corrections),
    auditOutbox: { pending: async () => [], acknowledge: async () => false },
    verify: async (token) => {
      if (!principals[token]) throw new Error('bad token');
      return principals[token];
    },
  });
  return { app, attendance, corrections };
};

describe('attendance HTTP API', () => {
  it('TC22 limits history to permitted users', async () => {
    const { app } = setup();
    await sendEvent(app);
    expect((await getHistory(app)).status).toBe(200);
    expect((await getHistory(app, 'other')).status).toBe(403);
    expect((await getHistory(app, 'supervisor')).status).toBe(200);
    expect((await getHistory(app, 'admin')).status).toBe(403);
  });

  it('TC23 applies an HR-approved replacement without changing the raw event', async () => {
    const { app } = setup();
    const original = await sendEvent(app);
    const correction = await request(app)
      .post('/api/attendance/corrections')
      .set('Authorization', 'Bearer employee')
      .send({
        kind: 'REPLACE',
        employeeId: 'employee-17',
        factory: 'BINH_DUONG',
        targetRecordId: original.body.record.id,
        direction: 'EXIT',
        occurredAt: '2026-11-09T08:00:00+07:00',
        reason: 'The recorded direction was incorrect',
      });
    expect(correction.status).toBe(201);
    expect((await getHistory(app)).body.records[0].direction).toBe('ENTRY');
    expect(
      (
        await request(app)
          .post(`/api/attendance/corrections/${correction.body.id}/review`)
          .set('Authorization', 'Bearer admin')
          .send({ approve: true, reason: 'Verified against gate log' })
      ).status,
    ).toBe(403);
    const reviewed = await request(app)
      .post(`/api/attendance/corrections/${correction.body.id}/review`)
      .set('Authorization', 'Bearer hr')
      .send({ approve: true, reason: 'Verified against gate log' });
    expect(reviewed.status).toBe(200);
    expect((await getHistory(app)).body.records[0].direction).toBe('EXIT');
    expect((await sendEvent(app)).body.status).toBe('duplicate');
    expect(
      (
        await request(app)
          .post(`/api/attendance/corrections/${correction.body.id}/review`)
          .set('Authorization', 'Bearer hr')
          .send({ approve: true, reason: 'Verified against gate log' })
      ).status,
    ).toBe(409);
  });

  it('TC24 supports ADD and VOID corrections', async () => {
    const { app } = setup();
    const raw = await sendEvent(app);
    await sendEvent(app, {
      ...event,
      eventId: 'edge-002',
      passageEvidenceId: 'passage-002',
      occurredAt: '2026-11-09T08:00:00+07:00',
    });
    const voidRequest = await request(app)
      .post('/api/attendance/corrections')
      .set('Authorization', 'Bearer employee')
      .send({
        kind: 'VOID',
        employeeId: 'employee-17',
        factory: 'BINH_DUONG',
        targetRecordId: raw.body.record.id,
        reason: 'Duplicate passage was recorded in error',
      });
    expect(voidRequest.status).toBe(201);
    await request(app)
      .post(`/api/attendance/corrections/${voidRequest.body.id}/review`)
      .set('Authorization', 'Bearer hr')
      .send({ approve: true, reason: 'Verified duplicate evidence' });
    expect((await getHistory(app)).body.total).toBe(1);
    const addRequest = await request(app)
      .post('/api/attendance/corrections')
      .set('Authorization', 'Bearer security')
      .send({
        kind: 'ADD',
        employeeId: 'employee-17',
        factory: 'BINH_DUONG',
        direction: 'EXIT',
        occurredAt: '2026-11-09T17:00:00+07:00',
        reason: 'Manual passage verified against written gate log',
      });
    expect(addRequest.status).toBe(201);
    await request(app)
      .post(`/api/attendance/corrections/${addRequest.body.id}/review`)
      .set('Authorization', 'Bearer hr')
      .send({ approve: true, reason: 'Checked the signed gate log' });
    expect((await getHistory(app)).body.records[0].source).toBe('CORRECTION');
    expect(
      (
        await request(app)
          .get('/api/attendance/state')
          .set('Authorization', 'Bearer employee')
          .query({ employeeId: 'employee-17' })
      ).body.state,
    ).toBe('OUT');
  });

  it('TC25 enforces correction requester and reviewer separation', async () => {
    const { app } = setup();
    const own = await request(app)
      .post('/api/attendance/corrections')
      .set('Authorization', 'Bearer employee')
      .send({
        kind: 'ADD',
        employeeId: 'someone-else',
        factory: 'BINH_DUONG',
        direction: 'ENTRY',
        occurredAt: '2026-11-09T07:00:00+07:00',
        reason: 'Missing recorded arrival at gate',
      });
    expect(own.status).toBe(403);
    const unauthorized = await request(app)
      .post('/api/attendance/corrections')
      .set('Authorization', 'Bearer admin')
      .send({
        kind: 'ADD',
        employeeId: 'employee-17',
        factory: 'BINH_DUONG',
        direction: 'ENTRY',
        occurredAt: '2026-11-09T07:00:00+07:00',
        reason: 'Missing recorded arrival at gate',
      });
    expect(unauthorized.status).toBe(403);
  });

  it('TC26 restricts month finalization, exports, and audit polling to service roles', async () => {
    const { app } = setup();
    const finalize = (role: string) =>
      request(app)
        .post('/api/attendance/periods/2026-10/finalize')
        .set('Authorization', `Bearer ${role}`)
        .send({ factory: 'BINH_DUONG' });
    expect((await finalize('admin')).status).toBe(403);
    expect((await finalize('hr')).body.revision).toBe(1);
    const exportUrl =
      '/api/attendance/periods/2026-10/export?factory=BINH_DUONG';
    expect(
      (
        await request(app)
          .get(exportUrl)
          .set('Authorization', 'Bearer employee')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(exportUrl)
          .set('Authorization', 'Bearer integration')
      ).body.revision,
    ).toBe(1);
    expect(
      (
        await request(app)
          .get('/internal/audit-outbox/events')
          .set('Authorization', 'Bearer hr')
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get('/internal/audit-outbox/events')
          .set('Authorization', 'Bearer reporting')
      ).status,
    ).toBe(200);
  });

  it('TC01 accepts a valid ENTRY event', async () => {
    const { app } = setup();
    const response = await sendEvent(app);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'created',
      record: { direction: 'ENTRY' },
    });
  });

  it('TC02 accepts a valid EXIT event', async () => {
    const { app } = setup();
    const response = await sendEvent(app, { ...event, direction: 'EXIT' });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'created',
      record: { direction: 'EXIT' },
    });
  });

  it('TC03 returns the original record for an identical retry', async () => {
    const { app, attendance } = setup();
    const first = await sendEvent(app);
    const retry = await sendEvent(app);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({
      status: 'duplicate',
      record: { id: first.body.record.id },
    });
    expect(await attendance.listAll(event.employeeId)).toHaveLength(1);
  });

  it('TC04 rejects changed content with an existing event ID', async () => {
    const { app, attendance } = setup();
    await sendEvent(app);
    const conflict = await sendEvent(app, { ...event, direction: 'EXIT' });
    expect(conflict.status).toBe(409);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(1);
    expect((await attendance.listAll(event.employeeId))[0]?.direction).toBe(
      'ENTRY',
    );
  });

  it('TC06 rejects missing and invalid bearer tokens', async () => {
    const { app, attendance } = setup();
    expect(
      (await request(app).post('/api/attendance/events').send(event)).status,
    ).toBe(401);
    expect((await sendEvent(app, event, 'invalid-token')).status).toBe(401);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
  });

  it('TC07 rejects a token without the GATEWAY role', async () => {
    const { app, attendance } = setup();
    expect((await sendEvent(app, event, 'employee')).status).toBe(403);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
  });

  it('TC08 rejects a factory outside the gateway scope', async () => {
    const { app, attendance } = setup();
    expect(
      (await sendEvent(app, { ...event, factory: 'LONG_AN' })).status,
    ).toBe(403);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
  });

  it('TC09 rejects every missing required field', async () => {
    const { app, attendance } = setup();
    for (const field of Object.keys(event)) {
      const payload = { ...event } as Record<string, unknown>;
      delete payload[field];
      expect(
        (await sendEvent(app, payload as typeof event)).status,
        field,
      ).toBe(400);
    }
    expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
  });

  it('TC10 rejects unsupported factory and direction values', async () => {
    const { app } = setup();
    expect(
      (await sendEvent(app, { ...event, factory: 'UNKNOWN' })).status,
    ).toBe(400);
    expect(
      (await sendEvent(app, { ...event, direction: 'ARRIVE' })).status,
    ).toBe(400);
  });

  it('TC11 rejects blank and overlong IDs', async () => {
    const { app } = setup();
    for (const id of ['', '   ', 'x'.repeat(129)]) {
      expect((await sendEvent(app, { ...event, eventId: id })).status).toBe(
        400,
      );
      expect(
        (await sendEvent(app, { ...event, passageEvidenceId: id })).status,
      ).toBe(400);
    }
  });

  it('TC12 rejects malformed timestamps and timestamps without an offset', async () => {
    const { app } = setup();
    for (const occurredAt of ['yesterday', '2026-11-09T07:00:00']) {
      expect((await sendEvent(app, { ...event, occurredAt })).status).toBe(400);
    }
  });

  it('TC13 rejects an event more than two minutes in the future', async () => {
    const { app, attendance } = setup();
    const response = await sendEvent(app, {
      ...event,
      occurredAt: new Date(Date.now() + 3 * 60_000).toISOString(),
    });
    expect(response.status).toBe(400);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
  });

  it('TC14 accepts a delayed but otherwise valid event', async () => {
    const { app } = setup();
    expect((await sendEvent(app)).status).toBe(201);
  });

  it('TC15 rejects extra fields and invalid JSON', async () => {
    const { app } = setup();
    expect(
      (await sendEvent(app, { ...event, unexpected: true } as typeof event))
        .status,
    ).toBe(400);
    const malformed = await request(app)
      .post('/api/attendance/events')
      .set('Authorization', 'Bearer gateway')
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect(malformed.status).toBe(400);
  });

  it('TC16 reports a storage failure without claiming acceptance', async () => {
    const { app, attendance } = setup();
    attendance.fail = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await sendEvent(app)).status).toBe(503);
    } finally {
      error.mockRestore();
    }
  });

  it('TC17 accepts a retry after storage recovers', async () => {
    const { app, attendance } = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      attendance.fail = true;
      expect((await sendEvent(app)).status).toBe(503);
      attendance.fail = false;
      expect(await attendance.listAll(event.employeeId)).toHaveLength(0);
      expect((await sendEvent(app)).status).toBe(201);
      expect(await attendance.listAll(event.employeeId)).toHaveLength(1);
    } finally {
      error.mockRestore();
    }
  });

  it('TC18 recognizes a retry after a successful commit and lost response', async () => {
    const { app, attendance } = setup();
    const committed = await sendEvent(app);
    const retry = await sendEvent(app);
    expect(committed.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('duplicate');
    expect(retry.body.record.id).toBe(committed.body.record.id);
    expect(await attendance.listAll(event.employeeId)).toHaveLength(1);
  });

  it.each([
    {
      tc: 'TC45',
      token: 'gatewayLa',
      factory: 'LONG_AN',
      direction: 'EXIT',
      expected: 201,
    },
    {
      tc: 'TC46',
      token: 'employee',
      factory: 'BINH_DUONG',
      direction: 'EXIT',
      expected: 403,
    },
    {
      tc: 'TC47',
      token: 'employee',
      factory: 'LONG_AN',
      direction: 'ENTRY',
      expected: 403,
    },
  ])(
    '$tc pairwise role × factory × direction',
    async ({ token, factory, direction, expected }) => {
      const { app } = setup();
      const response = await sendEvent(
        app,
        { ...event, factory, direction },
        token,
      );
      expect(response.status).toBe(expected);
    },
  );

  it('TC48 use case accepts entry and exit then returns ordered history and OUT state', async () => {
    const { app } = setup();
    expect((await sendEvent(app)).status).toBe(201);
    expect(
      (
        await sendEvent(app, {
          ...event,
          eventId: 'edge-002',
          passageEvidenceId: 'passage-002',
          direction: 'EXIT',
          occurredAt: '2026-11-09T17:00:00+07:00',
        })
      ).status,
    ).toBe(201);
    const history = await getHistory(app);
    expect(
      history.body.records.map((row: { direction: string }) => row.direction),
    ).toEqual(['EXIT', 'ENTRY']);
    const state = await request(app)
      .get('/api/attendance/state')
      .set('Authorization', 'Bearer employee')
      .query({ employeeId: 'employee-17' });
    expect(state.body).toMatchObject({ state: 'OUT', requiresReview: false });
  });

  it('TC49 state transition starts at UNKNOWN without an event', async () => {
    const { app } = setup();
    const state = await request(app)
      .get('/api/attendance/state')
      .set('Authorization', 'Bearer employee')
      .query({ employeeId: 'employee-17' });
    expect(state.body).toMatchObject({
      state: 'UNKNOWN',
      asOf: null,
      requiresReview: false,
    });
  });

  it('TC50 state transition flags consecutive ENTRY events for review', async () => {
    const { app } = setup();
    await sendEvent(app);
    await sendEvent(app, {
      ...event,
      eventId: 'edge-002',
      passageEvidenceId: 'passage-002',
      occurredAt: '2026-11-09T08:00:00+07:00',
    });
    const state = await request(app)
      .get('/api/attendance/state')
      .set('Authorization', 'Bearer employee')
      .query({ employeeId: 'employee-17' });
    expect(state.body).toMatchObject({ state: 'IN', requiresReview: true });
  });
});
