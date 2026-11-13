import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from '../../src/modules/attendance/application/attendance-service';
import { ListCorrections } from '../../src/modules/attendance/application/list-corrections';
import type { AttendanceEventWriter } from '../../src/modules/attendance/application/attendance-repository';
import type { CorrectionRequestReader } from '../../src/modules/attendance/application/correction-repository';

describe('ISP: narrow application ports', () => {
  it('accepts an event with a writer that has no read methods', async () => {
    const event = {
      eventId: 'event-1',
      passageEvidenceId: 'evidence-1',
      employeeId: 'E1',
      factory: 'BINH_DUONG' as const,
      gateId: 'G1',
      direction: 'ENTRY' as const,
      occurredAt: new Date('2026-10-01T00:00:00Z'),
    };
    const insertOrGet = vi.fn().mockResolvedValue({
      record: { ...event, id: 'record-1', recordedAt: new Date() },
      created: true,
    });
    const writer = { insertOrGet } satisfies AttendanceEventWriter;
    await expect(
      new AttendanceService(writer).accept(event, 'gateway-1'),
    ).resolves.toMatchObject({ created: true });
    expect(insertOrGet).toHaveBeenCalledOnce();
  });

  it('lists corrections with a reader that has no write or review methods', async () => {
    const list = vi.fn().mockResolvedValue([
      { id: 'c1', factory: 'BINH_DUONG', employeeId: 'E1' },
      { id: 'c2', factory: 'LONG_AN', employeeId: 'E1' },
    ]);
    const reader = { list } satisfies CorrectionRequestReader;
    const result = await new ListCorrections(reader).execute('E1', {
      sub: 'hr-1',
      role: 'HR',
      factories: ['BINH_DUONG'],
      employeeIds: [],
    });
    expect(result.map((row) => row.id)).toEqual(['c1']);
    expect(list).toHaveBeenCalledWith('E1');
  });
});
