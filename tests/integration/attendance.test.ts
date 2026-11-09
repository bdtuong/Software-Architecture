import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import type { Principal } from '../../src/config/auth';
import type { AttendanceRepository } from '../../src/modules/attendance/application/attendance-repository';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import { PeriodService } from '../../src/modules/attendance/application/period-service';
import type { PeriodRepository } from '../../src/modules/attendance/application/period-repository';
import type { AttendancePeriod } from '../../src/modules/attendance/domain/period';
import { AttendanceQueryService } from '../../src/modules/attendance/application/attendance-query-service';
import type { CorrectionRepository } from '../../src/modules/attendance/application/correction-repository';
import { CorrectionService } from '../../src/modules/attendance/application/correction-service';
import type {
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';
import type {
  AttendanceCorrection,
  NewCorrection,
} from '../../src/modules/attendance/domain/correction';

class MemoryAttendance implements AttendanceRepository {
  private records = new Map<string, AttendanceRecord>();
  fail = false;
  async insertOrGet(event: QualifiedAttendanceEvent, _actorId: string) {
    void _actorId;
    if (this.fail) throw new Error('database offline');
    const existing = this.records.get(event.eventId);
    if (existing) return { record: existing, created: false };
    const record = { ...event, id: randomUUID(), recordedAt: new Date() };
    this.records.set(event.eventId, record);
    return { record, created: true };
  }
  async listForFactory(factory: QualifiedAttendanceEvent['factory']) {
    return [...this.records.values()].filter(
      (record) => record.factory === factory,
    );
  }
  async listAll(employeeId: string) {
    if (this.fail) throw new Error('database offline');
    return [...this.records.values()].filter(
      (record) => record.employeeId === employeeId,
    );
  }
  async findRecord(id: string) {
    return (
      [...this.records.values()].find((record) => record.id === id) ?? null
    );
  }
}

class MemoryCorrections implements CorrectionRepository {
  private rows = new Map<string, AttendanceCorrection>();
  constructor(private readonly attendance: MemoryAttendance) {}
  findRecord(id: string) {
    return this.attendance.findRecord(id);
  }
  async create(input: NewCorrection) {
    const row: AttendanceCorrection = {
      ...input,
      id: randomUUID(),
      status: 'PENDING',
      targetRecordId: input.targetRecordId ?? null,
      direction: input.direction ?? null,
      occurredAt: input.occurredAt ?? null,
      requestedAt: new Date(),
      reviewedBy: null,
      reviewedAt: null,
      reviewReason: null,
    };
    this.rows.set(row.id, row);
    return row;
  }
  async find(id: string) {
    return this.rows.get(id) ?? null;
  }
  async list(employeeId: string) {
    return [...this.rows.values()].filter(
      (row) => row.employeeId === employeeId,
    );
  }
  async approvedForFactory(factory: NewCorrection['factory']) {
    return [...this.rows.values()].filter(
      (row) => row.factory === factory && row.status === 'APPROVED',
    );
  }
  async approved(employeeId: string) {
    return (await this.list(employeeId)).filter(
      (row) => row.status === 'APPROVED',
    );
  }
  async review(
    id: string,
    reviewerId: string,
    approve: boolean,
    reason: string,
  ) {
    const row = this.rows.get(id);
    if (!row || row.status !== 'PENDING') return null;
    row.status = approve ? 'APPROVED' : 'REJECTED';
    row.reviewedBy = reviewerId;
    row.reviewedAt = new Date();
    row.reviewReason = reason;
    return row;
  }
}

class MemoryPeriods implements PeriodRepository {
  private rows = new Map<string, AttendancePeriod>();
  async get(factory: QualifiedAttendanceEvent['factory'], month: string) {
    return this.rows.get(`${factory}:${month}`) ?? null;
  }
  async finalize(
    factory: QualifiedAttendanceEvent['factory'],
    month: string,
    actorId: string,
  ) {
    const prior = await this.get(factory, month);
    if (prior?.status === 'FINALIZED') return prior;
    const row: AttendancePeriod = {
      id: prior?.id ?? randomUUID(),
      factory,
      month,
      status: 'FINALIZED',
      revision: (prior?.revision ?? 0) + 1,
      finalizedAt: new Date(),
      finalizedBy: actorId,
    };
    this.rows.set(`${factory}:${month}`, row);
    return row;
  }
}

const principals: Record<string, Principal> = {
  gateway: {
    sub: 'gateway-bd',
    role: 'GATEWAY',
    factories: ['BINH_DUONG'],
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
  const attendance = new MemoryAttendance();
  const corrections = new MemoryCorrections(attendance);
  const query = new AttendanceQueryService(attendance, corrections);
  const app = createApp({
    attendance: new AttendanceService(attendance),
    query,
    periods: new PeriodService(new MemoryPeriods(), query),
    corrections: new CorrectionService(corrections),
    auditOutbox: { pending: async () => [], acknowledge: async () => false },
    verify: async (token) => {
      if (!principals[token]) throw new Error('bad token');
      return principals[token];
    },
  });
  return { app, attendance, corrections };
};

describe('attendance HTTP API', () => {
  it('requires a verified factory-scoped gateway token', async () => {
    const { app } = setup();
    expect(
      (await request(app).post('/api/attendance/events').send(event)).status,
    ).toBe(401);
    expect((await sendEvent(app, event, 'employee')).status).toBe(403);
    expect(
      (await sendEvent(app, { ...event, factory: 'LONG_AN' })).status,
    ).toBe(403);
  });

  it('creates once, recognizes retries, and rejects conflicting reuse', async () => {
    const { app } = setup();
    const first = await sendEvent(app);
    const retry = await sendEvent(app);
    const conflict = await sendEvent(app, { ...event, direction: 'EXIT' });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.record.id).toBe(first.body.record.id);
    expect(conflict.status).toBe(409);
    expect(
      (await sendEvent(app, { ...event, occurredAt: 'yesterday' })).status,
    ).toBe(400);
  });

  it('limits history to permitted users and derives current state by event time', async () => {
    const { app } = setup();
    await sendEvent(app);
    await sendEvent(app, {
      ...event,
      eventId: 'edge-002',
      passageEvidenceId: 'passage-002',
      direction: 'EXIT',
      occurredAt: '2026-11-09T17:00:00+07:00',
    });
    const history = await getHistory(app);
    expect(
      history.body.records.map((r: { eventId: string }) => r.eventId),
    ).toEqual(['edge-002', 'edge-001']);
    expect((await getHistory(app, 'other')).status).toBe(403);
    expect((await getHistory(app, 'supervisor')).status).toBe(200);
    expect((await getHistory(app, 'admin')).status).toBe(403);
    const state = await request(app)
      .get('/api/attendance/state')
      .set('Authorization', 'Bearer employee')
      .query({ employeeId: 'employee-17' });
    expect(state.body.state).toBe('OUT');
  });

  it('applies an HR-approved replacement without changing the raw event', async () => {
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

  it('supports ADD and VOID corrections and flags repeated directions for review', async () => {
    const { app } = setup();
    const raw = await sendEvent(app);
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
    expect(state.body.requiresReview).toBe(true);
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

  it('enforces correction requester and reviewer separation', async () => {
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

  it('restricts month finalization, exports, and audit polling to service roles', async () => {
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

  it('reports storage failure without claiming acceptance', async () => {
    const { app, attendance } = setup();
    attendance.fail = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await sendEvent(app)).status).toBe(503);
    error.mockRestore();
  });
});
