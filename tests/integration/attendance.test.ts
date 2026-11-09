import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import type { AttendanceRepository } from '../../src/modules/attendance/application/attendance-repository';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import type {
  AttendanceHistoryFilter,
  AttendanceRecord,
  QualifiedAttendanceEvent,
} from '../../src/modules/attendance/domain/attendance';

class MemoryRepository implements AttendanceRepository {
  private records = new Map<string, AttendanceRecord>();
  fail = false;

  async insertOrGet(event: QualifiedAttendanceEvent) {
    if (this.fail) throw new Error('database offline');
    const existing = this.records.get(event.eventId);
    if (existing) return { record: existing, created: false };
    const record = { ...event, id: randomUUID(), recordedAt: new Date() };
    this.records.set(event.eventId, record);
    return { record, created: true };
  }

  async list(filter: AttendanceHistoryFilter) {
    if (this.fail) throw new Error('database offline');
    return [...this.records.values()]
      .filter((record) => record.employeeId === filter.employeeId)
      .filter((record) => !filter.from || record.occurredAt >= filter.from)
      .filter((record) => !filter.to || record.occurredAt <= filter.to)
      .sort(
        (a, b) =>
          b.occurredAt.getTime() - a.occurredAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      .slice(filter.offset, filter.offset + filter.limit);
  }
}

const event = {
  eventId: 'edge-001',
  employeeId: 'employee-17',
  factory: 'BINH_DUONG',
  gateId: 'gate-2',
  direction: 'ENTRY',
  occurredAt: '2026-11-09T07:00:00.000+07:00',
};

describe('attendance HTTP API', () => {
  const setup = () => {
    const repository = new MemoryRepository();
    return { repository, app: createApp(new AttendanceService(repository)) };
  };

  it('creates once and returns the original record for an identical retry', async () => {
    const { app } = setup();
    const first = await request(app).post('/api/attendance/events').send(event);
    const retry = await request(app).post('/api/attendance/events').send(event);
    expect(first.status).toBe(201);
    expect(first.body.status).toBe('created');
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('duplicate');
    expect(retry.body.record.id).toBe(first.body.record.id);
    expect(retry.body.record.occurredAt).toBe('2026-11-09T00:00:00.000Z');
  });

  it('rejects conflicting reuse of an event ID and invalid input', async () => {
    const { app } = setup();
    await request(app).post('/api/attendance/events').send(event);
    const conflict = await request(app)
      .post('/api/attendance/events')
      .send({ ...event, direction: 'EXIT' });
    const invalid = await request(app)
      .post('/api/attendance/events')
      .send({ ...event, occurredAt: 'yesterday' });
    expect(conflict.status).toBe(409);
    expect(invalid.status).toBe(400);
  });

  it('returns filtered employee history in descending time order', async () => {
    const { app } = setup();
    await request(app).post('/api/attendance/events').send(event);
    await request(app)
      .post('/api/attendance/events')
      .send({
        ...event,
        eventId: 'edge-002',
        direction: 'EXIT',
        occurredAt: '2026-11-09T17:00:00+07:00',
      });
    await request(app)
      .post('/api/attendance/events')
      .send({ ...event, eventId: 'edge-003', employeeId: 'someone-else' });
    const response = await request(app)
      .get('/api/attendance/history')
      .query({ employeeId: event.employeeId, limit: 1 });
    expect(response.status).toBe(200);
    expect(
      response.body.records.map((r: { eventId: string }) => r.eventId),
    ).toEqual(['edge-002']);
    expect(
      (
        await request(app).get('/api/attendance/history').query({
          employeeId: event.employeeId,
          from: '2026-11-10T00:00:00Z',
          to: '2026-11-09T00:00:00Z',
        })
      ).status,
    ).toBe(400);
  });

  it('reports persistence failure without claiming the event was accepted', async () => {
    const { app, repository } = setup();
    repository.fail = true;
    const response = await request(app)
      .post('/api/attendance/events')
      .send(event);
    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/unavailable/);
  });
});
